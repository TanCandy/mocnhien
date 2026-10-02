# Deploying on your own server

The stack in [`docker-compose.yml`](docker-compose.yml) runs three containers:

| Service | What it does | Exposed |
|---|---|---|
| `caddy` | HTTPS (free Let's Encrypt certificate, auto-renewed), reverse proxy | ports 80 and 443 |
| `app` | Node API, which also serves the built React site | internal only |
| `mongo` | MongoDB 7 with authentication, data in a named volume | internal only |

MongoDB is never published to the internet. Only Caddy listens on public ports.

---

## 1. Server prerequisites

- A Linux VPS (Ubuntu 22.04/24.04 or Debian 12) with **at least 1 vCPU and 2 GB RAM**. With 1 GB,
  add swap first (step 1.3) or the build can run out of memory.
- A domain name with an **A record** pointing at the server's IP (and an AAAA record if you use IPv6).
- MongoDB 7 needs a CPU with AVX. Check with `grep -c avx /proc/cpuinfo`. If the result is `0`,
  pick a different VPS plan.

```bash
# 1.1 Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # log out and back in afterwards

# 1.2 Firewall: SSH, HTTP, HTTPS (and HTTP/3)
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable

# 1.3 (1 GB servers only) 2 GB swap
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Get the code and configure it

```bash
sudo mkdir -p /opt/moc-nhien && sudo chown $USER /opt/moc-nhien
git clone <your-repo-url> /opt/moc-nhien
cd /opt/moc-nhien

cp .env.production.example .env
chmod 600 .env
```

Generate the secrets and paste them into `.env`:

```bash
openssl rand -hex 24   # → MONGO_ROOT_PASSWORD
openssl rand -hex 32   # → JWT_SECRET
openssl rand -hex 32   # → SEPAY_WEBHOOK_API_KEY (if you use SePay)
openssl rand -hex 32   # → WEBHOOK_SECRET (if you use the Google Sheet)
```

Edit `.env` (`nano .env`). At minimum, set:

- `DOMAIN`, `CLIENT_URL`, `FRONTEND_BASE_URL`, `ALLOWED_ORIGINS`: your real domain
- `MONGO_ROOT_PASSWORD`, `JWT_SECRET`: the generated values
- `PAYMENT_*`: the bank account that receives transfers
- `RESEND_API_KEY`, `RESEND_FROM`: needed for password-reset emails

> `MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD` take effect **only when the database volume is
> first created**. Changing them later does not change the database password. See
> [Changing the MongoDB password](#changing-the-mongodb-password).

## 3. Start it

```bash
docker compose up -d --build
docker compose ps                 # all three should become "healthy"/"running"
docker compose logs -f app        # Ctrl+C to stop following
```

Open `https://<your-domain>`. The certificate is issued on the first request, which can take a
few seconds. If it fails, check `docker compose logs caddy`. The usual causes are DNS not
pointing at the server yet, or port 80/443 being blocked.

## 4. Create the first admin

Public registration only creates customer accounts. Create the admin from the server:

```bash
docker compose exec app node backend/scripts/create-admin.js --email you@example.com --name "Your Name"
```

This prints a generated password **once**. Log in and change it. Running the command for an
email that already has an account promotes that account to admin instead.

## 5. Automatic payment confirmation (SePay)

Customers see a VietQR code with the exact amount and order code on their dashboard. These steps
let the app detect the transfer automatically, including partial payments. Without them, the QR
still works, but an admin records payments by editing the order.

1. Create an account at [sepay.vn](https://sepay.vn) and link the bank account from `PAYMENT_ACCOUNT_NUMBER`.
2. In SePay, go to **WebHooks → Add webhook**:
   - Event: **Money in** (*Có tiền vào*)
   - URL: `https://<your-domain>/api/payments/webhook/sepay`
   - Authentication: **API Key**, with the same value as `SEPAY_WEBHOOK_API_KEY` in `.env`
   - Content type: `application/json`
3. Restart the app with `docker compose up -d`. Then send a small real transfer (for example
   2.000đ) with any content. It should appear within seconds under **Admin → Payments** as
   *Unmatched*. SePay's dashboard test button may use a sample account number, and the app
   deliberately ignores transfers to other accounts (SePay's webhook log then shows
   `ignored: other account`).

How matching works:

- The QR fills in the transfer content with the order code without dashes, for example
  `ORDMG8X2K1A3F9C`. When a transfer containing that code arrives, its amount is added to the
  order's paid amount and the payment status updates (partial or paid).
- If a customer typed the content wrong, the transfer stays **Unmatched** in **Admin → Payments**.
  Enter the order code there to assign it.
- Repeated webhook deliveries are ignored, so a transfer is never counted twice.

Using another provider (Casso, PayOS, or a bank API) only needs a new webhook handler next to
`sepayWebhook` in [`backend/controllers/paymentController.js`](backend/controllers/paymentController.js).
The matching logic in `backend/services/paymentService.js` is provider-independent.

## 6. Google Sheet sync (optional)

See [`integrations/google-sheets/README.md`](integrations/google-sheets/README.md). For a one-off
spreadsheet, **Admin → Manage Orders → Export Excel** works without any setup.

---

## Day-to-day operations

### Logs

```bash
docker compose logs -f app            # application
docker compose logs --since 1h caddy  # HTTPS / access problems
```

Logs are rotated automatically (5 files × 10 MB per container).

### Backups

```bash
sh scripts/backup.sh                  # → backups/mongo-YYYYmmdd-HHMMSS.archive.gz
```

Schedule a daily backup with `crontab -e`:

```
0 3 * * * cd /opt/moc-nhien && sh scripts/backup.sh >> backups/backup.log 2>&1
```

Archives older than 14 days are deleted (`KEEP_DAYS=30 sh scripts/backup.sh` to keep longer).
**Copy backups off the server** too, for example with `rclone` to Google Drive, or with `scp`
to your own machine. A backup that lives only on the VPS disappears with the VPS.

Restoring replaces the current data:

```bash
docker compose exec -T mongo sh -c 'exec mongorestore --archive --gzip --drop \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin' < backups/mongo-XXXXXXXX-XXXXXX.archive.gz
```

### Updating

```bash
cd /opt/moc-nhien
sh scripts/backup.sh
git pull
docker compose up -d --build
docker image prune -f
```

### Rolling back

```bash
git log --oneline -5                 # find the last good commit
git checkout <commit>
docker compose up -d --build
```

If the bad release also changed data, restore the backup taken before the update. Return to the
latest code later with `git checkout main && git pull`.

### Looking at the database

MongoDB is deliberately not reachable from outside. Use a shell inside the container:

```bash
docker compose exec mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin moc-nhien'
```

To use MongoDB Compass from your computer, first add a localhost-only port to the `mongo` service
in `docker-compose.yml` and run `docker compose up -d mongo`:

```yaml
    ports:
      - "127.0.0.1:27017:27017"
```

Then open an SSH tunnel with `ssh -L 27017:127.0.0.1:27017 user@your-server` and connect
Compass to `mongodb://<user>:<password>@localhost:27017/?authSource=admin`. Remove the port
again when you're done.

### Changing the MongoDB password

```bash
docker compose exec mongo sh -c 'mongosh -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin admin --eval "db.changeUserPassword(\"$MONGO_INITDB_ROOT_USERNAME\", \"NEW_HEX_PASSWORD\")"'
```

Then set `MONGO_ROOT_PASSWORD=NEW_HEX_PASSWORD` in `.env` and run `docker compose up -d`.

---

## Moving existing data from MongoDB Atlas (or another server)

On any machine with the [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools)
installed, dump the old database:

```bash
mongodump --uri "mongodb+srv://USER:PASS@cluster.xxxxx.mongodb.net/OLD_DB_NAME" --archive=old.archive.gz --gzip
```

Copy `old.archive.gz` to the server, then load it and rename the database to `MONGO_DB`
(`moc-nhien` by default):

```bash
docker compose exec -T mongo sh -c 'exec mongorestore --archive --gzip --drop \
  --nsFrom "OLD_DB_NAME.*" --nsTo "moc-nhien.*" \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin' < old.archive.gz
```

Existing user accounts and passwords keep working. Run `create-admin` afterwards if no admin exists yet.

---

## Trying the production stack locally

Set `DOMAIN=localhost` and `CLIENT_URL=FRONTEND_BASE_URL=ALLOWED_ORIGINS=https://localhost` in
`.env`, then run `docker compose up -d --build` and open `https://localhost`. Caddy uses its own
local certificate there, so the browser shows a warning you can click through.

## Troubleshooting

| Symptom | Check |
|---|---|
| `required variable … is missing a value` on `docker compose up` | `DOMAIN`, `MONGO_ROOT_USER`, or `MONGO_ROOT_PASSWORD` is empty in `.env`. |
| `app` is *unhealthy*, logs show `MongoDB connection attempt failed` / `Authentication failed` | The `.env` password differs from the one the volume was created with. See [Changing the MongoDB password](#changing-the-mongodb-password). |
| Login works but you're logged out immediately | The site isn't being opened over `https://`, or `CLIENT_URL`/`ALLOWED_ORIGINS` don't match the domain. |
| Payment never confirms | **Admin → Payments**: is the transfer listed as Unmatched? If nothing arrives, check the SePay webhook log and `docker compose logs app \| grep -i sepay`. |
| `mongo` exits with `illegal instruction` | The CPU lacks AVX. See prerequisites. |

# Google Sheet order sync

Every order create, update, payment, or delete is mirrored to a Google Sheet. The sheet
is only a copy: MongoDB stays the source of truth, and a sheet outage never blocks an order.

For a one-off report you don't need this. Use **Manage Orders → Export Excel** instead.

## 1. Create the sheet and script

1. Create a new Google Sheet. Then go to **File → Settings → Time zone** and set it to
   `(GMT+07:00) Bangkok, Hanoi, Jakarta`.
2. Go to **Extensions → Apps Script**. Delete the sample code and paste in all of
   [`Code.gs`](Code.gs). Save.
3. Open **Project Settings (⚙) → Script properties → Add script property**:
   - Property: `WEBHOOK_SECRET`
   - Value: a long random string, for example from `openssl rand -hex 32`
4. Click **Deploy → New deployment**, set the type to **Web app**, and choose:
   - Execute as: **Me**
   - Who has access: **Anyone**. The backend calls it without a Google login; the secret
     protects it.
5. Authorize the script when prompted, then copy the **Web app URL**. It ends in `/exec`.

Opening the URL in a browser should show `{"ok":true,"service":"moc-nhien-orders-sheet"}`.

## 2. Configure the server

Add these to `.env` (production) or `backend/.env` (development):

```env
WEBHOOK_URL=https://script.google.com/macros/s/XXXXXXXX/exec
WEBHOOK_SECRET=<the same value as the script property>
```

Restart the app with `docker compose up -d`.

## 3. Fill the sheet with existing orders

As an admin, open **Manage Orders** and click **Sync Google Sheet**. This pushes every
order that matches the current filters, so leave the filters empty to send everything. Rows
are matched by order code, so you can run it again at any time to repair the sheet.

## How the sheet behaves

- The script writes to a tab named **Orders** and creates the header row on first use.
- Rows are keyed by **Mã đơn** (order code). Updates rewrite that row, and deleted orders
  are removed from the sheet.
- You can add your own columns (notes, formulas) **to the right**. The script never touches
  them. Don't rename the script's header cells.
- If you edit `Code.gs` later, go to **Deploy → Manage deployments → Edit → Version: New
  version**. The URL stays the same.

## Troubleshooting

The app logs every sync. Check them with `docker compose logs app | grep Sheets`.

| Log message | Fix |
|---|---|
| `WEBHOOK_URL not set — skipping sync` | Set `WEBHOOK_URL` and restart. |
| `sheet rejected sync … unauthorized` | `WEBHOOK_SECRET` differs between `.env` and the script property. |
| `… WEBHOOK_SECRET script property is not set` | Add the script property (step 1.3). |
| `HTTP 401/403`, or an HTML response | The deployment's access isn't set to **Anyone**, or it wasn't redeployed. |

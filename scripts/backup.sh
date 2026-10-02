#!/usr/bin/env sh
# Dump the MongoDB database of the Docker stack to a gzip archive.
#
#   sh scripts/backup.sh              # → ./backups/mongo-YYYYmmdd-HHMMSS.archive.gz
#   sh scripts/backup.sh /srv/backups # custom directory
#
# Old archives are deleted after KEEP_DAYS (default 14). Cron example (daily 03:00):
#   0 3 * * * cd /opt/moc-nhien && sh scripts/backup.sh >> backups/backup.log 2>&1
#
# Restore (replaces the current data):
#   docker compose exec -T mongo sh -c 'exec mongorestore --archive --gzip --drop \
#     -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
#     --authenticationDatabase admin' < backups/mongo-XXXX.archive.gz
set -eu

cd "$(dirname "$0")/.."

DIR="${1:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
mkdir -p "$DIR"
FILE="$DIR/mongo-$(date +%Y%m%d-%H%M%S).archive.gz"

# Credentials are read inside the container, so they never appear in `ps` on the host.
docker compose exec -T mongo sh -c 'exec mongodump --quiet --archive --gzip \
  --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin' > "$FILE.partial"
mv "$FILE.partial" "$FILE"
chmod 600 "$FILE"

find "$DIR" -name 'mongo-*.archive.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%F %T') backup written: $FILE ($(du -h "$FILE" | cut -f1))"

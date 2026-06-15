#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 1) Verify API readiness before backup.
READY_URL="${READY_URL:-http://127.0.0.1:${PORT:-5000}/ready}"
if command -v curl >/dev/null 2>&1; then
  STATUS_CODE="$(curl -s -o /tmp/amigo-ready.json -w "%{http_code}" "$READY_URL" || true)"
  if [[ "$STATUS_CODE" != "200" ]]; then
    echo "Readiness check failed with status $STATUS_CODE"
    [[ -f /tmp/amigo-ready.json ]] && cat /tmp/amigo-ready.json
    exit 1
  fi
fi

# 2) Run DB backup.
"$ROOT_DIR/scripts/backup-db.sh"

# 3) Keep only latest 14 backups.
BACKUP_DIR="$ROOT_DIR/backups"
if [[ -d "$BACKUP_DIR" ]]; then
  find "$BACKUP_DIR" -type f -name 'amigo-rentals-*.db' -printf '%T@ %p\n' \
    | sort -nr \
    | awk 'NR>14 {print $2}' \
    | xargs -r rm -f
fi

echo "Backup monitor run completed."

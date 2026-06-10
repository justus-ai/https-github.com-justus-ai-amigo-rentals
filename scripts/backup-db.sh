#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$ROOT_DIR/data/amigo-rentals.db"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "$DB_FILE" ]]; then
  echo "Database not found at $DB_FILE"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$DB_FILE" "$BACKUP_DIR/amigo-rentals-$TIMESTAMP.db"

echo "Backup created: $BACKUP_DIR/amigo-rentals-$TIMESTAMP.db"

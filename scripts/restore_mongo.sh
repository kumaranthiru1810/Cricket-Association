#!/usr/bin/env bash
# scripts/restore_mongo.sh
# MongoDB Automated Restore Script
set -e

BACKUP_SOURCE="$1"
URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/cricket_db}"

if [ -z "$BACKUP_SOURCE" ]; then
  echo "Usage: ./scripts/restore_mongo.sh <path_to_backup_directory_or_archive>"
  exit 1
fi

if [ ! -e "$BACKUP_SOURCE" ]; then
  echo "Error: Backup source '$BACKUP_SOURCE' does not exist."
  exit 1
fi

echo "[RESTORE] Starting MongoDB restore from $BACKUP_SOURCE..."

if command -v mongorestore &> /dev/null; then
  mongorestore --uri="$URI" --gzip --drop "$BACKUP_SOURCE"
  echo "[RESTORE] MongoDB restore completed successfully."
else
  echo "[WARNING] mongorestore utility not found in PATH."
  echo "[WARNING] Please install mongodb-database-tools: sudo apt install mongodb-database-tools"
  echo "[RESTORE] Importing JSON collection dumps via Node.js fallback..."
  node -e "
    const mongoose = require('mongoose');
    const fs = require('fs');
    const path = require('path');
    async function restore() {
      await mongoose.connect('$URI');
      const src = '$BACKUP_SOURCE';
      const files = fs.readdirSync(src).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const colName = path.basename(file, '.json');
        const content = JSON.parse(fs.readFileSync(path.join(src, file), 'utf8'));
        if (content.length > 0) {
          const col = mongoose.connection.db.collection(colName);
          await col.deleteMany({});
          await col.insertMany(content);
          console.log('Restored collection:', colName, '(' + content.length + ' documents)');
        }
      }
      await mongoose.disconnect();
      console.log('JSON restore completed.');
    }
    restore().catch(e => { console.error(e); process.exit(1); });
  "
  echo "[RESTORE] Fallback JSON restore completed."
fi


#!/usr/bin/env bash
# scripts/backup_mongo.sh
# MongoDB Automated Backup Script
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-backups/mongo_$TIMESTAMP}"
URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/cricket_db}"

echo "[BACKUP] Starting MongoDB backup at $(date)..."
echo "[BACKUP] Target directory: $BACKUP_DIR"

mkdir -p "$BACKUP_DIR"

if command -v mongodump &> /dev/null; then
  mongodump --uri="$URI" --out="$BACKUP_DIR" --gzip
  echo "[BACKUP] MongoDB backup completed successfully at $BACKUP_DIR"
else
  echo "[WARNING] mongodump utility not found in PATH."
  echo "[WARNING] Please install mongodb-database-tools: sudo apt install mongodb-database-tools"
  echo "[BACKUP] Exporting collection dumps via Node.js fallback..."
  node -e "
    const mongoose = require('mongoose');
    const fs = require('fs');
    const path = require('path');
    async function dump() {
      await mongoose.connect('$URI');
      const collections = await mongoose.connection.db.listCollections().toArray();
      const outDir = '$BACKUP_DIR';
      for (const col of collections) {
        const data = await mongoose.connection.db.collection(col.name).find({}).toArray();
        fs.writeFileSync(path.join(outDir, col.name + '.json'), JSON.stringify(data, null, 2));
        console.log('Exported collection:', col.name, '(' + data.length + ' documents)');
      }
      await mongoose.disconnect();
      console.log('JSON dump completed.');
    }
    dump().catch(e => { console.error(e); process.exit(1); });
  "
  echo "[BACKUP] Fallback JSON backup completed."
fi


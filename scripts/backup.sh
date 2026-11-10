#!/bin/sh
# Sauvegarde de la production : base PostgreSQL + photos envoyées.
# Usage : scripts/backup.sh [dossier]   (par défaut : ~/Sauvegardes/licorne-tricount)
# Garde les 14 dernières sauvegardes. À lancer chaque nuit (voir docs/DEPLOIEMENT.md).
set -eu

cd "$(dirname "$0")/.."
DEST="${1:-$HOME/Sauvegardes/licorne-tricount}"
STAMP="$(date +%Y-%m-%d_%H%M)"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"
mkdir -p "$DEST"

# Base : export SQL compressé
$COMPOSE exec -T db pg_dump -U licorne -d licorne_tricount --clean --if-exists \
  | gzip > "$DEST/base-$STAMP.sql.gz"

# Photos : archive du volume « uploads »
$COMPOSE exec -T api tar -czf - -C /app/uploads . > "$DEST/photos-$STAMP.tar.gz"

# Rotation : on garde les 14 dernières de chaque
for kind in base photos; do
  ls -1t "$DEST/$kind"-* 2>/dev/null | tail -n +15 | while read -r old; do rm -f "$old"; done
done

echo "Sauvegarde terminée : $DEST ($STAMP)"

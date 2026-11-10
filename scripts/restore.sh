#!/bin/sh
# Restauration de la production à partir d'une sauvegarde de scripts/backup.sh.
# Usage : scripts/restore.sh base-AAAA-MM-JJ_HHMM.sql.gz [photos-AAAA-MM-JJ_HHMM.tar.gz]
set -eu

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.production"

[ -f "${1:-}" ] || { echo "Fichier de base introuvable : ${1:-}"; exit 1; }
printf "Cela remplace les données actuelles. Taper OUI pour continuer : "
read -r answer
[ "$answer" = "OUI" ] || { echo "Annulé."; exit 1; }

# Photos d'abord (l'API doit tourner pour accéder au volume)
if [ -n "${2:-}" ]; then
  $COMPOSE exec -T api sh -c 'rm -rf /app/uploads/* && tar -xzf - -C /app/uploads' < "$2"
fi

# Base : API arrêtée pendant l'import
$COMPOSE stop api
gunzip -c "$1" | $COMPOSE exec -T db psql -q -U licorne -d licorne_tricount
$COMPOSE start api
echo "Restauration terminée."

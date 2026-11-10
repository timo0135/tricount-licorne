#!/bin/sh
# Démarrage de l'API : applique les migrations, puis lance le serveur.
set -e

PRISMA="node node_modules/prisma/build/index.js"

if ! output=$($PRISMA migrate deploy 2>&1); then
  echo "$output"
  # P3005 : base créée avant les migrations (v2, « prisma db push »).
  # On marque la migration initiale comme déjà appliquée, puis on reprend.
  if echo "$output" | grep -q "P3005"; then
    echo "Base existante sans historique de migrations : 0_init marquée comme appliquée."
    $PRISMA migrate resolve --applied 0_init
    $PRISMA migrate deploy
  else
    exit 1
  fi
else
  echo "$output"
fi

exec node dist/main.js

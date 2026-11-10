# Mise en production

Cible : `https://tricount-licorne.timotheebenchergui.fr`, sur le Mac mini, derrière Nginx Proxy Manager
(NPM), qui sert déjà le portfolio. Toutes les commandes se lancent **sur le Mac mini**.

## 1. Nom de domaine

Chez le registraire de `timotheebenchergui.fr`, ajouter un enregistrement pour `tricount-licorne`
pointant au même endroit que le portfolio :

- un `CNAME` `tricount-licorne` → `timotheebenchergui.fr.`, ou
- un `A` `tricount-licorne` → l’adresse IP publique de la box.

Les ports 80 et 443 sont déjà redirigés vers le Mac mini pour le portfolio : rien à changer sur la box.
Vérifier ensuite : `dig +short tricount-licorne.timotheebenchergui.fr`.

## 2. Récupérer le code

```bash
cd ~
git clone git@github.com:timo0135/tricount-licorne.git
cd tricount-licorne
```

(Il faut une clé SSH du Mac mini ajoutée à GitHub, ou cloner en HTTPS avec un jeton.)

## 3. Trouver le réseau Docker de Nginx Proxy Manager

```bash
docker ps --format '{{.Names}}' | grep -i proxy
docker inspect <nom-du-conteneur-npm> --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

Le nom affiché (par exemple `nginx-proxy-manager_default`) va dans `PROXY_NETWORK`.

## 4. Configuration

```bash
cp .env.production.example .env.production
openssl rand -hex 24        # → POSTGRES_PASSWORD
openssl rand -base64 48     # → JWT_SECRET
openssl rand -base64 48     # → ENCRYPTION_KEY (une autre valeur)
```

Remplir `.env.production` avec ces valeurs et `PROXY_NETWORK`. **Garder une copie de
`ENCRYPTION_KEY` en lieu sûr** (gestionnaire de mots de passe) : si elle est perdue ou changée,
la double authentification des comptes devient inutilisable. Ce fichier ne va jamais dans Git.

## 5. Lancer

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs api --tail 30
```

Attendu : les trois services `healthy`, et dans les journaux de l'API
« All migrations have been successfully applied » puis « API prête sur le port 3000 (production) ».
Si l'API s'arrête avec « Configuration invalide », le message dit quelle variable corriger.

## 6. Nginx Proxy Manager

Dans l'interface de NPM : **Hosts → Proxy Hosts → Add Proxy Host**.

| Onglet | Réglage |
| --- | --- |
| Details | Domain Names : `tricount-licorne.timotheebenchergui.fr` · Scheme : `http` · Forward Hostname : `licorne-tricount-web` · Forward Port : `80` · cocher *Block Common Exploits* |
| SSL | *Request a new SSL Certificate* · cocher *Force SSL*, *HTTP/2 Support*, *HSTS Enabled* · accepter les conditions Let's Encrypt |
| Advanced | `client_max_body_size 10m;` (photos jusqu'à 8 Mo) |

## 7. Vérifier

1. `https://tricount-licorne.timotheebenchergui.fr/api/health` → `{"status":"ok","database":"ok",…}`
2. Créer son compte sur le site, puis un troupeau.
3. Sur l'iPhone, dans Safari : Partager → Sur l'écran d'accueil.
4. Profil → Sécurité → *Ajouter une passkey sur cet appareil* (Face ID).

Les comptes créés en développement (sur le MacBook) ne sont pas repris : la production démarre
avec une base vide.

## 8. Sauvegardes

Test manuel :

```bash
scripts/backup.sh
ls ~/Sauvegardes/licorne-tricount
```

Puis chaque nuit à 3 h 17 (`crontab -e`) :

```
17 3 * * * cd ~/tricount-licorne && /bin/sh scripts/backup.sh >> ~/Sauvegardes/licorne-tricount/backup.log 2>&1
```

macOS demande d'autoriser `cron` dans *Réglages Système → Confidentialité et sécurité → Accès
complet au disque* si le dossier de destination est protégé. Copier régulièrement
`~/Sauvegardes/licorne-tricount` hors du Mac mini (disque externe, cloud) : une sauvegarde sur
la même machine ne protège pas d'une panne de disque.

Restauration : `scripts/restore.sh base-….sql.gz photos-….tar.gz`.

## 9. Mettre à jour

```bash
cd ~/tricount-licorne
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Les migrations de base sont appliquées automatiquement au redémarrage de l'API. Les utilisateurs
voient « Une nouvelle version est disponible » dans l'application.

## 10. Redémarrage du Mac mini

- Docker Desktop → Settings → General : cocher *Start Docker Desktop when you sign in*.
- Réglages Système → Énergie : *Démarrer automatiquement après une coupure de courant*.
- Les conteneurs ont `restart: unless-stopped` : ils repartent seuls avec Docker.

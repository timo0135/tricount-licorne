# 🦄 Licorne Tricount

Application web mobile de partage de dépenses entre amis, sur le thème des licornes.
Backend **NestJS + Prisma + PostgreSQL**, frontend **Vue 3 + Vite + TypeScript**, le tout dockerisé.

![Écrans de l'application](docs/screenshots/02-groupes.png)

## ✨ Fonctionnalités

- **Comptes licornes** : inscription / connexion JWT, emoji et couleur pastel attribués au hasard, profil modifiable
- **Troupeaux** (= groupes) : création, code d'invitation à partager, gestion des membres, suppression
- **Coefficients par personne et par thème** : chaque licorne a un pourcentage de participation
  pour chaque catégorie de dépense (ex : Sophie 40 % du logement mais 30 % de la nourriture,
  Timothée 10 % de la nourriture parce qu'il mange dehors le midi). Un coefficient à 0 % exclut
  la licorne de la catégorie.
- **Dépenses** : montant, intitulé, catégorie, date, note, payeur. La répartition est
  **automatique** — quelqu'un avance 50 €, et chacun se retrouve avec un solde négatif au prorata
  de son coefficient pour ce thème. Rien à régler au moment de la saisie.
- **Répartition personnalisable ponctuellement** si une dépense sort de l'ordinaire :
  - parts égales
  - par parts pondérées (2 parts pour l'un, 1 pour l'autre…)
  - montants exacts saisis à la main
- **Soldes** : qui a avancé combien, qui doit combien, avec barres de progression
- **Remboursements** : suggestion du **nombre minimal de virements** pour tout remettre à zéro, et enregistrement des remboursements effectués
- **Statistiques** par catégorie (endpoint prêt côté API)

Les coefficients sont stockés **en points de base** (10 000 = 100 %) et la somme d'une catégorie
vaut toujours exactement 100 % : à l'arrivée d'une licorne, elle prend un coefficient égal à la
moyenne des autres et tout le monde est renormalisé ; à son départ, sa part est redistribuée au
prorata.

Tous les montants sont manipulés **en centimes (entiers)** de bout en bout : aucun arrondi flottant, la somme des parts est toujours exactement égale au montant de la dépense (méthode du plus fort reste).

## 🚀 Démarrage rapide (Docker)

```bash
docker compose up --build
```

- Front : http://localhost:8080
- API : http://localhost:3000/api
- Swagger : http://localhost:3000/api/docs
- PostgreSQL : localhost:5432 (`licorne` / `licorne`)

Le schéma de base est créé automatiquement au démarrage (`prisma db push`).

Pour insérer un jeu de données de démo :

```bash
docker compose exec api npx ts-node prisma/seed.ts
```

Comptes créés : `sophie@licorne.fr`, `leo@licorne.fr`, `maya@licorne.fr`, `timothee@licorne.fr` — mot de passe `licorne123`, code d'invitation du troupeau `BROCEL22`.

Le jeu de démo contient déjà des coefficients personnalisés : Sophie paie 40 % du logement (grande
chambre) et Timothée seulement 10 % de la nourriture.

## 🛠 Démarrage en local (sans Docker)

Il faut un PostgreSQL qui tourne (ou juste `docker compose up db`).

### Backend

```bash
cd backend
cp .env.example .env          # ajuste DATABASE_URL si besoin
npm install
npx prisma generate
npx prisma migrate dev --name init   # crée les tables + la migration
npx ts-node prisma/seed.ts           # (optionnel) données de démo
npm run start:dev
```

L'API écoute sur http://localhost:3000/api.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Le front écoute sur http://localhost:5173 et proxifie `/api` vers `http://localhost:3000`.

### Tests

```bash
cd backend && npm test
```

27 tests unitaires couvrent la répartition au centime près, la normalisation des coefficients
(arrivée / départ d'un membre) et l'algorithme de simplification des dettes.

## 📁 Structure

```
licorne-tricount/
├── docker-compose.yml
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # User, Group, Membership, Expense, ExpenseShare,
│   │   │                        # Settlement, CategoryShare (coefficients)
│   │   └── seed.ts
│   └── src/
│       ├── auth/                # JWT, bcrypt, guard global + décorateur @Public
│       ├── users/               # profil (nom, emoji, couleur)
│       ├── groups/              # troupeaux, membres, code d'invitation
│       ├── expenses/            # dépenses + répartition
│       ├── balances/            # calcul des soldes + simplification des dettes
│       ├── coefficients/        # matrice licornes × catégories, normalisation à 100 %
│       ├── settlements/         # remboursements enregistrés
│       └── common/
│           ├── split.ts         # répartition au centime près (plus fort reste)
│           ├── unicorn.ts       # emojis, couleurs, codes d'invitation
│           └── categories.ts
└── frontend/
    ├── nginx.conf               # SPA + proxy /api vers l'API en prod
    └── src/
        ├── api/                 # client fetch typé + endpoints
        ├── stores/              # Pinia : auth, groups, toasts
        ├── views/               # 10 écrans (dont l'éditeur de coefficients)
        ├── components/          # avatar licorne, carte dépense, ligne de solde…
        ├── utils/format.ts      # centimes ⇄ affichage, dates, catégories
        └── styles/main.css      # design system pastel
```

## 🔌 API

Toutes les routes sont préfixées par `/api` et protégées par JWT sauf `register` / `login`.

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/auth/register` | Créer un compte |
| POST | `/auth/login` | Se connecter |
| GET | `/auth/me` | Profil courant |
| PATCH | `/users/me` | Modifier nom / emoji / couleur |
| GET / POST | `/groups` | Lister / créer un troupeau |
| POST | `/groups/join` | Rejoindre via un code d'invitation |
| GET / PATCH / DELETE | `/groups/:id` | Détail / modification / suppression |
| POST | `/groups/:id/invite-code` | Régénérer le code d'invitation |
| DELETE | `/groups/:id/members/:userId` | Quitter ou retirer une licorne |
| GET | `/groups/:id/balances` | Soldes + remboursements suggérés |
| GET / PUT | `/groups/:id/coefficients` | Matrice des coefficients (licornes × catégories) |
| POST | `/groups/:id/coefficients/apply` | Recalculer les dépenses automatiques |
| GET / POST | `/groups/:id/expenses` | Lister / ajouter une dépense |
| GET | `/groups/:id/expenses/stats` | Totaux par catégorie |
| GET / PATCH / DELETE | `/groups/:id/expenses/:id` | Détail / modification / suppression |
| GET / POST | `/groups/:id/settlements` | Lister / enregistrer un remboursement |
| DELETE | `/groups/:id/settlements/:id` | Supprimer un remboursement |

La documentation interactive complète est sur `/api/docs` (Swagger).

## ⚖️ Comment fonctionnent les coefficients

Chaque troupeau possède une matrice **licornes × catégories**, en pourcentages :

|            | 🏰 Logement | 🍽️ Nourriture | 🚗 Transport |
| ---------- | ----------- | ------------- | ------------ |
| Sophie     | 40 %        | 30 %          | 25 %         |
| Léo        | 20 %        | 30 %          | 25 %         |
| Maya       | 20 %        | 30 %          | 25 %         |
| Timothée   | 20 %        | 10 %          | 25 %         |
| **Total**  | **100 %**   | **100 %**     | **100 %**    |

Quand quelqu'un avance 120 € de logement, l'application crée directement les parts 48 / 24 / 24 / 24 €
et les soldes bougent en conséquence — aucune saisie de répartition n'est demandée.

Écran **Licornes → Coefficients** pour éditer la matrice : saisie en %, bouton « Égaliser »,
« Ajuster à 100 % » (la dernière licorne absorbe l'écart) et « Copier partout » (applique la
répartition de la catégorie courante à toutes les autres). Les dépenses déjà saisies gardent leur
répartition d'origine, sauf si on lance explicitement le recalcul.

## 🧮 Comment sont calculés les soldes

```
solde = (ce que la licorne a avancé)
      − (ce qu'elle doit sur les dépenses)
      + (remboursements qu'elle a envoyés)
      − (remboursements qu'elle a reçus)
```

Solde positif = on lui doit de l'argent. La somme de tous les soldes d'un troupeau vaut toujours 0.

Les remboursements suggérés utilisent un algorithme glouton *min cash flow* : on apparie le plus gros débiteur au plus gros créancier jusqu'à équilibre, ce qui donne au maximum **n−1 virements** pour n licornes.

## 📱 Design

Mobile-first (largeur max 520 px, centré sur desktop), pensé pour être ajouté à l'écran d'accueil d'un téléphone : halos pastel en fond, cartes en verre dépoli, dégradés arc-en-ciel, respect des safe areas iOS et de `prefers-reduced-motion`.

Captures d'écran dans [`docs/screenshots/`](docs/screenshots).

## 🔒 Avant une mise en production

- changer `JWT_SECRET` (variable d'environnement, aussi dans `docker-compose.yml`)
- remplacer `prisma db push` par de vraies migrations (`prisma migrate deploy`) dans le `CMD` du Dockerfile backend
- servir en HTTPS et restreindre `CORS_ORIGIN` au domaine du front

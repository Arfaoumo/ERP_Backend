# Designet ERP — Backend

API REST d’un ERP développé avec **Node.js, Express et MongoDB**. Elle centralise les workflows de vente, d’achat, de stock, de paiement et d’administration utilisés par le [frontend React](https://github.com/Arfaoumo/ERP_Frontend).

> Ce dépôt présente un projet de stage et de portfolio. Il ne prétend pas être un service de production exploité par des clients réels.

## Contexte du projet

Ce backend a été réalisé pendant mon stage de deuxième année de BUT Informatique au sein de **Designet Web Agency**. L’objectif était de concevoir un ERP sur mesure afin de numériser et regrouper les principaux processus internes d’une entreprise : gestion commerciale, achats, stocks, utilisateurs et pilotage de l’activité.

Le projet m’a permis de travailler sur des problématiques métier concrètes : cohérence des stocks, conversion de documents commerciaux, autorisations par rôles, paiements et fiabilité des opérations critiques.

## Fonctionnalités principales

- Authentification JWT et contrôle d’accès par rôles
- Gestion des utilisateurs, clients, fournisseurs et transporteurs
- Catalogue de produits, catégories et mouvements de stock
- Cycle devis → commande → bon de livraison → facture
- Commandes fournisseurs et réception des marchandises
- Saisie et suivi des paiements en espèces ou par chèque
- Tableaux de bord, alertes, rapports et exports CSV
- Génération de documents PDF côté serveur
- Téléversement sécurisé et traitement d’images
- OCR optionnel de factures fournisseurs avec OpenAI
- Validation homogène des requêtes et gestion centralisée des erreurs

## Ma contribution personnelle

J’ai participé à la conception et au développement de l’ERP sur l’ensemble de son cycle, avec notamment :

- la modélisation des données MongoDB avec Mongoose ;
- la conception et l’implémentation des API REST ;
- le développement des modules de ventes, achats, stocks, clients, fournisseurs et utilisateurs ;
- la mise en place de l’authentification JWT et des autorisations par rôles ;
- la sécurisation des opérations critiques grâce aux transactions MongoDB et à des traitements idempotents ;
- la prévention des doubles mouvements de stock et des paiements incohérents ;
- l’intégration de la génération PDF, des rapports et de l’OCR optionnel ;
- la création de tests d’intégration couvrant les principaux workflows métier.

## Architecture technique

L’API utilise une architecture **MVC modulaire** enrichie de services métier, de middlewares et de schémas de validation.

```text
app.js                     configuration Express et middlewares
server.js                  démarrage, environnement, base et tâches planifiées
src/
├── config/                connexion MongoDB
├── controllers/           traitements des requêtes HTTP
├── jobs/                  tâches planifiées
├── middleware/            authentification, autorisation et validation
├── models/                schémas et index Mongoose
├── routes/                routes Express
├── services/              logique métier réutilisable
├── utils/                 erreurs, transactions, montants et fichiers
└── validation/            schémas Zod
test/                      tests d’intégration Jest / Supertest
```

### Événements métier structurants

- La conversion **commande → bon de livraison** déclenche la sortie de stock.
- Le passage d’une commande fournisseur à l’état **reçue** déclenche l’entrée de stock.
- Les conversions de documents et les écritures critiques utilisent des transactions et des mécanismes d’idempotence.

### Technologies

| Domaine | Technologies |
| --- | --- |
| Runtime et API | Node.js, Express |
| Données | MongoDB, Mongoose |
| Sécurité | JWT, bcryptjs, Helmet, CORS, express-rate-limit |
| Validation | Zod |
| Fichiers et documents | Multer, Sharp, PDFKit |
| Automatisation | node-cron |
| Intelligence artificielle | API OpenAI pour l’OCR optionnel |
| Tests | Jest, Supertest, mongodb-memory-server |

## Instructions d’installation

### Prérequis

- Node.js 20 ou supérieur
- npm
- MongoDB configuré en **replica set** ou en cluster compatible avec les transactions
- Une clé API OpenAI uniquement pour activer l’OCR

> Les transactions MongoDB ne fonctionnent pas avec une instance `mongod` autonome classique.

### Installation

```bash
git clone https://github.com/Arfaoumo/ERP_Backend.git
cd ERP_Backend
npm ci
cp .env.example .env
```

Configurer ensuite le fichier `.env` sans jamais le publier :

```dotenv
MONGODB_URI=mongodb://localhost:27017/erp?replicaSet=rs0
JWT_SECRET=remplacer-par-un-secret-long-et-aleatoire
CORS_ORIGINS=http://localhost:5173
PORT=5000
NODE_ENV=development
```

Variables optionnelles pour l’OCR :

```dotenv
OPENAI_API_KEY=
OPENAI_OCR_MODEL=
```

### Lancement

```bash
npm run dev
```

L’API est disponible par défaut sur `http://localhost:5000`. Vérification :

```text
GET http://localhost:5000/api/health
```

### Tests

```bash
npm test
npm run test:coverage
npm run test:startup
```

Les tests utilisent une base MongoDB isolée en mémoire et n’accèdent pas aux données définies dans le fichier `.env`.

## Principaux modules de l’API

| Préfixe | Responsabilité |
| --- | --- |
| `/api/auth` | connexion, profil et utilisateurs |
| `/api/products` | produits, ajustements et historique des stocks |
| `/api/customers` | gestion des clients |
| `/api/suppliers` | gestion des fournisseurs |
| `/api/purchases/orders` | commandes fournisseurs et réceptions |
| `/api/sales` | documents commerciaux, conversions, paiements et PDF |
| `/api/upload` | images des utilisateurs et produits |
| `/api/ocr` | extraction et rapprochement des factures |
| `/api/reports` | rapports et exports CSV |
| `/api/dashboard` | indicateurs de pilotage |

## Interface Utilisateur (Frontend)

Ce dépôt est consacré à l'API Backend de l'ERP. Vous pouvez consulter et tester la partie visuelle du projet sur le dépôt suivant :

[**Accéder au dépôt ERP Frontend**](https://github.com/Arfaoumo/ERP_Frontend)

## Limites connues

- Une topologie MongoDB compatible avec les transactions est obligatoire.
- L’OCR dépend d’un fournisseur externe et ses résultats doivent être vérifiés par un humain.
- Les fichiers téléversés utilisent le disque local ; un stockage objet est préférable en production.
- Le limiteur de connexion en mémoire n’est pas partagé entre plusieurs instances.
- Les jetons de rafraîchissement, la réinitialisation de mot de passe et la MFA ne sont pas encore implémentés.

## Sécurité

- Ne jamais publier de fichier `.env`, de clé d’API ou de donnée client réelle.
- Utiliser un secret JWT long et aléatoire.
- Définir explicitement les origines CORS en production.
- Conserver l’autorisation côté backend : la visibilité d’un écran React ne constitue pas une protection.

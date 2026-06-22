# redsunsbio

Site avec une landing page custom par utilisateur, accessible via `/[pseudo]`. Chaque page partage une structure de base (avatar, bio, liens, musique de fond, fond image/vidéo) mais peut surcharger CSS/JS spécifiques. Compteur de vues uniques par page, dédupliqué par identité serveur (cookie `rsb_vid` + HMAC), fenêtre glissante de 2 heures.

## Stack

- SvelteKit 5 + Svelte 5 (`adapter-node`) — fullstack, endpoints API intégrés
- Bun (bundler / runner)
- PostgreSQL (accessible via `DATABASE_URL`)
- `@fingerprintjs/fingerprintjs` (open-source) — signal secondaire uniquement

## Prérequis

- **Bun** ≥ 1.1 (dev, build, et exécution du serveur de prod)
- **PostgreSQL** ≥ 13, joignable via `DATABASE_URL`

## Setup

```powershell
bun install
Copy-Item .env.example .env
# éditer .env : DATABASE_URL + VISITOR_SECRET (secret aléatoire fort, jamais commité)
#   secret rapide : node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

bun run migrate    # applique toutes les migrations/*.sql dans l'ordre (idempotent)
bun run dev
```

Créer la base côté Postgres au préalable :

```sql
CREATE DATABASE redsunsbio_test;
```

### Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `VISITOR_SECRET` | Secret serveur du HMAC d'identité visiteur. **Obligatoire** — l'app refuse de servir `/api/stats` sans. Générer un secret fort, unique par environnement, jamais commité. |
| `DEFAULT_PSEUDO` | (optionnel) pseudo cible du redirect depuis `/` |
| `ADDRESS_HEADER`, `XFF_DEPTH`, … | (prod derrière proxy) cf. doc adapter-node pour que `getClientAddress()` voie la vraie IP |

## Créer une page utilisateur

Chaque page = un dossier `users/[pseudo]/`. Pseudo = `^[a-z0-9_-]{1,32}$`.

```
users/[pseudo]/
├── config.json          # obligatoire — infrastructure (bg, audio, landing, theme…)
├── index.html           # obligatoire — contenu HTML injecté dans le container principal
├── style.css            # optionnel — si customCss: true dans config
├── script.js            # optionnel — si customJs: true dans config
└── assets/
    ├── avatar.png
    ├── background.mp4
    └── music.mp3
```

> **Versionnement** : le contenu réel de `users/` n'est **pas** committé (vie privée + médias lourds) — cf. `.gitignore`. Seul le template **`users/_example/`** est dans le repo pour montrer la structure. Pour démarrer : copiez `users/_example/` vers `users/<pseudo>/` et personnalisez.

**`config.json`** ne gère que l'infrastructure (fond, audio, landing, theme, view counter, displayName pour le `<title>`). Schéma dans `src/lib/types.ts` (interface `PageConfig`). Exemple complet : `users/_example/config.json`.

**`index.html`** est un fragment HTML libre injecté dans le `<main class="card">`. Le music player est auto-ajouté en bas du container si `config.music` est défini. Styles par défaut disponibles pour les conventions usuelles : `h1`, `p`, `.avatar`, `.links a` (cf. `src/routes/[pseudo]/+page.svelte`). Le user peut tout overrider via `style.css` (`customCss: true`).

Les assets sont servis par la route `/u/[pseudo]/[...path]` avec support `Range` (anti path-traversal lexical + `realpath`, MIME, 206 Partial Content pour audio/vidéo). Référence dans `index.html` : `<img src="/u/katemct/assets/avatar.png" />`, ou chemin relatif depuis `config.json` (résolution via `resolveAsset`). Un chemin absolu permet de pointer vers les assets d'une autre page.

> **Sécurité** : `index.html` est rendu via `{@html}` côté Svelte — pas de sanitisation. Adapté à l'édition **manuelle** uniquement. Pour un futur mode self-service, il faudra sanitiser côté serveur et isoler chaque page (origine/iframe sandbox).

## Build

```powershell
bun run build           # build SvelteKit (adapter-node) → build/
bun run preview         # prévisualiser le build localement
```

## Déploiement

Cible : un hôte Linux servant le build `adapter-node` derrière un reverse proxy (Caddy / tunnel Cloudflare), via un service systemd.

Le script de déploiement réel (`deploy.ps1`) n'est **pas** versionné (il contient des
valeurs personnelles). Copiez le template fourni et renseignez vos valeurs :

```powershell
Copy-Item deploy.example.ps1 deploy.ps1
# éditer deploy.ps1 : hôte SSH, chemin distant, nom du service systemd
```

```powershell
.\deploy.ps1                       # build + upload (tar + scp) + install deps + migrations + restart service
.\deploy.ps1 -SkipBuild            # déploie sans rebuild (build/ doit exister)
.\deploy.ps1 -SkipMigrate          # ne pas appliquer les migrations
.\deploy.ps1 -PiHost user@host     # hôte/SSH alternatif
```

Points clés :

- **Migrations automatiques** à chaque déploiement (`bun scripts/migrate.mjs` côté serveur, avant le restart). Idempotentes → rejouables sans risque.
- **`.env` distant n'est jamais poussé** (secrets). À poser **une fois** sur le serveur, avec au minimum `DATABASE_URL` et `VISITOR_SECRET`. Un `/api/stats` qui renvoie 500 `VISITOR_SECRET is not defined` = ce secret manque côté serveur.
- Le service tourne en loopback (`HOST=127.0.0.1`) ; l'exposition publique passe par le reverse proxy / tunnel.
- Logs applicatifs : `journalctl -u <service> -f`.

## Routes

| Route | Description |
|---|---|
| `/` | Page d'accueil : présentation du projet + lien GitHub |
| `/[pseudo]` | Page utilisateur (404 si pseudo inconnu) |
| `/u/[pseudo]/[...path]` | Assets du user (CSS, JS, images, audio, vidéo) |
| `POST /api/stats` | Enregistre une vue et renvoie les stats : `{pseudo, visitorId?}` → `{count, commentCount}`. `visitorId` = fingerprint optionnel (signal secondaire) ; l'identité réelle vient du cookie `rsb_vid`. |
| `POST /api/comments` | Enregistre un commentaire : `{pseudo, content, signature?, visitorId?}` → `{ok}` (409 si déjà commenté, pose un cookie `commented_${pseudo}=1` lu en SSR comme hint UX). |
| `POST /api/csp-report` | Réception des violations CSP (rate-limité, 204). |

## Vues uniques

- **Identité autoritaire** : un cookie httpOnly opaque `rsb_vid` (`crypto.randomUUID()`) émis par le serveur (`src/hooks.server.ts`). Le `visitor_hash` est un `HMAC(VISITOR_SECRET, rsb_vid + ip)` — calculé serveur, non forgeable côté client. La table `page_views` n'est incrémentée que si aucune entrée du même `(pseudo, visitor_hash)` dans les deux dernières heures.
- **Fingerprint** (signal secondaire, non fiable) : `@fingerprintjs/fingerprintjs` calcule un `visitorId` côté client, envoyé dans le body et stocké en colonne `fingerprint`. Il n'entre **jamais** dans l'unicité — purement informatif (détecter à la main un visiteur qui fait tourner ses cookies). Absent/invalide → `NULL`, jamais d'erreur.
- Compteur affiché : `COUNT(DISTINCT visitor_hash)` sur toute la durée de vie de la table.
- Limite résiduelle assumée : vider les cookies (ou navigation privée) recrée une identité. Sans comptes, c'est irréductible — le but est de relever la barre, pas de la rendre infranchissable.

## Licence

Domaine public — [The Unlicense](LICENSE). Faites-en ce que vous voulez, sans contrainte ni garantie.

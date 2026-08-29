# Antumbio

> *Antumbra* : la zone d'où l'on voit une éclipse annulaire — un anneau de lumière
> autour du disque sombre. Le nom du projet en est la contraction avec « bio ».

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
| `DISCORD_BOT_TOKEN` | (optionnel) token d'une app Discord dédiée — active la résolution de la PP Discord pour les users opt-in (cf. section *PP Discord dynamique*). Absent = feature désactivée, un seul `warn` au premier hit. |
| `ADDRESS_HEADER`, `XFF_DEPTH`, … | (prod derrière proxy) cf. doc adapter-node pour que `getClientAddress()` voie la vraie IP |

## Créer une page utilisateur

Chaque page = un dossier `users/[pseudo]/`. Pseudo = `^[a-z0-9_-]{1,32}$`.

```
users/[pseudo]/
├── config.json          # obligatoire — infrastructure (bg, audio, landing, theme…)
├── index.html           # obligatoire — contenu de l'onglet « Résumé »
├── details.html         # optionnel — contenu de l'onglet « Détails » (absent = pas d'onglet)
├── style.css            # optionnel — si customCss: true dans config
├── script.js            # optionnel — si customJs: true dans config
└── assets/
    ├── avatar.png
    ├── background.mp4
    └── music.mp3
```

> **Versionnement** : le contenu réel de `users/` n'est **pas** committé (vie privée + médias lourds) — cf. `.gitignore`. Seule **`users/home/`** est dans le repo : c'est à la fois la vitrine (cible du redirect depuis `/`) et le template qui montre la structure. Pour démarrer : copiez `users/home/` vers `users/<pseudo>/` et personnalisez.

Un avatar statique (`config.avatar`) accepte `png` / `jpg` / `webp` / `gif` — un GIF animé s'anime tel quel, la route d'assets le sert en `image/gif`.

**`config.json`** ne gère que l'infrastructure (fond, audio, landing, theme, view counter, `displayName` pour le nom affiché — repris dans le `<title>` sauf si `tabTitle` le surcharge). Schéma dans `src/lib/types.ts` (interface `PageConfig`). Exemple complet : `users/home/config.json`.

Fonds disponibles (`background.type`) : `color`, `image`, `video`, et `horizon` — une scène animée intégrée (ciel dégradé, soleil rouge, braises, cf. `src/lib/components/HorizonBackground.svelte`), sans aucun asset à fournir.

**`index.html`** est un fragment HTML libre injecté dans le `<main class="card">`. Le music player est auto-ajouté en bas du container si `config.music` est défini. Styles par défaut disponibles pour les conventions usuelles : `h1`, `p`, `.avatar`, `.links a` (cf. `src/routes/[pseudo]/+page.svelte`). Le user peut tout overrider via `style.css` (`customCss: true`).

### Onglets de la carte

La carte a une barre d'onglets collée à son bord inférieur, à l'intérieur. Seul le panneau central change, et la hauteur de la carte s'anime d'un onglet à l'autre (mesure JS + transition ; clampée à la hauteur du viewport, le panneau devient scrollable au-delà).

| Onglet | Contenu | Présent si |
|---|---|---|
| **résumé** (défaut) | `index.html` + la rangée de liens sociaux | toujours |
| **détails** | `details.html` | `details.html` a du contenu réel |
| **contact** | formulaire de message (ou l'état *déjà envoyé*) | `showContact` ≠ `false` |

`showContact: false` retire l'onglet **et** fait répondre `403` à `POST /api/comments` pour cette page — masquer l'onglet seul laisserait l'endpoint ouvert à qui connaît le pseudo.

Hors « résumé », la carte reprend la disposition du formulaire d'origine : le header (PP + pseudo) se replie et le lecteur audio remonte en tête. Le lecteur n'est jamais démonté au changement d'onglet — il est rendu en premier dans le DOM et repositionné en CSS via `order`, sinon la musique se couperait.

« A du contenu réel » = une fois les commentaires HTML et les blancs retirés, il reste quelque chose (`hasRenderableContent`, `src/lib/server/pages.ts`). Un `home/details.html` recopié puis vidé de ses sections ne crée donc pas d'onglet mort.

**`details.html`** est un second fragment HTML libre, mêmes règles que `index.html` (édition manuelle, rendu via `{@html}`, **non sanitisé**). Il est enveloppé dans un bloc aligné à gauche, calqué sur le formulaire de contact : chaque `<section>` se lit comme un champ, libellé au-dessus, corps encadré.

| Sélecteur | Rendu |
|---|---|
| `<section>` | Bloc « champ » : libellé + corps |
| `<h2>` dans une `<section>` | Le libellé — petit, gris clair, sans encadré |
| Tout autre enfant direct de `<section>` | Le corps : fond sombre, bordure fine, coins arrondis (mêmes valeurs que les `input`/`textarea` du formulaire) |
| `<ul class="tags">` | Rangée de pastilles (centres d'intérêt) ; un `<img>` dans un `<li>` devient une icône 1rem |
| `<dl class="facts">` | Grille deux colonnes label / valeur (infos clés) |

Exemple complet : `users/home/details.html`. Tout est surchargeable via `style.css`.

Les assets sont servis par la route `/u/[pseudo]/[...path]` avec support `Range` (anti path-traversal lexical + `realpath`, MIME, 206 Partial Content pour audio/vidéo). Référence dans `index.html` : `<img src="/u/katemct/assets/avatar.png" />`, ou chemin relatif depuis `config.json` (résolution via `resolveAsset`). Un chemin absolu permet de pointer vers les assets d'une autre page.

> **Sécurité** : `index.html` est rendu via `{@html}` côté Svelte — pas de sanitisation. Adapté à l'édition **manuelle** uniquement. Pour un futur mode self-service, il faudra sanitiser côté serveur et isoler chaque page (origine/iframe sandbox).

### PP Discord dynamique

L'avatar peut être résolu à la volée depuis l'API Discord plutôt que servi en statique. Utile quand on veut que la page reflète la PP courante d'un user Discord sans la re-uploader à chaque changement.

Pré-requis serveur (une seule fois) :

1. Créer une app Discord dédiée : https://discord.com/developers/applications → *New Application* → onglet *Bot* → *Reset Token* → copier la valeur.
2. Aucun scope/intent particulier n'est requis. Le bot n'a pas besoin d'être présent dans un serveur ; l'endpoint `/users/{id}` est accessible avec n'importe quel bot token valide.
3. Renseigner `DISCORD_BOT_TOKEN` dans `.env`.

Côté `config.json` d'une page :

```json
{
  "useDiscordPfp": true,
  "discordUserId": "123456789012345678"
}
```

`discordUserId` = snowflake Discord du user (17–20 chiffres). Pour le trouver côté Discord : *Paramètres > Avancé > Mode développeur*, puis clic droit sur le profil → *Copier l'identifiant*.

Si l'utilisateur n'a pas de PP custom, la PP par défaut Discord (pomelo, `embed/avatars/{idx}.png`) est servie.

**PP animées** : un hash d'avatar préfixé `a_` correspond à une PP animée (Nitro). Elle est servie en `…​.webp?size=128&animated=true` — les extensions statiques (`.png`, `.jpg`, `.webp` sans `animated`) n'en rendent que la première frame, et le `.gif` que documente encore Discord renvoie un **415** sur le CDN (vérifié sur un hash `a_` réel). Les hashes non animés restent en `.png?size=256`.

Fallback sur `avatar` statique (ou pas d'avatar du tout si `avatar` absent) dans tous ces cas :

- `useDiscordPfp` falsy ou `discordUserId` absent / format invalide → pas d'I/O, pas de log
- `DISCORD_BOT_TOKEN` absent → un `warn` côté serveur au premier hit, puis silencieux
- erreur HTTP (4xx/5xx, timeout) → un `warn` par hit, cache négatif 5min pour éviter de re-spammer

Cache in-memory côté serveur, TTL 1h sur succès. Pas de propagation multi-instance (suffisant pour un déploiement mono-process).

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
| `/` | Pas de page d'accueil propre : redirige (307) vers `/home`, la page vitrine — même cible dans tous les environnements |
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

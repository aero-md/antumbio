/**
 * Le favicon suit l'état de l'onglet : la trame rouge tant que l'onglet est
 * devant, la même trame en gris dès qu'il passe derrière. Une fenêtre de dix
 * onglets ne montre du site que ces seize pixels — autant qu'ils disent si
 * c'est là qu'on est.
 *
 * Portage du module homonyme de suns.red, à une chose près : ici le favicon
 * peut être remplacé par celui d'un utilisateur (`config.favicon` sur
 * `[pseudo]`). Reteinter l'image de quelqu'un d'autre n'aurait aucun sens — on
 * ne touche donc que le favicon par défaut, cf. `watchTabFavicon`.
 *
 * Le dessin ne vit qu'à un seul endroit, `static/favicon.svg`, importé en texte
 * et reteinté ici. La couleur est le seul écart entre les deux états : la
 * dupliquer en un second fichier revenait à tenir deux fois la même géométrie,
 * et à ce que la marque change d'un seul côté le jour où on la retouche.
 *
 * Les deux états sont des data URI et non des fichiers servis. Chrome
 * déprioritise les requêtes réseau d'un onglet caché : un `href` pointant sur
 * `/favicon-idle.svg` n'était souvent décodé qu'au retour au premier plan,
 * c'est-à-dire au moment précis où il redevenait rouge. Le gris ne s'affichait
 * jamais. Inline, le swap ne coûte pas un aller-retour. La CSP l'autorise,
 * `img-src` porte déjà `data:` (cf. svelte.config.js).
 */
import faviconSvg from '../../static/favicon.svg?raw';

/** Le `href` que rend `<svelte:head>` quand l'utilisateur n'a pas le sien. */
const DEFAULT_HREF = '/favicon.svg';

/* Le fichier source porte vingt lignes de commentaire sur la trame — utiles
   là-bas, mais elles n'ont rien à faire dans une URL. Espaces compressés dans
   la foulée : le dessin n'a pas de texte, rien n'y dépend du blanc. */
const outline = faviconSvg
	.replace(/<!--[\s\S]*?-->/g, '')
	.replace(/\s+/g, ' ')
	.trim();

const tinted = (color: string) =>
	'data:image/svg+xml,' + encodeURIComponent(outline.replace(/#D3001F/gi, color));

/** Le rouge de la marque, celui déjà écrit dans le fichier. */
const ACTIVE = tinted('#D3001F');

/**
 * Un gris franchement neutre, et pas un rouge désaturé : à seize pixels un
 * rouge éteint passerait pour un rouge sale plutôt que pour un état. Assez
 * sombre pour tenir sur une barre d'onglets claire, assez clair pour tenir sur
 * une sombre — l'onglet inactif n'a pas de thème à suivre, il doit marcher des
 * deux côtés.
 */
const IDLE = tinted('#8b8d92');

/**
 * Pose l'écoute et rend de quoi la retirer — la signature qu'attendent
 * `onMount` comme `$effect`.
 *
 * Le `<link rel="icon">` est rendu par `<svelte:head>` et non par `app.html`,
 * mais son `href` y est un littéral : Svelte ne le recalcule jamais après le
 * montage, la mutation tient. On restaure quand même à la fermeture, pour que
 * la navigation client-side d'une page à l'autre reparte d'un état propre.
 */
export function watchTabFavicon(): () => void {
	const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
	/* Pas de lien, ou un favicon d'utilisateur : on passe notre tour plutôt que
	   d'écraser son image par notre trame. */
	if (!link || new URL(link.href, location.origin).pathname !== DEFAULT_HREF) {
		return () => {};
	}

	const original = link.getAttribute('href') ?? DEFAULT_HREF;
	const sync = () => {
		link.href = document.hidden ? IDLE : ACTIVE;
	};

	/* Appelé tout de suite : un onglet ouvert en arrière-plan (clic du milieu)
	   est déjà caché quand la page s'hydrate, et n'émettra l'événement qu'au
	   moment où on ira le voir. */
	sync();
	document.addEventListener('visibilitychange', sync);

	return () => {
		document.removeEventListener('visibilitychange', sync);
		link.setAttribute('href', original);
	};
}

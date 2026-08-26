<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import type { PageData } from './$types';
	import Background from '$lib/components/Background.svelte';
	import LandingOverlay from '$lib/components/LandingOverlay.svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import SocialLinks from '$lib/components/SocialLinks.svelte';
	import ViewCounter from '$lib/components/ViewCounter.svelte';
	import CommentForm from '$lib/components/CommentForm.svelte';
	import CardTabs, { type Tab } from '$lib/components/CardTabs.svelte';
	import { resolveAsset } from '$lib/path';
	import { getVisitorId } from '$lib/fingerprint';
	import { watchTabFavicon } from '$lib/favicon';

	// Le favicon passe au gris quand l'onglet part en arrière-plan — sans effet
	// si la page sert le favicon de son utilisateur, qui n'est pas à nous.
	$effect(watchTabFavicon);

	function faviconType(src: string): string {
		const s = src.toLowerCase();
		if (s.endsWith('.svg')) return 'image/svg+xml';
		if (s.endsWith('.png')) return 'image/png';
		if (s.endsWith('.ico')) return 'image/x-icon';
		if (s.endsWith('.jpg') || s.endsWith('.jpeg')) return 'image/jpeg';
		if (s.endsWith('.webp')) return 'image/webp';
		return '';
	}

	interface Props { data: PageData; }
	let { data }: Props = $props();

	const { pseudo, config, html, detailsHtml, discordAvatarUrl } = $derived(
		data as {
			pseudo: string;
			config: NonNullable<PageData['config']>;
			html: string;
			detailsHtml: string;
			alreadyCommented: boolean;
			discordAvatarUrl: string | null;
		}
	);
	const assetBase = $derived(`/u/${pseudo}`);

	// Couleur dominante de la PP : downscale à 48×48, on binne les pixels par octets
	// (5 bits par canal = 32k buckets), on jette ceux à faible saturation / quasi-noir /
	// quasi-blanc (sinon le gris parasite gagne) et on retient le bucket le plus
	// populaire. C'est ce qui donne une vraie dominante perceptuelle vs la moyenne RGB
	// (qui mixe bleu + skintone → mauve/bordeau sur la plupart des PP).
	let pseudoColor = $state<string | null>(null);

	$effect(() => {
		const src = discordAvatarUrl ?? (config.avatar ? resolveAsset(assetBase, config.avatar) : null);
		if (!src) return;

		let cancelled = false;
		const img = new Image();
		img.crossOrigin = 'anonymous'; // requis pour pouvoir lire le canvas
		img.onload = () => {
			if (cancelled) return;
			const W = 48;
			const canvas = document.createElement('canvas');
			canvas.width = W;
			canvas.height = W;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			let data: Uint8ClampedArray;
			try {
				ctx.drawImage(img, 0, 0, W, W);
				data = ctx.getImageData(0, 0, W, W).data;
			} catch {
				return; // canvas tainted → fallback blanc reste
			}

			const buckets = new Map<number, { r: number; g: number; b: number; count: number }>();
			for (let i = 0; i < data.length; i += 4) {
				const r = data[i];
				const g = data[i + 1];
				const b = data[i + 2];
				const a = data[i + 3];
				if (a < 200) continue;
				const max = Math.max(r, g, b);
				const min = Math.min(r, g, b);
				if (max - min < 25) continue; // quasi-gris : parasites
				if (max < 40) continue;       // trop sombre
				if (min > 230) continue;      // trop clair
				const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
				const e = buckets.get(key);
				if (e) {
					e.r += r;
					e.g += g;
					e.b += b;
					e.count++;
				} else {
					buckets.set(key, { r, g, b, count: 1 });
				}
			}

			let best: { r: number; g: number; b: number; count: number } | null = null;
			for (const e of buckets.values()) {
				if (!best || e.count > best.count) best = e;
			}
			if (!best) return;
			const r = Math.round(best.r / best.count);
			const g = Math.round(best.g / best.count);
			const b = Math.round(best.b / best.count);
			pseudoColor = `rgb(${r}, ${g}, ${b})`;
		};
		img.src = src;
		return () => {
			cancelled = true;
		};
	});

	// Init synchrone à partir de data : si pas de landing, on est entré d'emblée
	// (évite le flash où la carte démarre opacity:0 avant que l'effet bascule).
	// `untrack` : on veut volontairement un snapshot initial, pas une dérivation réactive.
	let entered = $state(untrack(() => !data.config?.landing?.enabled));
	// L'overlay reste monté pendant la durée du fade pour pouvoir s'animer hors écran.
	let landingMounted = $state(untrack(() => !!data.config?.landing?.enabled));

	function handleEnter() {
		entered = true;
		// Démonte l'overlay une fois le fade-out terminé.
		setTimeout(() => {
			landingMounted = false;
		}, 500);
	}

	// Tilt 3D du container suivant la position de la souris par rapport à son centre.
	let cardEl = $state<HTMLElement | null>(null);
	let rotX = $state(0);
	let rotY = $state(0);
	let hasFinePointer = $state(false);
	const MAX_TILT_DEG = 6;
	const INSIDE_FACTOR = 1 / 3; // tilt atténué quand la souris survole le container

	// Le tilt suit la souris en continu. Pendant qu'on change d'onglet, la carte
	// change aussi de taille : son centre bouge sous le curseur immobile, et le
	// tilt se met à basculer tout seul par-dessus l'animation de hauteur. On le
	// remet à plat et on le gèle le temps que tout se repose.
	const TILT_FREEZE_MS = 2000;
	let tiltFrozen = $state(false);
	let tiltTimer: ReturnType<typeof setTimeout> | undefined;

	function freezeTilt() {
		tiltFrozen = true;
		rotX = 0;
		rotY = 0;
		clearTimeout(tiltTimer);
		tiltTimer = setTimeout(() => (tiltFrozen = false), TILT_FREEZE_MS);
	}
	$effect(() => () => clearTimeout(tiltTimer));

	// Détecte la présence d'une souris (vs tactile/stylo). Sur tactile, certains
	// navigateurs synthétisent des `mousemove` au tap — filtrer l'event ne suffit
	// pas, on n'attache simplement pas le listener si pas de hover/pointer fin.
	$effect(() => {
		const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
		const apply = () => (hasFinePointer = mq.matches);
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});

	$effect(() => {
		if (!hasFinePointer) {
			rotX = 0;
			rotY = 0;
			return;
		}

		function onMouseMove(e: MouseEvent) {
			if (!cardEl || tiltFrozen) return;
			const r = cardEl.getBoundingClientRect();
			const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
			const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
			const clampedX = Math.max(-1.5, Math.min(1.5, dx));
			const clampedY = Math.max(-1.5, Math.min(1.5, dy));
			const inside =
				e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
			const factor = inside ? INSIDE_FACTOR : 1;
			rotY = clampedX * MAX_TILT_DEG * factor;
			rotX = -clampedY * MAX_TILT_DEG * factor;
		}
		function reset() {
			rotX = 0;
			rotY = 0;
		}
		window.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseleave', reset);
		return () => {
			window.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseleave', reset);
		};
	});

	// Titre animé dans l'onglet. Le state est piloté ici, lu par <title> dans <svelte:head>.
	// `untrack` : valeur initiale uniquement ; l'$effect ci-dessous gère les mises à jour.
	let animatedTitle = $state(untrack(() => pseudo));
	$effect(() => {
		const base = config.displayName ?? pseudo;
		animatedTitle = base;

		if (config.titleAnimation !== 'blink-cursor') return;

		// Curseur rétro : un underscore clignote à la fin du titre.
		let visible = true;
		const id = setInterval(() => {
			animatedTitle = visible ? base + '_' : base;
			visible = !visible;
		}, 600);

		return () => clearInterval(id);
	});

	onMount(() => {
		if (config.customJs) {
			const script = document.createElement('script');
			script.type = 'module';
			script.src = `${assetBase}/script.js`;
			document.body.appendChild(script);
			return () => script.remove();
		}
	});

	// ===== Onglets de la carte =====
	// « Détails » n'existe que si le user a posé un details.html non vide.
	type TabId = 'summary' | 'details' | 'comments';
	let activeTab = $state<TabId>('summary');
	const tabs = $derived<Tab[]>([
		{ id: 'summary', label: 'résumé' },
		...(detailsHtml.trim() ? [{ id: 'details', label: 'détails' }] : []),
		// L'id reste `comments` : c'est le formulaire de commentaire derrière, seul le
		// libellé change.
		{ id: 'comments', label: 'contact' }
	]);
	// Garde-fou si le details.html disparaît d'un load à l'autre (navigation client).
	$effect(() => {
		if (!tabs.some((t) => t.id === activeTab)) activeTab = 'summary';
	});

	// Point d'entrée unique pour changer d'onglet — c'est là que le tilt se fige.
	function selectTab(id: TabId) {
		if (id === activeTab) return;
		activeTab = id;
		freezeTilt();
	}

	// « Résumé » est la vue vitrine : PP + pseudo en tête. « Détails » et
	// « contact » sont des vues de lecture/saisie et reprennent la disposition
	// d'origine du formulaire de commentaire — header masqué, lecteur remonté en
	// haut, le panneau occupe toute la carte.
	const bareLayout = $derived(activeTab !== 'summary');

	// Hauteur animée : on mesure le panneau actif et on la reporte sur le conteneur,
	// qui la transitionne. Sans ça la carte saute d'un onglet à l'autre, ce qui est
	// particulièrement moche avec le tilt 3D.
	let panelEl = $state<HTMLElement | null>(null);
	let contentHeight = $state<number | null>(null);

	$effect(() => {
		const el = panelEl;
		if (!el) return;
		const ro = new ResizeObserver(() => (contentHeight = el.offsetHeight));
		ro.observe(el);
		contentHeight = el.offsetHeight;
		return () => ro.disconnect();
	});

	// Le body est en overflow:hidden : un panneau plus haut que le viewport ferait
	// déborder la carte hors écran sans moyen d'y accéder. On plafonne et on scrolle
	// à l'intérieur. Le reste de la carte (gaps + tabs + paddings de la carte et de
	// #app, plus le header quand il est là) tient dans la réserve ci-dessous.
	let viewportH = $state(0);
	$effect(() => {
		const apply = () => (viewportH = window.innerHeight);
		apply();
		window.addEventListener('resize', apply);
		return () => window.removeEventListener('resize', apply);
	});
	const chromeReserve = $derived(bareLayout ? 180 : 260);
	const maxPanelHeight = $derived(
		viewportH ? Math.max(200, viewportH - chromeReserve) : Infinity
	);
	const panelHeight = $derived(
		contentHeight === null ? null : Math.min(contentHeight, maxPanelHeight)
	);
	const panelClamped = $derived(contentHeight !== null && contentHeight > maxPanelHeight);

	// État du formulaire de commentaire.
	// Source initiale : cookie lu en SSR (hint). Le serveur reste autoritaire via 409.
	// On override seulement une fois que l'utilisateur poste (ou que le serveur dit 409).
	let postedOverride = $state(false);
	const alreadyCommented = $derived(postedOverride || data.alreadyCommented);
	let justSubmitted = $state(false);

	// Préchauffe le visitorId au mount (FingerprintJS prend ~200ms) pour qu'il
	// soit prêt quand l'utilisateur clique sur "valider".
	onMount(() => {
		void getVisitorId();
	});

	let counterApi: { incrementComments: () => void } | null = null;
	function onCommentSubmitted() {
		postedOverride = true;
		justSubmitted = true;
		counterApi?.incrementComments();
	}
	function onAlreadyCommentedFromServer() {
		postedOverride = true;
	}
</script>

<svelte:head>
	<title>{animatedTitle}</title>
	{#if config.favicon}
		<link rel="icon" href={resolveAsset(assetBase, config.favicon)} type={faviconType(config.favicon)} />
	{:else}
		<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
	{/if}
	{#if config.customCss}
		<link rel="stylesheet" href={`${assetBase}/style.css`} />
	{/if}
</svelte:head>

<Background config={config.background} {assetBase} />

<!-- `--accent` posé ici et pas via un <style> dans <svelte:head> : Svelte lit le
     contenu d'un <style> comme du texte brut, l'interpolation n'y était jamais
     évaluée (la variable valait littéralement « {config.theme.accent} »). -->
<div class="card-stack" style:--accent={config.theme?.accent}>
	<main
		bind:this={cardEl}
		class="card"
		class:entered
		style:filter={config.theme?.filter}
		style:font-family={config.theme?.font}
		style:transform={`rotateX(${rotX}deg) rotateY(${rotY}deg)`}
	>
		{#if config.music && entered}
			<div class="player-slot" class:player-slot-top={bareLayout}>
				<AudioPlayer config={config.music} {assetBase} {entered} />
			</div>
		{/if}

		<!-- Collapse animé plutôt qu'un {#if} : le header disparaît hors « résumé »,
		     et un simple démontage ferait sauter la carte sous le tilt 3D. -->
		<div class="header-slot" class:collapsed={bareLayout} aria-hidden={bareLayout}>
			<header class="pseudo-header">
				{#if discordAvatarUrl || config.avatar}
					<img
						class="avatar"
						src={discordAvatarUrl ?? resolveAsset(assetBase, config.avatar!)}
						alt={config.displayName ?? pseudo}
					/>
				{/if}
				<h1
					class="pseudo"
					data-effect={config.nicknameEffect ?? 'glow'}
					style:--pseudo-accent={pseudoColor}
				>
					{#if (config.nicknameEffect ?? 'glow') === 'cast-shadow'}
						<span class="pseudo-shadow" aria-hidden="true">{config.displayName ?? pseudo}</span>
					{/if}
					<span class="pseudo-text">{config.displayName ?? pseudo}</span>
				</h1>
			</header>
		</div>

		<!-- Rendu avant les panneaux dans le DOM (ordre de lecture / navigation
		     clavier cohérent) mais placé visuellement en bas via `order`. -->
		<div class="tabs-slot">
			<CardTabs {tabs} active={activeTab} onSelect={(id) => selectTab(id as TabId)} />
		</div>

		<div class="panels" class:clamped={panelClamped} style:height={panelHeight === null ? null : `${panelHeight}px`}>
			{#key activeTab}
				<div
					class="panel"
					bind:this={panelEl}
					role="tabpanel"
					id={`panel-${activeTab}`}
					aria-labelledby={`tab-${activeTab}`}
					tabindex="-1"
				>
					{#if activeTab === 'summary'}
						{@html html}
						{#if config.socials && config.socials.length > 0}
							<SocialLinks socials={config.socials} />
						{/if}
					{:else if activeTab === 'details'}
						<div class="details">{@html detailsHtml}</div>
					{:else}
						{#if alreadyCommented}
							<p class="comment-note">
								{justSubmitted
									? 'merci pour votre message'
									: 'vous avez déjà laissé un message sur cette page'}
							</p>
						{:else}
							<CommentForm
								{pseudo}
								onCancel={() => selectTab('summary')}
								onSubmitted={onCommentSubmitted}
								onAlreadyCommented={onAlreadyCommentedFromServer}
							/>
						{/if}
					{/if}
				</div>
			{/key}
		</div>
	</main>
</div>

{#if config.showViewCounter !== false}
	<ViewCounter {pseudo} {entered} setApi={(api) => (counterApi = api)} />
{/if}

{#if config.background && config.background.type !== 'color' && config.background.sourceUrl}
	<a
		class="origin-link"
		href={config.background.sourceUrl}
		target="_blank"
		rel="noopener noreferrer"
		aria-label="Vidéo d'origine"
	>
		<img src="/shared/icons/youtube.png" alt="" />
		<span class="tooltip">vidéo d'origine</span>
	</a>
{/if}

{#if config.landing?.enabled && landingMounted}
	<LandingOverlay
		text={config.landing.text}
		icon={config.landing.icon ? resolveAsset(assetBase, config.landing.icon) : undefined}
		leaving={entered}
		onEnter={handleEnter}
	/>
{/if}

<style>
	/* Scène 3D : porte la perspective pour le tilt de la card (non héritée depuis
	   #app puisqu'on n'est plus enfant direct). */
	.card-stack {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2rem;
		width: min(45rem, 100%);
		perspective: 1400px;
	}
	.card {
		position: relative;
		z-index: 2;
		transform-style: preserve-3d;
		transition: transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s ease;
		will-change: transform;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.7rem;
		width: 100%;
		/* Exposés en variables : la barre d'onglets s'en sert pour annuler le padding
		   bas et venir se coller au bord de la carte. */
		--card-pad-x: 3rem;
		--card-pad-top: 2.5rem;
		--card-pad-bottom: 2.5rem;
		--card-radius: 1.75rem;
		padding: var(--card-pad-top) var(--card-pad-x) var(--card-pad-bottom);
		text-align: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(56px);
		-webkit-backdrop-filter: blur(56px);
		/* Sans liseré : la carte se détache du fond par son verre et ses ombres seules.
		   (Le `0 0 0 1px` blanc de l'ancien box-shadow doublait le border — parti avec.) */
		border: none;
		border-radius: var(--card-radius);
		box-shadow:
			0 40px 100px rgba(0, 0, 0, 0.85),
			0 15px 40px rgba(0, 0, 0, 0.6);
		/* Masqué tant qu'on est en mode "click to enter" ; fade-in 0.5s au clic. */
		opacity: 0;
		pointer-events: none;
	}
	.card.entered {
		opacity: 1;
		pointer-events: auto;
	}
	/* Pillule pseudo+PFP au sommet de la card. Padding vertical/gauche nul →
	   l'avatar (4rem, le plus haut du flex) impose la hauteur, donc le cap gauche
	   du radius 999px a exactement le rayon de l'avatar : bord flush avec la PFP.
	   L'espacement autour du texte vient des margins du h1. Fond assorti au
	   lecteur audio (même verre sombre + même liseré). */
	.pseudo-header {
		display: inline-flex;
		align-items: center;
		padding: 0 0.5rem 0 0;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.pseudo-header .avatar {
		position: relative;
		z-index: 1;
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		object-fit: cover;
		display: block;
		border: none;
		/* Bombé subtil + liseré sombre pour décoller du verre. */
		box-shadow:
			inset 0 2px 1px rgba(255, 255, 255, 0.35),
			inset 0 -3px 6px rgba(0, 0, 0, 0.35),
			0 0 0 1px rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}
	/* Pseudo : base commune. Les effets visuels (glow / cast-shadow) sont scopés
	   par [data-effect]. line-height 0.70 resserre le line-box sur les glyphes
	   → le texte apparaît centré verticalement dans la pillule. */
	.pseudo {
		position: relative;
		z-index: 3;
		margin: 0 1.5rem;
		padding: 0;
		font-family: 'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif;
		font-weight: 400;
		font-size: 2.5rem;
		line-height: 0.70;
		letter-spacing: 0.01em;
		color: white;
		/* Décale visuellement vers le haut pour compenser le typographic offset
		   des x-height letters (Cormorant baseline + leading résiduel). */
		transform: translateY(-0.08em);
	}
	.pseudo-text {
		display: inline-block;
		position: relative;
		z-index: 1;
	}
	/* Glow (default) : gradient blanc → couleur PP + pulse text-shadow. text-shadow
	   se rend à partir de la forme du glyphe, donc fonctionne malgré color: transparent. */
	.pseudo[data-effect='glow'] {
		background: linear-gradient(180deg, #ffffff 0%, var(--pseudo-accent, #ffffff) 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		text-shadow:
			0 0 14px rgba(255, 255, 255, 0.55),
			0 2px 4px rgba(0, 0, 0, 0.7);
		animation: pseudo-pulse 3.2s ease-in-out infinite;
	}
	@keyframes pseudo-pulse {
		0%, 100% {
			text-shadow:
				0 0 14px rgba(255, 255, 255, 0.55),
				0 2px 4px rgba(0, 0, 0, 0.7);
		}
		50% {
			text-shadow:
				0 0 26px rgba(255, 255, 255, 0.9),
				0 0 48px rgba(255, 255, 255, 0.3),
				0 2px 4px rgba(0, 0, 0, 0.7);
		}
	}
	/* Cast-shadow : .pseudo-shadow est un double flou et gris foncé du texte, posé
	   à la même position que le texte blanc → on ne voit que le halo blurry qui
	   déborde, comme une vraie ombre projetée. Le texte blanc anime sa glow par-dessus. */
	.pseudo[data-effect='cast-shadow'] .pseudo-shadow {
		position: absolute;
		left: 0;
		top: 0;
		color: rgba(20, 20, 20, 0.65);
		filter: blur(3px);
		pointer-events: none;
		user-select: none;
	}
	.pseudo[data-effect='cast-shadow'] .pseudo-text {
		/* Pulse glow blanc (animation pseudo-pulse partagée avec l'effet glow). */
		animation: pseudo-pulse 3.2s ease-in-out infinite;
	}
	/* Ordre visuel de la carte, découplé de l'ordre DOM : le player est rendu en 1er
	   pour ne jamais se remount d'un onglet à l'autre, et la barre d'onglets est rendue
	   avant les panneaux (ordre de tabulation cohérent) tout en s'affichant en bas. */
	.header-slot { order: 1; }
	.panels { order: 2; }
	.player-slot { order: 3; }
	.tabs-slot { order: 4; }

	.player-slot {
		width: 100%;
		max-width: 38rem;
	}
	/* Hors « résumé » le header s'efface : le lecteur reprend la tête de la carte,
	   comme dans la disposition du formulaire de commentaire d'origine. */
	.player-slot-top {
		order: 0;
	}

	/* Collapse du header via grid-template-rows 1fr → 0fr (la seule façon d'animer
	   vers/depuis une hauteur `auto`). La marge négative absorbe le gap flex de la
	   carte, qui subsisterait sinon en 1.7rem de vide. */
	.header-slot {
		display: grid;
		grid-template-rows: 1fr;
		justify-items: center;
		width: 100%;
		overflow: hidden;
		/* S'ajoute au gap flex de la carte (1.7rem) → la pillule respire un peu
		   plus vis-à-vis du contenu en dessous. */
		margin-bottom: 0.75rem;
		transition:
			grid-template-rows 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
			margin-bottom 0.28s cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 0.18s ease;
	}
	.header-slot > :global(*) {
		min-height: 0;
	}
	.header-slot.collapsed {
		grid-template-rows: 0fr;
		margin-bottom: -1.7rem;
		opacity: 0;
		pointer-events: none;
	}

	/* Le bloc d'onglets est centré et dimensionné par son contenu ; seul le padding
	   bas de la carte est annulé pour qu'il vienne s'asseoir sur le bord. */
	.tabs-slot {
		display: flex;
		justify-content: center;
		width: 100%;
		margin-bottom: calc(-1 * var(--card-pad-bottom));
	}

	/* Conteneur à hauteur pilotée en JS : `height` en px + transition = pas de saut
	   au changement d'onglet. Tant que la mesure n'a pas eu lieu (SSR, 1er paint),
	   l'attribut height est absent → auto, donc pas de flash à 0. */
	.panels {
		position: relative;
		width: 100%;
		overflow: hidden;
		transition: height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	/* Panneau plus haut que le viewport : on scrolle dedans plutôt que de laisser la
	   carte déborder hors d'un body en overflow:hidden (= contenu inatteignable). */
	.panels.clamped {
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
	}
	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.7rem;
		width: 100%;
		animation: panel-in 0.28s ease both;
	}
	.panel:focus { outline: none; }
	@keyframes panel-in {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: none; }
	}

	.comment-note {
		margin: 0;
		padding: 0.9rem 1.2rem;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.6rem;
		background: rgba(255, 255, 255, 0.05);
		color: rgba(255, 255, 255, 0.75);
		font-size: 0.85rem;
		font-style: italic;
	}

	/* Enveloppe du fragment details.html. Calquée sur le formulaire de commentaire
	   (.form) : mêmes largeur, gouttière et alignement, pour que les deux onglets
	   « pleine carte » aient la même assise. */
	.details {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 1rem;
		width: 100%;
		max-width: 40rem;
		margin: 0 auto;
		text-align: left;
	}
	.origin-link {
		position: fixed;
		bottom: 0.8rem;
		right: 0.8rem;
		z-index: 10;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem;
		opacity: 0.55;
		transition: opacity 0.18s ease;
		text-decoration: none;
	}
	.origin-link:hover { opacity: 1; }
	.origin-link img {
		width: 18px;
		height: 18px;
		display: block;
	}
	.origin-link .tooltip {
		max-width: 0;
		overflow: hidden;
		white-space: nowrap;
		font-size: 0.72rem;
		color: rgba(255, 255, 255, 0.9);
		font-style: italic;
		opacity: 0;
		transition: max-width 0.25s ease, opacity 0.2s ease;
	}
	.origin-link:hover .tooltip,
	.origin-link:focus-visible .tooltip {
		max-width: 12rem;
		opacity: 1;
	}

	/* Styles par défaut pour les conventions usuelles dans users/[pseudo]/index.html.
	   Le user peut les overrider via style.css (customCss: true dans config.json). */
	:global(.card h1) {
		margin: 0;
		font-size: 1.6rem;
		letter-spacing: 0.02em;
	}
	:global(.card p) {
		margin: 0;
		opacity: 0.85;
		font-size: 0.95rem;
		line-height: 1.5;
	}
	:global(.card blockquote),
	:global(.card .quote) {
		margin: 0;
		padding: 0.4rem 1rem;
		max-width: 38rem;
		font-style: italic;
		font-size: 0.95rem;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.8);
		text-align: center;
		quotes: "\201C""\201D";
	}
	:global(.card blockquote::before),
	:global(.card .quote::before) {
		content: open-quote;
		margin-right: 0.15em;
		opacity: 0.5;
	}
	:global(.card blockquote::after),
	:global(.card .quote::after) {
		content: close-quote;
		margin-left: 0.15em;
		opacity: 0.5;
	}
	:global(.card .avatar) {
		width: 8rem;
		height: 8rem;
		border-radius: 50%;
		object-fit: cover;
		border: 2px solid rgba(255, 255, 255, 0.15);
	}
	:global(.card .separator) {
		width: 60%;
		max-width: 18rem;
		height: 1px;
		border: none;
		background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.25), transparent);
		margin: 0.5rem 0;
	}
	:global(.card .socials) {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.1rem;
	}
	:global(.card .social-link) {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.2rem;
		height: 2.2rem;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		opacity: 0.85;
		transition: opacity 0.15s ease, transform 0.15s ease;
	}
	:global(.card .social-link:hover) {
		opacity: 1;
		transform: translateY(-1px);
	}
	:global(.card .social-link img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		/* Icônes blanches (les PNG sources sont noirs) + halo lumineux discret animé. */
		filter: brightness(0) invert(1) drop-shadow(0 0 3px rgba(255, 255, 255, 0.35));
		transition: filter 0.2s ease, transform 0.15s ease;
		animation: icon-shine 3.5s ease-in-out infinite;
	}
	:global(.card .social-link:hover img) {
		filter: brightness(0) invert(1) drop-shadow(0 0 9px rgba(255, 255, 255, 0.75));
	}
	@keyframes icon-shine {
		0%, 100% {
			filter: brightness(0) invert(1) drop-shadow(0 0 3px rgba(255, 255, 255, 0.35));
		}
		50% {
			filter: brightness(0) invert(1) drop-shadow(0 0 7px rgba(255, 255, 255, 0.55));
		}
	}
	:global(.card .social-link .popover) {
		position: absolute;
		bottom: calc(100% + 0.4rem);
		left: 50%;
		transform: translateX(-50%);
		padding: 0.3rem 0.6rem;
		background: rgba(0, 0, 0, 0.85);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.35rem;
		font-size: 0.8rem;
		font-style: normal;
		white-space: nowrap;
		color: white;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.18s ease;
	}
	:global(.card .social-link:hover .popover),
	:global(.card .copy-btn.copied .popover) {
		opacity: 1;
	}
	:global(.card .copy-btn .copied-label) { display: none; }
	:global(.card .copy-btn.copied .default-label) { display: none; }
	:global(.card .copy-btn.copied .copied-label) { display: inline; }
	:global(.card .popover .external-icon) {
		display: inline-block;
		width: 0.75rem;
		height: 0.75rem;
		margin-left: 0.35rem;
		vertical-align: -0.1em;
		background-color: currentColor;
		-webkit-mask: url('/shared/icons/external-link.svg') no-repeat center / contain;
		mask: url('/shared/icons/external-link.svg') no-repeat center / contain;
		opacity: 0.75;
	}
	:global(.card .links) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: 100%;
		max-width: 22rem;
	}
	:global(.card .links a) {
		display: block;
		padding: 0.7rem 1rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.6rem;
		color: white;
		text-decoration: none;
		text-align: center;
		font-size: 0.95rem;
		transition: background 0.2s ease, transform 0.15s ease;
	}
	:global(.card .links a:hover) {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
	}

	/* ===== Conventions de l'onglet « Détails » (users/[pseudo]/details.html) =====
	   Même logique que les styles ci-dessus : des défauts corrects pour les classes
	   usuelles, surchargeables via style.css. */
	/* Une <section> = un champ du formulaire : un libellé discret, puis le contenu
	   dans le même encadré de verre sombre que <textarea> / <input>. */
	:global(.card .details section) {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	:global(.card .details h2) {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 400;
		letter-spacing: 0.01em;
		color: rgba(255, 255, 255, 0.85);
	}
	/* Tout ce qui n'est pas le libellé forme le corps encadré de la section. */
	:global(.card .details section > :not(h2)) {
		padding: 0.7rem 0.85rem;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 0.55rem;
	}
	:global(.card .details p) {
		text-align: left;
	}
	/* Centres d'intérêt : rangée de pastilles. */
	:global(.card .tags) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	:global(.card .tags li) {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.3rem 0.7rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
		font-size: 0.8rem;
		color: rgba(255, 255, 255, 0.85);
	}
	:global(.card .tags li img) {
		width: 1rem;
		height: 1rem;
		object-fit: contain;
	}
	/* Infos clés : <dl> en deux colonnes, label discret / valeur lisible. */
	:global(.card .facts) {
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: 0.4rem 1.2rem;
		margin: 0;
		font-size: 0.9rem;
	}
	:global(.card .facts dt) {
		color: rgba(255, 255, 255, 0.45);
	}
	:global(.card .facts dd) {
		margin: 0;
		color: rgba(255, 255, 255, 0.9);
	}

	/* ===== Mobile / petits viewports =====
	   - Cache le <br /> au milieu de la quote (rendu bizarre sur écran étroit).
	   - Allège les effets visuels coûteux (backdrop-filter, animations de shadow)
	     qui font ramer la page sur GPU mobile. */
	@media (max-width: 1000px) {
		:global(.card .quote br) { display: none; }

		.card {
			/* blur 56 → 20 : moins joli mais drastiquement moins cher à composer */
			backdrop-filter: blur(20px);
			-webkit-backdrop-filter: blur(20px);
			max-width: 800px;
			will-change: auto;
			--card-pad-x: 1rem;
			--card-pad-top: 2rem;
			--card-pad-bottom: 1rem;
		}
		.pseudo,
		.pseudo .pseudo-text { animation: none; }
		:global(.card .social-link img) { animation: none; }

		.panel { gap: 1.2rem; }
		.details { max-width: 100%; }

		/* Le lien "vidéo d'origine" n'a plus de sens : à ≤1000px on bascule sur
		   l'image figée (cf. Background.svelte), il n'y a plus de vidéo à pointer. */
		.origin-link { display: none; }
	}

	/* Respect des préférences système (utilisateur ayant demandé moins de mouvement). */
	@media (prefers-reduced-motion: reduce) {
		.pseudo,
		.pseudo .pseudo-text { animation: none; }
		:global(.card .social-link img) { animation: none; }
		.card { transition: none; }
		.panels { transition: none; }
		.panel { animation: none; }
		.header-slot { transition: none; }
	}
</style>

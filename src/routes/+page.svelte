<script lang="ts">
	import { watchTabFavicon } from '$lib/favicon';

	const GITHUB_URL = 'https://github.com/aero-md';

	// Le favicon passe au gris quand l'onglet part en arrière-plan.
	$effect(watchTabFavicon);

	// Scope les overrides CSS de la home (cf. bloc style plus bas) via la classe `html.is-home`.
	// En SSR / full-load, la classe est posée par hooks.server.ts (transformPageChunk)
	// pour éviter tout FOUC au premier paint. Ici on la (ré)applique au mount et on la
	// retire au démontage : indispensable pour les navigations client-side (pas de
	// nouveau rendu SSR), idempotent avec la classe déjà posée par le serveur.
	$effect(() => {
		document.documentElement.classList.add('is-home');
		return () => document.documentElement.classList.remove('is-home');
	});

	// Braises générées de manière déterministe (pas d'aléa pour rester stable en SSR).
	// Chaque braise part du bas, dérive lentement vers le haut avec une légère bascule
	// horizontale + un changement de taille. Volontairement asymétrique pour casser
	// le côté "particules en grille".
	const embers = Array.from({ length: 26 }, (_, i) => {
		const a = ((i * 1103515245 + 12345) >>> 0) % 1000 / 1000;
		const b = ((i * 2654435761 + 7919) >>> 0) % 1000 / 1000;
		const c = ((i * 374761393 + 31) >>> 0) % 1000 / 1000;
		// Hue centrée sur le rouge pur (358°), fenêtre étroite ±8° pour rester
		// franchement rouge — pas de glissement vers le rose ou l'orange.
		const hue = Math.floor(354 + c * 14) % 360;
		return {
			left: a * 100,
			size: 1 + Math.floor(b * 5),
			duration: 9 + c * 14,
			delay: -(a * 18),
			drift: (b - 0.5) * 80,
			hue
		};
	});
</script>

<svelte:head>
	<title>redsunsbio</title>
	<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
</svelte:head>

<div class="bg" aria-hidden="true">
	<span class="sky"></span>
	<span class="sun"></span>
	<span class="horizon-line"></span>
	<div class="embers">
		{#each embers as e, i (i)}
			<span
				class="ember"
				style="left: {e.left}%; width: {e.size}px; height: {e.size}px; animation-duration: {e.duration}s; animation-delay: {e.delay}s; --drift: {e.drift}px; --hue: {e.hue};"
			></span>
		{/each}
	</div>
</div>

<div class="page">
	<header class="hero">
		<h1 class="title">yourname.bio</h1>

		<p class="tagline">
			Pages de profil personnalisées, your page, your style
		</p>

		<div class="url-preview" aria-hidden="true">
			<span class="url-base">yourname.bio/</span>
			<span class="url-slug">pseudo</span>
			<span class="url-cursor"></span>
		</div>
	</header>

	<section class="features" aria-label="Fonctionnalités">
		<article class="feature">
			<div class="feature-cell">
				<h3>Identité</h3>
				<p>Avatar, bio, liens sociaux. Mais aussi plus.</p>
			</div>
			<span class="feature-split" aria-hidden="true"></span>
			<div class="feature-cell">
				<h3>Ambiance</h3>
				<p>Fond image ou vidéo, musique d'ouverture optionnelle.</p>
			</div>
		</article>

		<article class="feature">
			<div class="feature-cell">
				<h3>Messages</h3>
				<p>Anonymes. Visibles uniquement par le titulaire de la page.</p>
			</div>
			<span class="feature-split" aria-hidden="true"></span>
			<div class="feature-cell">
				<h3>Passages</h3>
				<p>Chaque visite unique est comptée discrètement.</p>
			</div>
		</article>
	</section>

	<section class="self-host" aria-label="Infrastructure">
		<header class="self-host-head">
			<p class="self-host-kicker">infrastructure</p>
			<h2 class="self-host-title">Géré de bout en bout.</h2>
		</header>
		<div class="self-host-grid">
			<div class="self-host-item">
				<div class="self-host-num">01</div>
				<h4>Auto-hébergé</h4>
				<p>Infrastructure et code fait maison</p>
			</div>
			<div class="self-host-item">
				<div class="self-host-num">02</div>
				<h4>Sur demande</h4>
				<p>Pour créer votre page, demandez moi</p>
			</div>
			<a class="self-host-item self-host-link" href="/_example">
				<div class="self-host-num">03</div>
				<h4>Exemple</h4>
				<p>Démo : <code>/_example</code></p>
			</a>
		</div>
	</section>

	<footer class="foot">
		<a class="github" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
			<img src="/shared/github.png" alt="" aria-hidden="true" />
			<span>github.com/aero-md</span>
		</a>
	</footer>
</div>

<style>
	/* La page d'accueil rompt le layout "carte centrée" du reste du site :
	   on autorise le scroll et on aligne en haut. Le layout met `overflow: hidden`
	   sur html ET body — il faut override les deux. Le centrage flex vit sur #app
	   (cf. layout) — on l'aplatit ici pour laisser la page gérer son propre flux.
	   Les sélecteurs sont scopés via `html.is-home` : la classe est posée en SSR par
	   hooks.server.ts (route `/`) et (ré)appliquée/retirée côté client par le $effect
	   du <script>, ce qui évite que ces overrides leakent vers /[pseudo]. */
	:global(html.is-home),
	:global(html.is-home body) {
		overflow: auto;
	}
	:global(html.is-home body) {
		font-family: 'Space Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif;
	}
	:global(html.is-home #app) {
		justify-content: flex-start;
		align-items: stretch;
		padding: 0;
	}

	/* ===== Fond : horizon ===== */
	.bg {
		position: fixed;
		inset: 0;
		z-index: 0;
		overflow: hidden;
		background: #12030a;
	}
	/* Ciel : encore plus sombre. La bande d'horizon ressort par contraste. */
	.sky {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			180deg,
			#1c050f 0%,
			#320a18 28%,
			#561220 48%,
			#7e1626 60%,
			#3c0c16 68%,
			#10040a 100%
		);
		/* Variation lente et pseudo-aléatoire de la luminosité.
		   Keyframes désynchronisées (13/27/44/61/78/91%) pour casser le rythme
		   sinusoïdal — l'œil ne perçoit pas de cycle régulier. */
		animation: sky-flicker 22s ease-in-out infinite;
		will-change: filter;
	}
	@keyframes sky-flicker {
		0%   { filter: brightness(1);    }
		13%  { filter: brightness(0.94); }
		27%  { filter: brightness(1.04); }
		44%  { filter: brightness(0.97); }
		61%  { filter: brightness(1.02); }
		78%  { filter: brightness(0.93); }
		91%  { filter: brightness(1.01); }
		100% { filter: brightness(1);    }
	}
	/* Disque de soleil : rouge pur (favicon → tiré plus rouge), glow saturé. */
	.sun {
		position: absolute;
		left: 50%;
		top: 62%;
		width: 42vmax;
		height: 42vmax;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(255, 60, 80, 0.78) 0%,
			rgba(255, 16, 50, 0.45) 22%,
			rgba(255, 0, 40, 0.22) 42%,
			rgba(255, 0, 40, 0) 70%
		);
		filter: blur(28px);
		/* Période 19s, désynchronisée avec le sky-flicker (22s) — les deux cycles
		   ne se rattrappent jamais, ce qui amplifie l'effet pseudo-aléatoire. */
		animation: sun-breathe 19s ease-in-out infinite;
		will-change: transform, opacity;
	}
	@keyframes sun-breathe {
		0%   { opacity: 0.88; transform: translate(-50%, -50%) scale(1);    }
		11%  { opacity: 0.82; transform: translate(-50%, -50%) scale(0.97); }
		24%  { opacity: 0.97; transform: translate(-50%, -50%) scale(1.05); }
		39%  { opacity: 0.86; transform: translate(-50%, -50%) scale(0.99); }
		56%  { opacity: 1;    transform: translate(-50%, -50%) scale(1.06); }
		71%  { opacity: 0.84; transform: translate(-50%, -50%) scale(0.98); }
		88%  { opacity: 0.93; transform: translate(-50%, -50%) scale(1.03); }
		100% { opacity: 0.88; transform: translate(-50%, -50%) scale(1);    }
	}
	/* Trait fin et lumineux à l'horizon. */
	.horizon-line {
		position: absolute;
		left: 0;
		right: 0;
		top: 62%;
		height: 1px;
		background: linear-gradient(
			to right,
			transparent 0%,
			rgba(255, 200, 210, 0.0) 8%,
			rgba(255, 180, 195, 0.55) 35%,
			rgba(255, 220, 225, 0.8) 50%,
			rgba(255, 180, 195, 0.55) 65%,
			rgba(255, 200, 210, 0.0) 92%,
			transparent 100%
		);
		box-shadow: 0 0 24px rgba(255, 40, 70, 0.55);
	}
	/* Sol : nappe de braises qui montent depuis le bas, dérivent latéralement.
	   Tailles, vitesses et couleurs volontairement disparates pour donner un
	   sentiment organique plutôt que synthwave. */
	.embers {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
	}
	.ember {
		position: absolute;
		bottom: -2vh;
		border-radius: 50%;
		background: hsl(var(--hue, 28), 95%, 70%);
		box-shadow:
			0 0 6px hsla(var(--hue, 28), 95%, 60%, 0.85),
			0 0 14px hsla(var(--hue, 28), 95%, 55%, 0.4);
		animation-name: ember-rise;
		animation-timing-function: linear;
		animation-iteration-count: infinite;
		will-change: transform, opacity;
	}
	@keyframes ember-rise {
		0%   { transform: translate3d(0, 0, 0);                            opacity: 0; }
		8%   { opacity: 1; }
		60%  { transform: translate3d(calc(var(--drift) * 0.6), -55vh, 0); opacity: 0.8; }
		100% { transform: translate3d(var(--drift), -105vh, 0);            opacity: 0; }
	}

	/* ===== Layout page ===== */
	.page {
		position: relative;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 5.5rem;
		width: 100%;
		max-width: 1120px;
		margin: 0 auto;
		padding: 6rem 2rem 3rem;
	}

	/* ===== Hero ===== */
	.hero {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.6rem;
		text-align: center;
	}

	.title {
		margin: 0;
		font-family: 'Orbitron', 'Space Grotesk', system-ui, sans-serif;
		font-weight: 700;
		font-size: 5.6rem;
		line-height: 1;
		letter-spacing: 0.02em;
		/* Dégradé carmin : éclat clair en haut → carmin profond en bas.
		   background-clip: text + couleur transparente pour appliquer le gradient
		   aux glyphes eux-mêmes. */
		background: linear-gradient(
			180deg,
			#ff2840 0%,
			#ff0028 30%,
			#8a0014 78%,
			#42000a 100%
		);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		-webkit-text-fill-color: transparent;
		/* Profondeur : ombre portée multicouche pour décoller le glyphe du fond.
		   drop-shadow respecte le fill transparent (contrairement à text-shadow). */
		filter:
			drop-shadow(0 1px 0 rgba(30, 0, 6, 0.9))
			drop-shadow(0 3px 2px rgba(60, 0, 12, 0.7))
			drop-shadow(0 10px 24px rgba(120, 0, 20, 0.55));
	}

	.tagline {
		margin: 0;
		max-width: 38rem;
		font-size: 1.2rem;
		font-weight: 300;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.85);
	}

	.url-preview {
		--big: 14px;
		--small: 5px;
		position: relative;
		display: inline-flex;
		align-items: center;
		margin-top: 0.4rem;
		padding: 0.75rem 1.2rem;
		background: rgba(12, 4, 8, 0.82);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		clip-path: polygon(
			var(--big) 0,
			calc(100% - var(--small)) 0,
			100% var(--small),
			100% calc(100% - var(--big)),
			calc(100% - var(--big)) 100%,
			var(--small) 100%,
			0 calc(100% - var(--small)),
			0 var(--big)
		);
		filter: drop-shadow(0 0 40px rgba(255, 0, 40, 0.2));
		font-family: 'Orbitron', ui-monospace, 'Cascadia Code', monospace;
		font-weight: 400;
		font-size: 0.95rem;
		letter-spacing: 0.03em;
	}
	.url-base { color: rgba(255, 255, 255, 0.55); }
	.url-slug {
		color: #ff3a54;
		text-shadow: 0 0 12px rgba(255, 0, 40, 0.65);
	}
	.url-cursor {
		display: inline-block;
		width: 0.5rem;
		height: 1.05rem;
		margin-left: 0.2rem;
		background: #ff0028;
		vertical-align: -1px;
		box-shadow: 0 0 8px rgba(255, 0, 40, 0.8);
		animation: cursor-blink 1.1s steps(2) infinite;
	}
	@keyframes cursor-blink {
		0%, 50% { opacity: 1; }
		50.01%, 100% { opacity: 0; }
	}

	/* ===== Footer ===== */
	.foot {
		display: flex;
		justify-content: center;
		margin-top: -2rem;
	}
	.github {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.6rem 1.1rem;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.14);
		border-radius: 999px;
		color: rgba(255, 255, 255, 0.9);
		text-decoration: none;
		font-family: 'Space Grotesk', system-ui, sans-serif;
		font-size: 0.88rem;
		letter-spacing: 0.02em;
		transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
	}
	.github:hover {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 0, 40, 0.55);
		transform: translateY(-1px);
	}
	.github img {
		width: 1.1rem;
		height: 1.1rem;
		object-fit: contain;
		filter: brightness(0) invert(1);
	}

	/* ===== Features : strips en pilule (contrastent avec l'octogone du self-host). */
	.features {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.feature {
		display: flex;
		align-items: stretch;
		gap: 2rem;
		padding: 1.75rem 2.75rem;
		background: rgba(6, 2, 4, 0.82);
		backdrop-filter: blur(36px);
		-webkit-backdrop-filter: blur(36px);
		border: 1px solid rgba(255, 0, 40, 0.18);
		/* Stadium pill : les côtés courts deviennent des demi-cercles. */
		border-radius: 9999px;
		box-shadow:
			0 22px 50px rgba(15, 3, 8, 0.55),
			0 0 0 1px rgba(255, 255, 255, 0.03);
		transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
	}
	.feature:hover {
		transform: translateY(-2px);
		border-color: rgba(255, 0, 40, 0.36);
		box-shadow:
			0 28px 60px rgba(15, 3, 8, 0.6),
			0 0 24px rgba(255, 0, 40, 0.15);
	}
	.feature-cell {
		flex: 1 1 0;
		min-width: 0;
	}
	/* En layout horizontal, la 2e cellule s'aligne à droite — les deux points
	   regardent vers le séparateur central plutôt que vers la même direction. */
	.feature-cell:last-child {
		text-align: right;
	}
	.feature-cell h3 {
		margin: 0 0 0.45rem;
		font-family: 'Orbitron', 'Space Grotesk', sans-serif;
		font-size: 1rem;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.95);
	}
	.feature-cell p {
		margin: 0;
		font-size: 0.93rem;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.7);
	}
	/* Séparateur entre les deux cellules avec une LED au centre. */
	.feature-split {
		position: relative;
		flex-shrink: 0;
		width: 1px;
		background: linear-gradient(
			to bottom,
			transparent 0%,
			rgba(255, 0, 40, 0.5) 50%,
			transparent 100%
		);
	}
	.feature-split::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #ff2844;
		transform: translate(-50%, -50%);
		box-shadow:
			0 0 8px rgba(255, 0, 40, 1),
			0 0 16px rgba(255, 0, 40, 0.55);
	}

	/* ===== Self-host ===== */
	.self-host {
		--big: 44px;
		--small: 14px;
		position: relative;
		padding: 2.6rem 2.6rem 2.3rem;
		background:
			linear-gradient(135deg, rgba(255, 0, 40, 0.10) 0%, rgba(0, 0, 0, 0) 60%),
			rgba(6, 2, 4, 0.82);
		backdrop-filter: blur(36px);
		-webkit-backdrop-filter: blur(36px);
		/* Même grammaire que les cartes, à plus grande échelle. */
		clip-path: polygon(
			var(--big) 0,
			calc(100% - var(--small)) 0,
			100% var(--small),
			100% calc(100% - var(--big)),
			calc(100% - var(--big)) 100%,
			var(--small) 100%,
			0 calc(100% - var(--small)),
			0 var(--big)
		);
		filter:
			drop-shadow(0 38px 60px rgba(20, 4, 8, 0.6))
			drop-shadow(0 0 60px rgba(255, 0, 40, 0.16));
	}
	.self-host-head {
		margin-bottom: 2rem;
	}
	.self-host-kicker {
		margin: 0 0 0.5rem;
		font-family: 'Orbitron', sans-serif;
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #ff3a54;
		opacity: 0.9;
	}
	.self-host-title {
		margin: 0;
		font-family: 'Orbitron', 'Space Grotesk', sans-serif;
		font-weight: 500;
		font-size: 1.85rem;
		letter-spacing: 0.01em;
		line-height: 1.15;
		color: white;
	}
	.self-host-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1.5rem 2.25rem;
	}
	.self-host-item {
		padding-left: 0.9rem;
		border-left: 2px solid rgba(255, 0, 40, 0.55);
	}
	/* Item du milieu (desktop) : centré, barre rouge sous le texte. */
	.self-host-item:nth-child(2) {
		padding-left: 0;
		padding-bottom: 0.65rem;
		border-left: none;
		border-bottom: 2px solid rgba(255, 0, 40, 0.55);
		text-align: center;
	}
	.self-host-num {
		font-family: 'Orbitron', ui-monospace, monospace;
		font-size: 0.72rem;
		color: #ff3a54;
		letter-spacing: 0.14em;
		margin-bottom: 0.45rem;
	}
	.self-host-item h4 {
		margin: 0 0 0.35rem;
		font-family: 'Orbitron', 'Space Grotesk', sans-serif;
		font-size: 0.92rem;
		font-weight: 500;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: white;
	}
	.self-host-item p {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.65);
	}
	.self-host-link {
		display: block;
		text-decoration: none;
		color: inherit;
		text-align: right;
		/* Miroir du border-left des autres items pour absorber le vide
		   à droite de la dernière colonne. */
		padding-left: 0;
		padding-right: 0.9rem;
		border-left: none;
		border-right: 2px solid rgba(255, 0, 40, 0.55);
		transition: border-color 0.18s ease, transform 0.15s ease;
	}
	.self-host-link:hover {
		border-right-color: #ff4862;
		transform: translateX(-2px);
	}
	.self-host-link p code {
		padding: 0.05rem 0.35rem;
		border-radius: 0.25rem;
		background: rgba(255, 60, 90, 0.1);
		border: 1px solid rgba(255, 60, 90, 0.24);
		font-family: 'Orbitron', ui-monospace, monospace;
		font-size: 0.82em;
		letter-spacing: 0.04em;
		color: #ffa8b8;
	}

	/* ===== Tablette =====
	   Seuil 1000px aligné sur Background.svelte (video → image figée) pour cohérence :
	   au-delà de ce seuil on est en "mobile" — on coupe toutes les animations de fond
	   coûteuses (brightness filter sur dégradé plein écran, blur sur soleil, embers
	   en composition continue) et on masque les braises entièrement. */
	@media (max-width: 1000px) {
		.page {
			padding: 4rem 1.5rem 2.5rem;
			gap: 4rem;
		}
		.title { font-size: 4rem; }
		.self-host { padding: 2rem 1.75rem; }
		.self-host-title { font-size: 1.6rem; }

		.sky { animation: none; }
		.sun { animation: none; }
		.embers { display: none; }
	}

	/* ===== Mobile : tout en colonne, pensé pour le scroll vertical ===== */
	@media (max-width: 720px) {
		:global(html.is-home),
		:global(html.is-home body) {
			overflow-x: hidden;
		}
		.page {
			padding: 2.75rem 1.1rem 2.5rem;
			gap: 3rem;
		}
		.hero { gap: 1.25rem; }
		.title { font-size: 2.8rem; }
		.tagline { font-size: 1rem; }
		.url-preview { font-size: 0.85rem; padding: 0.6rem 1rem; }

		/* Strips features : les 2 cellules empilent verticalement, le divider
		   bascule à l'horizontale, et la pilule devient un rectangle arrondi. */
		.features {
			gap: 1rem;
		}
		.feature {
			flex-direction: column;
			gap: 1.4rem;
			padding: 1.6rem 1.75rem;
			border-radius: 1.75rem;
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
		}
		.feature-cell:last-child { text-align: left; }
		.feature-split {
			width: 100%;
			height: 1px;
			background: linear-gradient(
				to right,
				transparent 0%,
				rgba(255, 0, 40, 0.5) 50%,
				transparent 100%
			);
		}

		.self-host {
			--big: 32px;
			--small: 10px;
			padding: 1.85rem 1.5rem;
		}
		/* En colonne, les items 2 et 3 reprennent l'alignement gauche du premier. */
		.self-host-item:nth-child(2) {
			padding-left: 0.9rem;
			padding-bottom: 0;
			border-left: 2px solid rgba(255, 0, 40, 0.55);
			border-bottom: none;
			text-align: left;
		}
		.self-host-link {
			text-align: left;
			padding-left: 0.9rem;
			padding-right: 0;
			border-left: 2px solid rgba(255, 0, 40, 0.55);
			border-right: none;
		}
		.self-host-link:hover {
			border-left-color: #ff4862;
			border-right-color: transparent;
			transform: translateX(2px);
		}
		.self-host-head { margin-bottom: 1.5rem; }
		.self-host-title { font-size: 1.4rem; }
		.self-host-grid {
			grid-template-columns: 1fr;
			gap: 1.2rem;
		}

		/* Soleil légèrement agrandi/floutté sur petits viewports (visuel uniquement —
		   l'animation est déjà coupée par le bloc 1000px). */
		.sun {
			width: 60vmax;
			height: 60vmax;
			filter: blur(40px);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sky,
		.sun,
		.url-cursor {
			animation: none;
		}
		.ember { animation: none; opacity: 0.5; }
		.feature { transition: none; }
	}
</style>

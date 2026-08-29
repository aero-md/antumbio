<script lang="ts">
	// Fond intégré « horizon » : ciel dégradé qui vacille, soleil rouge qui respire,
	// trait d'horizon lumineux, braises qui montent du bas. Aucun asset à fournir —
	// c'est le fond hérité de l'ancienne page d'accueil, désormais disponible à
	// n'importe quelle page via `background: { "type": "horizon" }`.

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

<style>
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

	/* Seuil 1000px aligné sur Background.svelte (video → image figée) : au-delà on
	   est en "mobile", on coupe les animations coûteuses (filter sur un dégradé
	   plein écran, blur du soleil, braises en composition continue). */
	@media (max-width: 1000px) {
		.sky { animation: none; }
		.sun {
			animation: none;
			width: 60vmax;
			height: 60vmax;
			filter: blur(40px);
		}
		.embers { display: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		.sky,
		.sun { animation: none; }
		.ember { animation: none; opacity: 0.5; }
	}
</style>

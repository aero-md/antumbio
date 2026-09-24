<script lang="ts">
	import { untrack } from 'svelte';
	import type { MusicConfig } from '$lib/types';
	import { resolveAsset } from '$lib/path';

	interface Props {
		config: MusicConfig;
		assetBase: string;
		entered: boolean;
	}
	let { config, assetBase, entered }: Props = $props();

	// Atténuation globale : le slider va de 0 à 1, mais le volume réel appliqué est `slider * GAIN`.
	// Évite qu'une musique d'arrière-plan soit trop forte même slider au max.
	const VOLUME_GAIN = 0.3;

	let audio = $state<HTMLAudioElement | null>(null);
	let playing = $state(false);
	let currentTime = $state(0);
	let duration = $state(0);
	// true tant que l'utilisateur manipule le slider de progression.
	// Bloque la propagation de `timeupdate` pour qu'elle n'écrase pas la valeur en cours de drag/click.
	let scrubbing = $state(false);
	// volume = state indépendant initialisé depuis config, contrôlé ensuite par l'utilisateur.
	// svelte-ignore state_referenced_locally
	let volume = $state(config.volume ?? 0.4);
	let muted = $state(false);
	// Volume à 0 = silence, même sans avoir cliqué sur mute : l'icône doit le refléter.
	const isMuted = $derived(muted || volume === 0);

	const src = $derived(resolveAsset(assetBase, config.src));
	const thumb = $derived(config.thumbnail ? resolveAsset(assetBase, config.thumbnail) : null);

	$effect(() => {
		if (!audio) return;
		audio.volume = volume * VOLUME_GAIN;
		audio.muted = muted;
	});

	// Ramène `audio.volume` de sa valeur actuelle jusqu'à `target` en `duration` secondes.
	// Ne touche pas au state `volume` (le slider) : seul le volume réel de l'élément fade.
	function fadeVolumeIn(target: number, duration: number) {
		if (!audio) return;
		const start = performance.now();
		const startVol = audio.volume;
		function step(now: number) {
			if (!audio) return;
			const t = Math.min(1, (now - start) / (duration * 1000));
			audio.volume = startVol + (target - startVol) * t;
			if (t < 1) requestAnimationFrame(step);
		}
		requestAnimationFrame(step);
	}

	// Ne doit tourner qu'à l'entrée (audio prêt + entered), jamais en réaction à un
	// changement de volume derrière : `volume` est donc lu via `untrack` pour ne
	// pas devenir une dépendance de l'effet (sinon chaque geste sur le slider
	// reseekait à `startAt` et relançait play()).
	$effect(() => {
		if (!audio || !entered) return;
		if (config.autoplay !== false) {
			if (config.startAt) audio.currentTime = config.startAt;
			const fadeIn = config.fadeIn ?? 0;
			const target = untrack(() => volume) * VOLUME_GAIN;
			if (fadeIn > 0) audio.volume = 0;
			audio.play().then(() => {
				playing = true;
				if (fadeIn > 0) fadeVolumeIn(target, fadeIn);
			}).catch(() => (playing = false));
		}
	});

	function toggle() {
		if (!audio) return;
		if (audio.paused) audio.play().then(() => (playing = true));
		else { audio.pause(); playing = false; }
	}

	function fmt(s: number): string {
		if (!isFinite(s) || s < 0) return '0:00';
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60).toString().padStart(2, '0');
		return `${m}:${sec}`;
	}

	function onScrubInput(e: Event) {
		// Pendant le drag (ou un click), on suit la position du slider sans appliquer le seek
		// pour ne pas saccader l'audio à chaque event intermédiaire.
		scrubbing = true;
		currentTime = Number((e.target as HTMLInputElement).value);
	}

	function onScrubChange(e: Event) {
		// Au release, on applique le seek réel.
		const v = Number((e.target as HTMLInputElement).value);
		if (audio) audio.currentTime = v;
		currentTime = v;
		scrubbing = false;
	}
</script>

<audio
	bind:this={audio}
	{src}
	loop={config.loop ?? true}
	preload="metadata"
	ontimeupdate={(e) => {
		if (scrubbing) return;
		currentTime = (e.target as HTMLAudioElement).currentTime;
	}}
	onloadedmetadata={(e) => (duration = (e.target as HTMLAudioElement).duration)}
	onplay={() => (playing = true)}
	onpause={() => (playing = false)}
></audio>

{#snippet playPauseIcon()}
	{#if playing}
		<svg class="pp-svg" viewBox="0 0 24 24" aria-hidden="true">
			<rect x="6" y="5" width="4" height="14" rx="1" />
			<rect x="14" y="5" width="4" height="14" rx="1" />
		</svg>
	{:else}
		<svg class="pp-svg" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M7 5v14l12-7z" />
		</svg>
	{/if}
{/snippet}

{#snippet soundIcon()}
	{#if isMuted}
		<svg class="ico-svg ico-svg-muted" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
		</svg>
	{:else}
		<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
		</svg>
	{/if}
{/snippet}

<div class="player">
	{#if thumb}
		<div class="thumb-wrap">
			<img class="thumb" src={thumb} alt={config.title ?? 'cover'} />
			<button
				class="thumb-overlay"
				onclick={toggle}
				type="button"
				aria-label={playing ? 'Pause' : 'Play'}
			>
				{@render playPauseIcon()}
			</button>
		</div>
	{/if}
	<div class="meta">
		<div class="controls">
			{#if config.title}
				{#if config.link}
					<a class="title" href={config.link} target="_blank" rel="noopener noreferrer">{config.title}</a>
				{:else}
					<span class="title">{config.title}</span>
				{/if}
			{/if}
			<span class="time time-current">{fmt(currentTime)}</span>
			<span class="time-sep" aria-hidden="true">/</span>
			<span class="time time-total">{fmt(duration)}</span>
			<input
				type="range"
				class="progress"
				min="0"
				max={duration || 0}
				step="0.1"
				value={currentTime}
				oninput={onScrubInput}
				onchange={onScrubChange}
				aria-label="Progress"
			/>
			<div class="vol">
				<button
					class="sound-icon"
					onclick={() => (muted = !muted)}
					type="button"
					aria-label={isMuted ? 'Unmute' : 'Mute'}
					aria-pressed={isMuted}
				>
					{@render soundIcon()}
				</button>
				<input
					type="range"
					class="sound-slider"
					min="0"
					max="1"
					step="0.01"
					bind:value={volume}
					aria-label="Volume"
				/>
			</div>
		</div>
	</div>
	<button
		class="play-btn-mobile"
		onclick={toggle}
		type="button"
		aria-label={playing ? 'Pause' : 'Play'}
	>
		{@render playPauseIcon()}
	</button>
</div>

<style>
	/* Forme pillule (cohérente avec .pseudo-header de la page). Pas d'overflow
	   hidden : rien ne doit être clippé par le radius, donc la thumb est ronde
	   (elle s'emboîte dans le cap gauche) et le padding droit est élargi pour que
	   titre/contrôles restent en dedans de la courbe du cap droit. */
	.player {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.55rem;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		border-radius: 999px;
		color: white;
		font-size: 0.85rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
	}
	.thumb-wrap {
		position: relative;
		flex-shrink: 0;
		width: 48px;
		height: 48px;
	}
	.thumb {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
		display: block;
	}
	.thumb-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease, background 0.15s ease;
		padding: 0;
	}
	.thumb-overlay:hover { background: rgba(0, 0, 0, 0.7); }
	.player:hover .thumb-overlay {
		opacity: 1;
		pointer-events: auto;
	}
	.pp-svg {
		width: 1.3rem;
		height: 1.3rem;
		fill: currentColor;
		display: block;
	}
	.meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	/* Le titre et la barre de contrôles partagent la même grille (2 lignes) : le
	   titre occupe uniquement la colonne 'prog', donc se centre exactement sur la
	   barre de progression plutôt que sur toute la largeur du player. */
	.title {
		grid-area: title;
		min-width: 0;
		text-align: center;
		color: white;
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	a.title:hover { text-decoration: underline; }

	/* Desktop : grid 2 lignes — [.][titre][.][.] / [curr][progress][total][vol]. */
	.controls {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		grid-template-rows: auto auto;
		grid-template-areas:
			'.    title .     .  '
			'curr prog  total vol';
		align-items: center;
		gap: 0.3rem 0.45rem;
		/* Marge en plus du padding de .player, pour que le slider de volume respire
		   avant la courbe du cap droit de la pillule. */
		padding-right: 0.35rem;
	}
	.time-current { grid-area: curr; }
	.progress { grid-area: prog; min-width: 0; accent-color: var(--accent, #ff2040); }
	.time-total { grid-area: total; }
	.time-sep { display: none; }
	.time {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
		font-size: 0.72rem;
	}

	/* Icône + slider de volume, en petit, dans la barre de contrôles — toujours
	   visibles, pas de popup au survol. */
	.vol {
		grid-area: vol;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
		/* +gap 0.45rem du parent = 0.75rem, identique au gap de .player, pour que
		   l'icône respire un peu par rapport au temps total. */
		margin-left: 0.3rem;
	}
	.sound-slider {
		width: 3.5rem;
		accent-color: var(--accent, #ff2040);
	}
	.sound-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		color: inherit;
	}
	/* SVG inline plutôt qu'un masque CSS sur un span : le masque (mask-size: contain
	   + mask-position: center) recale son layer sur des dimensions arrondies au
	   pixel et introduit un décalage vertical perceptible. Une vraie <svg>, comme
	   pour .pp-svg, se centre exactement via le flex du bouton parent. */
	.sound-icon .ico-svg {
		width: 1rem;
		height: 1rem;
		fill: currentColor;
		display: block;
		opacity: 0.75;
		transition: opacity 0.15s ease;
	}
	.sound-icon:hover .ico-svg { opacity: 1; }
	.sound-icon .ico-svg-muted { opacity: 0.55; }

	/* Bouton play/pause mobile : même gabarit que la thumb (48px), symétrique à
	   l'autre bout de la pillule. Cachée sur desktop (hover sur la thumb + barre
	   suffisent), affichée en mobile où il n'y a pas de hover fiable. */
	.play-btn-mobile {
		display: none;
		flex-shrink: 0;
		width: 48px;
		height: 48px;
		align-items: center;
		justify-content: center;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 50%;
		color: white;
		cursor: pointer;
		padding: 0;
	}

	/* Mobile : timer scindé en deux, curr à gauche du titre et total à droite —
	   même principe que le desktop, le titre reste centré sur la colonne du milieu,
	   qui est aussi celle de la barre de progression juste en dessous. Pas de
	   contrôle de volume (le volume matériel du téléphone fait le job) ; le
	   play/pause passe de la barre à un gros bouton à droite. */
	@media (max-width: 600px) {
		.controls {
			grid-template-columns: auto 1fr auto;
			grid-template-areas:
				'curr title total'
				'prog prog  prog ';
			padding-inline: 0.25rem;
		}
		.vol { display: none; }
		.play-btn-mobile { display: flex; }
		/* Pas de hover fiable sur mobile : la fonction play/pause de la thumb est
		   inutilisable, autant la retirer (le gros bouton à droite fait le job). */
		.thumb-overlay { display: none; }
	}
</style>
<script lang="ts">
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

	const src = $derived(resolveAsset(assetBase, config.src));
	const thumb = $derived(config.thumbnail ? resolveAsset(assetBase, config.thumbnail) : null);

	$effect(() => {
		if (!audio) return;
		audio.volume = volume * VOLUME_GAIN;
		audio.muted = muted;
	});

	$effect(() => {
		if (!audio || !entered) return;
		if (config.autoplay !== false) {
			audio.play().then(() => (playing = true)).catch(() => (playing = false));
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
		{#if config.title}
			{#if config.link}
				<a class="title" href={config.link} target="_blank" rel="noopener noreferrer">{config.title}</a>
			{:else}
				<span class="title">{config.title}</span>
			{/if}
		{/if}
		<div class="controls">
			<button
				class="play-btn"
				onclick={toggle}
				type="button"
				aria-label={playing ? 'Pause' : 'Play'}
			>
				{@render playPauseIcon()}
			</button>
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
					class="ico-btn"
					onclick={() => (muted = !muted)}
					type="button"
					aria-label={muted ? 'Unmute' : 'Mute'}
					aria-pressed={muted}
				>
					<span class="ico" class:muted aria-hidden="true"></span>
				</button>
				<input
					type="range"
					min="0"
					max="1"
					step="0.01"
					bind:value={volume}
					aria-label="Volume"
				/>
			</div>
		</div>
	</div>
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
		padding: 0.55rem 1.4rem 0.55rem 0.55rem;
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
	.title {
		color: white;
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	a.title:hover { text-decoration: underline; }

	/* Desktop : grid 1 ligne — [curr] [progress] [total] [vol]. play-btn et time-sep cachés. */
	.controls {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		grid-template-areas: 'curr prog total vol';
		align-items: center;
		gap: 0.45rem;
	}
	.time-current { grid-area: curr; }
	.progress { grid-area: prog; min-width: 0; accent-color: var(--accent, #ff2040); }
	.time-total { grid-area: total; }
	.vol { grid-area: vol; }
	.play-btn { display: none; }
	.time-sep { display: none; }
	.time {
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
		font-size: 0.72rem;
	}
	.play-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		cursor: pointer;
		color: inherit;
		align-items: center;
		justify-content: center;
	}
	.play-btn .pp-svg {
		width: 1.1rem;
		height: 1.1rem;
		opacity: 0.85;
		transition: opacity 0.15s ease;
	}
	.play-btn:hover .pp-svg { opacity: 1; }
	.vol {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-shrink: 0;
		margin-left: 0.3rem; /* +gap 0.45rem du parent = 0.75rem, identique à .player gap */
	}
	.vol .ico-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		color: inherit;
	}
	.vol .ico {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		opacity: 0.75;
		background-color: currentColor;
		-webkit-mask: url('/shared/icons/volume.svg') no-repeat center / contain;
		mask: url('/shared/icons/volume.svg') no-repeat center / contain;
		transition: opacity 0.15s ease;
	}
	.vol .ico-btn:hover .ico { opacity: 1; }
	.vol .ico.muted {
		-webkit-mask: url('/shared/icons/volume-off.svg') no-repeat center / contain;
		mask: url('/shared/icons/volume-off.svg') no-repeat center / contain;
		opacity: 0.55;
	}
	.vol input[type='range'] {
		width: 3.5rem;
		accent-color: var(--accent, #ff2040);
	}

	/* Mobile : 2 lignes — [play] [curr / total] [vol] sur la 1re,
	   [progress pleine largeur] sur la 2e. L'overlay play/pause de la thumb
	   est désactivé (moins utile au tap qu'un bouton dédié). */
	@media (max-width: 600px) {
		/* Le layout 2 lignes rend le player plus haut → caps de la pillule plus
		   larges. Sans ce padding, la barre de progression (pleine largeur, rangée
		   du bas) déborderait de la courbe aux coins inférieurs. */
		.player {
			padding-inline: 1.1rem;
		}
		.controls {
			grid-template-columns: auto auto auto auto 1fr minmax(0, auto);
			grid-template-rows: auto auto;
			grid-template-areas:
				'play curr sep total .   vol'
				'prog prog prog prog prog prog';
			gap: 0.3rem 0.4rem;
			/* Marge interne pour que track + thumb des range inputs ne touchent
			   pas le bord du container (le rendu UA déborde de la box CSS). */
			padding-inline: 0.25rem;
		}
		.play-btn {
			display: inline-flex;
			grid-area: play;
		}
		.time-sep {
			display: inline;
			grid-area: sep;
			opacity: 0.5;
			font-size: 0.72rem;
		}
		.thumb-overlay { display: none; }
		.vol {
			min-width: 0;
		}
		.vol input[type='range'] {
			width: 100%;
			max-width: 5rem;
			min-width: 0;
		}
	}
</style>

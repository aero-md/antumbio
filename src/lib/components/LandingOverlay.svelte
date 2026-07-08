<script lang="ts">
	// `leaving` est piloté par le parent : il bascule à true au clic, déclenche
	// le fade-out (0.5s), pendant que la page fade-in en parallèle. Le parent
	// démonte ensuite l'overlay après la durée du fade.
	interface Props {
		text?: string;
		icon?: string;
		leaving?: boolean;
		onEnter: () => void;
	}
	let { text = 'click to enter', icon, leaving = false, onEnter }: Props = $props();

	function handleClick() {
		if (leaving) return;
		onEnter();
	}
</script>

<button class="overlay" class:leaving onclick={handleClick} type="button" aria-label="Enter">
	<div class="stack" class:has-icon={!!icon}>
		{#if icon}
			<img class="icon" src={icon} alt="" aria-hidden="true" />
			<span class="separator" aria-hidden="true"></span>
		{/if}
		<span class="text">{text}</span>
		{#if icon}
			<span class="separator" aria-hidden="true"></span>
		{/if}
	</div>
</button>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		cursor: pointer;
		z-index: 100;
		border: none;
		color: inherit;
		font: inherit;
		transition: opacity 0.5s ease;
	}
	.overlay.leaving {
		opacity: 0;
		pointer-events: none;
	}
	.stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4rem;
	}
	/* Recentrage réservé au cas avec icône : le milieu visuel se trouve dans le gap
	   entre le bas de l'icône et le séparateur supérieur du « click to enter ».
	   Calcul : (text + 2·gap + 2·sep − icon) / 2 ≈ -3.7rem
	   (icon 12.1rem, text 1.44rem·1.2lh, gap 1.4rem).
	   Sans icône, le stack n'a que le texte → on le laisse centré (pas de transform). */
	.stack.has-icon {
		transform: translateY(-3.7rem);
	}
	.icon {
		width: 12.1rem;
		height: 12.1rem;
		object-fit: contain;
		/* Glow multi-couches en CSS pur. drop-shadow suit l'alpha du SVG, donc
		   le halo épouse la forme du logo plutôt qu'un rectangle. */
		filter:
			drop-shadow(0 0 6px rgba(255, 255, 255, 0.55))
			drop-shadow(0 0 18px rgba(255, 255, 255, 0.35))
			drop-shadow(0 0 38px rgba(255, 255, 255, 0.18));
		animation: icon-glow 3.2s ease-in-out infinite;
	}
	@keyframes icon-glow {
		0%, 100% {
			filter:
				drop-shadow(0 0 6px rgba(255, 255, 255, 0.5))
				drop-shadow(0 0 18px rgba(255, 255, 255, 0.3))
				drop-shadow(0 0 38px rgba(255, 255, 255, 0.15));
		}
		50% {
			filter:
				drop-shadow(0 0 10px rgba(255, 255, 255, 0.75))
				drop-shadow(0 0 28px rgba(255, 255, 255, 0.45))
				drop-shadow(0 0 56px rgba(255, 255, 255, 0.25));
		}
	}
	/* Trait fin avec dégradé qui s'éteint sur les bords + halo lumineux. */
	.separator {
		width: 14rem;
		height: 1px;
		background: linear-gradient(
			to right,
			transparent 0%,
			rgba(255, 255, 255, 0.65) 50%,
			transparent 100%
		);
		box-shadow: 0 0 12px rgba(255, 255, 255, 0.35);
	}
	.text {
		color: white;
		font-family: 'Cormorant Garamond', 'Cormorant', Georgia, 'Times New Roman', serif;
		font-size: 1.44rem;
		font-weight: 600;
		letter-spacing: 0.15em;
		text-shadow: 0 0 12px rgba(0, 0, 0, 0.8);
		animation: pulse 1.6s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 0.7; }
		50% { opacity: 1; }
	}
</style>

<script lang="ts">
	let { children } = $props();
</script>

{@render children?.()}

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		min-height: 100%;
		background: #000;
		color: #fff;
		font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
		overflow: hidden;
	}
	/* Centrage flex porté par le wrapper #app (défini dans app.html), pas par body.
	   Évite le bug `display: contents` du wrapper SvelteKit qui causait, au premier
	   paint sur mobile, un FOUC où le container apparaissait mal positionné. */
	:global(#app) {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 1rem;
		perspective: 1400px;
	}
	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}
</style>

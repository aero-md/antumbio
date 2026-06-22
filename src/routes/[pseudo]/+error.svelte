<script lang="ts">
	import { page } from '$app/state';
</script>

<main>
	<h1>{page.status}</h1>
	<p>{page.error?.message ?? 'Unknown error'}</p>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: white;
		background: #000;
	}
	h1 {
		font-size: 4rem;
		margin: 0;
		opacity: 0.6;
	}
	p { opacity: 0.7; }
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { BackgroundConfig } from '$lib/types';
	import { resolveAsset } from '$lib/path';

	interface Props {
		config: BackgroundConfig | undefined;
		assetBase: string;
	}
	let { config, assetBase }: Props = $props();

	// On rend l'image statique au SSR par défaut, et on swap vers la vidéo
	// seulement après hydratation si on n'est pas sur mobile. Ainsi la vidéo
	// n'est jamais téléchargée ni décodée sur mobile.
	let mounted = $state(false);
	let isMobile = $state(false);

	onMount(() => {
		const mq = window.matchMedia('(max-width: 1000px)');
		isMobile = mq.matches;
		mounted = true;
		const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	const resolved = $derived.by(() => {
		if (!config) return null;
		if (config.type === 'color') return { ...config };
		return { ...config, src: resolveAsset(assetBase, config.src) };
	});

	const mobileStaticSrc = $derived.by(() => {
		if (!config || config.type === 'color') return null;
		if (!config.mobileSrc) return null;
		return resolveAsset(assetBase, config.mobileSrc);
	});

	// Utilisé pendant le SSR / avant hydratation, et tant qu'on est sur mobile.
	const useMobileStatic = $derived(!!mobileStaticSrc && (!mounted || isMobile));
</script>

{#if resolved}
	{#if useMobileStatic}
		<div class="bg bg-static" style:background-image={`url(${mobileStaticSrc})`}></div>
		{#if resolved.type !== 'color' && resolved.dim}
			<div class="dim" style:opacity={resolved.dim}></div>
		{/if}
	{:else if resolved.type === 'color'}
		<div class="bg" style:background-color={resolved.color}></div>
	{:else if resolved.type === 'image'}
		<div
			class="bg"
			style:background-image={`url(${resolved.src})`}
			style:filter={resolved.blur ? `blur(${resolved.blur}px)` : null}
		></div>
		{#if resolved.dim}
			<div class="dim" style:opacity={resolved.dim}></div>
		{/if}
	{:else if resolved.type === 'video'}
		<video
			class="bg"
			src={resolved.src}
			autoplay
			loop
			muted
			playsinline
			style:filter={resolved.blur ? `blur(${resolved.blur}px)` : null}
			style:transform={resolved.blur ? `scale(${1 + resolved.blur * 0.015})` : null}
		></video>
		{#if resolved.dim}
			<div class="dim" style:opacity={resolved.dim}></div>
		{/if}
	{/if}
{/if}

<style>
	.bg {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		background-size: cover;
		background-position: center;
		z-index: 0;
	}
	.dim {
		position: fixed;
		inset: 0;
		background: #000;
		z-index: 1;
		pointer-events: none;
	}
</style>

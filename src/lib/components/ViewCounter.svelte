<script lang="ts">
	import { onMount } from 'svelte';
	import { getVisitorId } from '$lib/fingerprint';

	interface Props {
		pseudo: string;
		// Masqué pendant l'overlay "click to enter", fade-in après le clic.
		entered?: boolean;
		// Permet au parent d'incrémenter le compteur de commentaires
		// quand un commentaire est posté, sans refetch.
		setApi?: (api: { incrementComments: () => void }) => void;
	}
	let { pseudo, entered = true, setApi }: Props = $props();

	let count = $state<number | null>(null);
	let commentCount = $state<number | null>(null);

	onMount(() => {
		setApi?.({
			incrementComments() {
				if (commentCount !== null) commentCount += 1;
				else commentCount = 1;
			}
		});

		(async () => {
			try {
				const visitorId = await getVisitorId();
				const res = await fetch('/api/stats', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ pseudo, visitorId })
				});
				if (res.ok) {
					const data = (await res.json()) as { count: number; commentCount: number };
					count = data.count;
					commentCount = data.commentCount;
				}
			} catch {
				// silencieux : pas critique si le compteur échoue
			}
		})();
	});
</script>

<div class="counter" class:entered>
	<span class="metric" title="vues uniques">
		<span class="icon" aria-hidden="true">👁</span>
		<span class="value">{count ?? '—'}</span>
	</span>
	<span class="sep" aria-hidden="true"></span>
	<span class="metric" title="messages">
		<span class="icon" aria-hidden="true">💬</span>
		<span class="value">{commentCount ?? '—'}</span>
	</span>
</div>

<style>
	.counter {
		position: fixed;
		top: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.4rem 0.8rem;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(8px);
		border-radius: 999px;
		color: white;
		font-size: 0.85rem;
		z-index: 10;
		font-variant-numeric: tabular-nums;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.5s ease;
	}
	.counter.entered {
		opacity: 1;
		pointer-events: auto;
	}
	.metric {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}
	.icon { opacity: 0.7; }
	.sep {
		width: 1px;
		height: 0.9rem;
		background: rgba(255, 255, 255, 0.2);
	}
</style>

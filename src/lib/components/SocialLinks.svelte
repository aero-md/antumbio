<script lang="ts">
	import type { SocialLinkConfig } from '$lib/types';

	interface Props {
		socials: SocialLinkConfig[];
	}
	let { socials }: Props = $props();

	const DEFAULT_ICON = '/shared/default.png';
	const FEEDBACK_MS = 1500;

	let copiedIdx = $state<number | null>(null);
	let resetTimer: ReturnType<typeof setTimeout> | null = null;

	function iconSrc(s: SocialLinkConfig): string {
		return s.icon ?? `/shared/${s.name}.png`;
	}

	function onIconError(e: Event) {
		const img = e.currentTarget as HTMLImageElement;
		if (!img.src.endsWith(DEFAULT_ICON)) img.src = DEFAULT_ICON;
	}

	async function copyAt(idx: number, text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// silencieux : feedback visuel quand même
		}
		copiedIdx = idx;
		if (resetTimer) clearTimeout(resetTimer);
		resetTimer = setTimeout(() => (copiedIdx = null), FEEDBACK_MS);
	}
</script>

{#if socials && socials.length > 0}
	<hr class="separator" />
	<div class="socials">
		{#each socials as s, i (s.name + i)}
			{#if s.url}
				<a
					class="social-link"
					href={s.url}
					target="_blank"
					rel="noopener noreferrer"
					aria-label={s.label ?? s.name}
				>
					<img src={iconSrc(s)} alt="" onerror={onIconError} />
					<span class="popover">
						{s.label ?? s.name}<span class="external-icon" aria-hidden="true"></span>
					</span>
				</a>
			{:else if s.copy}
				<button
					class="social-link copy-btn"
					class:copied={copiedIdx === i}
					type="button"
					onclick={() => copyAt(i, s.copy!)}
					aria-label={`Copier ${s.label ?? s.copy}`}
				>
					<img src={iconSrc(s)} alt="" onerror={onIconError} />
					<span class="popover">
						<span class="default-label">{s.label ?? s.copy}</span>
						<span class="copied-label">copié</span>
					</span>
				</button>
			{/if}
		{/each}
	</div>
	<hr class="separator" />
{/if}

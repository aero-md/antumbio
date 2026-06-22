<script lang="ts">
	import { getVisitorId } from '$lib/fingerprint';

	interface Props {
		pseudo: string;
		onCancel: () => void;
		onSubmitted: () => void;
		onAlreadyCommented: () => void;
	}
	let { pseudo, onCancel, onSubmitted, onAlreadyCommented }: Props = $props();

	const MAX_CONTENT = 512;
	const MAX_SIGNATURE = 32;

	let content = $state('');
	let signature = $state('');
	let submitting = $state(false);
	let errorMsg = $state<string | null>(null);

	const trimmedLen = $derived(content.trim().length);
	const canSubmit = $derived(
		!submitting && trimmedLen > 0 && content.length <= MAX_CONTENT && signature.length <= MAX_SIGNATURE
	);

	async function submit() {
		if (!canSubmit) return;
		submitting = true;
		errorMsg = null;
		try {
			const visitorId = await getVisitorId();
			const res = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pseudo,
					visitorId,
					content: content.trim(),
					signature: signature.trim()
				})
			});
			if (res.ok) {
				onSubmitted();
				return;
			}
			if (res.status === 409) {
				// Serveur dit non : fingerprint déjà connu. On ferme le form
				// et on désactive le bouton via le parent.
				onAlreadyCommented();
				return;
			}
			errorMsg = 'Impossible d’envoyer le commentaire.';
		} catch {
			errorMsg = 'Erreur réseau.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="form">
	<label class="field">
		<span class="label-row">
			<span>Votre commentaire</span>
			<span class="counter" class:over={content.length > MAX_CONTENT}>
				{content.length}/{MAX_CONTENT}
			</span>
		</span>
		<textarea
			class="content"
			rows="8"
			maxlength={MAX_CONTENT}
			placeholder="Écrivez votre commentaire…"
			bind:value={content}
			disabled={submitting}
		></textarea>
	</label>

	<label class="field signature-field">
		<span class="label-row">
			<span>Signature <em>(optionnel)</em></span>
			<span class="counter" class:over={signature.length > MAX_SIGNATURE}>
				{signature.length}/{MAX_SIGNATURE}
			</span>
		</span>
		<input
			class="signature"
			type="text"
			maxlength={MAX_SIGNATURE}
			placeholder="anonyme"
			bind:value={signature}
			disabled={submitting}
		/>
	</label>

	{#if errorMsg}
		<p class="error" role="alert">{errorMsg}</p>
	{/if}

	<div class="actions">
		<button type="button" class="btn cancel" onclick={onCancel} disabled={submitting}>
			annuler
		</button>
		<button type="button" class="btn validate" onclick={submit} disabled={!canSubmit}>
			{submitting ? 'envoi…' : 'valider'}
		</button>
	</div>
</div>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 40rem;
		margin: 0 auto;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.85);
		text-align: left;
	}
	.label-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
	}
	.label-row em {
		font-style: italic;
		opacity: 0.65;
		font-size: 0.78rem;
	}
	.counter {
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		opacity: 0.7;
	}
	.counter.over { color: #ff7a7a; opacity: 1; }

	.content,
	.signature {
		width: 100%;
		padding: 0.7rem 0.85rem;
		background: rgba(0, 0, 0, 0.45);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 0.55rem;
		color: white;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.45;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.content {
		min-height: 8rem;
		font-family: inherit;
		resize: none;
	}
	.content:focus,
	.signature:focus {
		outline: none;
		border-color: rgba(255, 255, 255, 0.45);
		background: rgba(0, 0, 0, 0.6);
	}
	.content:disabled,
	.signature:disabled { opacity: 0.6; cursor: not-allowed; }

	.error {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: rgba(180, 40, 40, 0.25);
		border: 1px solid rgba(255, 120, 120, 0.4);
		border-radius: 0.4rem;
		color: #ffd5d5;
		font-size: 0.85rem;
		text-align: center;
	}

	.actions {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}
	.btn {
		flex: 1;
		padding: 0.6rem 1rem;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 0.5rem;
		color: white;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background 0.15s ease, transform 0.1s ease, border-color 0.15s ease;
	}
	.btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.15);
		transform: translateY(-1px);
	}
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn.validate {
		background: rgba(255, 255, 255, 0.18);
		border-color: rgba(255, 255, 255, 0.35);
	}
	.btn.validate:hover:not(:disabled) { background: rgba(255, 255, 255, 0.28); }
</style>

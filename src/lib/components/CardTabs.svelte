<script lang="ts" module>
	export interface Tab {
		id: string;
		label: string;
	}
</script>

<script lang="ts">
	interface Props {
		tabs: Tab[];
		active: string;
		onSelect: (id: string) => void;
	}
	let { tabs, active, onSelect }: Props = $props();

	// Roving tabindex : un seul bouton dans l'ordre de tabulation, les flèches
	// déplacent la sélection (pattern ARIA « tabs with automatic activation »).
	let btns: HTMLButtonElement[] = $state([]);

	function onKeyDown(e: KeyboardEvent, index: number) {
		let next: number;
		switch (e.key) {
			case 'ArrowLeft':
				next = (index - 1 + tabs.length) % tabs.length;
				break;
			case 'ArrowRight':
				next = (index + 1) % tabs.length;
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = tabs.length - 1;
				break;
			default:
				return;
		}
		e.preventDefault();
		onSelect(tabs[next].id);
		btns[next]?.focus();
	}
</script>

<!-- <div> et pas <nav> : `role="tablist"` sur un élément déjà sémantique déclenche
     a11y_no_noninteractive_element_to_interactive_role. -->
<div class="tabs" role="tablist" aria-label="Sections de la page">
	{#each tabs as tab, i (tab.id)}
		<button
			bind:this={btns[i]}
			type="button"
			role="tab"
			class="tab"
			class:active={tab.id === active}
			id={`tab-${tab.id}`}
			aria-controls={`panel-${tab.id}`}
			aria-selected={tab.id === active}
			tabindex={tab.id === active ? 0 : -1}
			onclick={() => onSelect(tab.id)}
			onkeydown={(e) => onKeyDown(e, i)}
		>
			{tab.label}
		</button>
	{/each}
</div>

<style>
	/* Bloc centré, dimensionné par son contenu, assis sur le bord bas de la carte :
	   arrondi en haut seulement, ouvert en bas. Pas de fond propre — seul l'onglet
	   actif se remplit ; le découpage se lit aux séparations. */
	.tabs {
		display: inline-flex;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-bottom: none;
		border-radius: 0.85rem 0.85rem 0 0;
		/* clippe le fond de l'onglet actif sur les deux angles arrondis */
		overflow: hidden;
	}
	/* Tenor Sans : display humaniste à un seul gras, tracé fin et proportions ouvertes
	   — élégant sans être décoratif. En petites capitales (`all-small-caps` couvre
	   aussi les labels écrits en minuscules), largement interlettré. */
	.tab {
		padding: 0.5rem 1.4rem;
		border: none;
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		background: transparent;
		/* 0.5 était trop bas : les traits de Tenor Sans font moins d'un pixel à cette
		   taille, et à mi-opacité l'antialiasing les dissout complètement. */
		color: rgba(255, 255, 255, 0.62);
		font-family: 'Tenor Sans', 'Space Grotesk', system-ui, sans-serif;
		font-weight: 400;
		/* les petites capitales rendent plus petit que le corps nominal — d'où un
		   corps un peu au-dessus de ce qu'on prendrait en bas-de-casse */
		font-size: 0.95rem;
		font-variant: all-small-caps;
		letter-spacing: 0.16em;
		/* compense l'interlettrage : sans ça le mot paraît décalé à gauche */
		text-indent: 0.16em;
		line-height: 1.35;
		white-space: nowrap;
		cursor: pointer;
		transition: color 0.18s ease, background 0.18s ease;
	}
	.tab:first-child {
		border-left: none;
	}
	.tab:hover:not(.active) {
		color: rgba(255, 255, 255, 0.85);
		background: rgba(255, 255, 255, 0.04);
	}
	/* offset négatif : le bloc clippe son débord, un outline sortant serait rogné
	   sur les onglets d'extrémité. */
	.tab:focus-visible {
		outline: 2px solid var(--accent, #ff2040);
		outline-offset: -2px;
	}
	/* Onglet actif : uniquement un fond blanc plus soutenu, aucun liseré. */
	.tab.active {
		color: #fff;
		background: rgba(255, 255, 255, 0.16);
	}

	@media (max-width: 1000px) {
		.tab {
			padding: 0.45rem 0.8rem;
			font-size: 0.86rem;
			letter-spacing: 0.12em;
			text-indent: 0.12em;
		}
	}
</style>

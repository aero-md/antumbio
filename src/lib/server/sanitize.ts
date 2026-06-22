// Nettoyage d'entrée pour les commentaires. NE PAS confondre avec de la
// sanitisation HTML : les commentaires ne sont jamais rendus en HTML.
// On retire seulement les caractères parasites (contrôle, invisibles, bidi).

// Caractères de contrôle C0/C1 sauf \t (\x09) et \n (\x0A), qu'on garde.
//   \x00-\x08 = C0 avant tab
//   \x0B-\x1F = C0 après newline (inclut \r \x0D, de toute façon déjà converti)
//   \x7F      = DEL
//   \x80-\x9F = C1
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B-\x1F\x7F-\x9F]/g;

// Invisibles / directionnels :
//   ​-‍ = zero-width space / non-joiner / joiner
//   ‎-‏ = LRM / RLM
//   ‪-‮ = embeddings + overrides bidi (LRE/RLE/PDF/LRO/RLO)
//   ⁠-⁤ = word joiner + invisibles maths
//   ⁦-⁯ = isolats bidi + deprecated formatting
//   ﻿        = BOM / zero-width no-break space
const INVISIBLE_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;

/**
 * Nettoie un champ texte multi-ligne (ex: contenu d'un commentaire).
 * - normalise Unicode en NFC
 * - convertit \r\n et \r en \n
 * - retire les caractères de contrôle (sauf \n, \t) et les invisibles/bidi
 * - trim
 */
export function cleanMultiline(input: string): string {
	return input
		.normalize('NFC')
		.replace(/\r\n?/g, '\n')
		.replace(CONTROL_CHARS, '')
		.replace(INVISIBLE_CHARS, '')
		.trim();
}

/**
 * Nettoie un champ mono-ligne (ex: signature). Comme cleanMultiline mais
 * retire aussi les sauts de ligne et tabulations (aplatis en espace).
 */
export function cleanSingleline(input: string): string {
	return cleanMultiline(input)
		.replace(/[\n\t]/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

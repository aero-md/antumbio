import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { readUserConfig, readUserHtml, isValidPseudo } from '$lib/server/pages';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const { pseudo } = params;
	if (!isValidPseudo(pseudo)) throw error(404, 'Page not found');
	const config = await readUserConfig(pseudo);
	if (!config) throw error(404, 'Page not found');
	const html = await readUserHtml(pseudo);
	// Hint UX seulement : le serveur reste la source de vérité (409 si déjà commenté).
	// Le cookie est posé après un POST réussi côté /api/comments.
	const alreadyCommented = cookies.get(`commented_${pseudo}`) === '1';
	return { pseudo, config, html, alreadyCommented };
};

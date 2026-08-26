import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { readUserConfig, readUserHtml, readUserDetailsHtml, isValidPseudo } from '$lib/server/pages';
import { getDiscordAvatarUrl } from '$lib/server/discordAvatar';

export const load: PageServerLoad = async ({ params, cookies }) => {
	const { pseudo } = params;
	if (!isValidPseudo(pseudo)) throw error(404, 'Page not found');
	const config = await readUserConfig(pseudo);
	if (!config) throw error(404, 'Page not found');
	const [html, detailsHtml] = await Promise.all([readUserHtml(pseudo), readUserDetailsHtml(pseudo)]);
	// Hint UX seulement : le serveur reste la source de vérité (409 si déjà commenté).
	// Le cookie est posé après un POST réussi côté /api/comments.
	const alreadyCommented = cookies.get(`commented_${pseudo}`) === '1';

	// Gates user-facing avant d'entrer dans le module Discord : pas d'opt-in =
	// pas d'I/O, même pas un lookup de cache.
	const discordAvatarUrl =
		config.useDiscordPfp && config.discordUserId
			? await getDiscordAvatarUrl(config.discordUserId)
			: null;

	return { pseudo, config, html, detailsHtml, alreadyCommented, discordAvatarUrl };
};

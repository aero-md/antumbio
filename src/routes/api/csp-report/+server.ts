import type { RequestHandler } from './$types';
import { take } from '$lib/server/rateLimit';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Rate-limit STRICT : un endpoint de report est un vecteur de spam de logs.
	const ip = getClientAddress();
	if (!take(`csp:${ip}`, 20, 60_000)) {
		return new Response(null, { status: 429 });
	}

	try {
		// Les navigateurs envoient soit application/csp-report (report-uri),
		// soit application/reports+json (report-to). On lit le texte brut.
		const body = await request.text();
		if (body.length <= 4096) {
			console.warn('[CSP] violation', body);
		}
	} catch {
		// ignore — un report illisible n'est pas une erreur applicative
	}

	// 204 : pas de contenu, le navigateur n'attend pas de réponse utile.
	return new Response(null, { status: 204 });
};

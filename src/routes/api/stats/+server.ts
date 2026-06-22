import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidPseudo, readUserConfig } from '$lib/server/pages';
import {
	computeVisitorHash,
	ensureVisitorId,
	recordView,
	getUniqueViewCount
} from '$lib/server/views';
import { getCommentCount } from '$lib/server/comments';
import { take } from '$lib/server/rateLimit';

interface Payload {
	pseudo?: unknown;
	visitorId?: unknown;
}

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
	// 1. Anti-CSRF léger : si le navigateur envoie sec-fetch-site et que ce n'est pas
	//    same-origin/same-site, on rejette. Si le header est absent (vieux navigateur), on laisse passer.
	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site') {
		throw error(403, 'Cross-origin requests not allowed');
	}

	// 2. Rate limit : 30 req / minute / IP — généreux pour usage normal, étouffe le spam.
	const ip = getClientAddress();
	if (!take(`stats:${ip}`, 30, 60_000)) {
		throw error(429, 'Too many requests');
	}

	let payload: Payload;
	try {
		payload = (await request.json()) as Payload;
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const pseudo = typeof payload.pseudo === 'string' ? payload.pseudo : '';
	// visitorId du body = fingerprint (signal secondaire, plan #03). Plus une clé
	// d'identité : non fiable, jamais d'erreur s'il manque/est invalide → NULL.
	const fingerprint =
		typeof payload.visitorId === 'string' && payload.visitorId.length <= 256
			? payload.visitorId
			: null;

	if (!isValidPseudo(pseudo)) throw error(400, 'Invalid pseudo');

	// Vérifie que la page existe avant d'enregistrer (évite de polluer la table avec des pseudos inexistants)
	const config = await readUserConfig(pseudo);
	if (!config) throw error(404, 'Page not found');

	// Identité autoritaire = cookie httpOnly opaque + IP (HMAC), jamais le body.
	const vid = ensureVisitorId(cookies);
	const visitorHash = computeVisitorHash(vid, ip);

	await recordView(pseudo, visitorHash, fingerprint);
	const [count, commentCount] = await Promise.all([
		getUniqueViewCount(pseudo),
		getCommentCount(pseudo)
	]);

	return json({ count, commentCount });
};

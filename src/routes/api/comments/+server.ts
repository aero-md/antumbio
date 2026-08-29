import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isValidPseudo, readUserConfig } from '$lib/server/pages';
import { computeVisitorHash, ensureVisitorId } from '$lib/server/views';
import {
	recordComment,
	MAX_CONTENT_LENGTH,
	MAX_SIGNATURE_LENGTH
} from '$lib/server/comments';
import { cleanMultiline, cleanSingleline } from '$lib/server/sanitize';
import { take } from '$lib/server/rateLimit';

interface Payload {
	pseudo?: unknown;
	visitorId?: unknown;
	content?: unknown;
	signature?: unknown;
}

export const POST: RequestHandler = async ({ request, getClientAddress, cookies }) => {
	const fetchSite = request.headers.get('sec-fetch-site');
	if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'same-site') {
		throw error(403, 'Cross-origin requests not allowed');
	}

	const ip = getClientAddress();
	if (!take(`comments:${ip}`, 10, 60_000)) {
		throw error(429, 'Too many requests');
	}

	let payload: Payload;
	try {
		payload = (await request.json()) as Payload;
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const pseudo = typeof payload.pseudo === 'string' ? payload.pseudo : '';
	// visitorId du body = fingerprint (signal secondaire, plan #03), pas une clé.
	const fingerprint =
		typeof payload.visitorId === 'string' && payload.visitorId.length <= 256
			? payload.visitorId
			: null;
	const rawContent = typeof payload.content === 'string' ? payload.content : '';
	const rawSignature = typeof payload.signature === 'string' ? payload.signature : '';

	if (!isValidPseudo(pseudo)) throw error(400, 'Invalid pseudo');

	// Hygiène d'entrée (plan #05) : strip silencieux des caractères parasites AVANT
	// les checks de longueur/vacuité (le nettoyage peut raccourcir/vider le champ).
	const content = cleanMultiline(rawContent);
	const signature = cleanSingleline(rawSignature);

	if (content.length === 0) throw error(400, 'Empty content');
	if (content.length > MAX_CONTENT_LENGTH) throw error(400, 'Content too long');
	if (signature.length > MAX_SIGNATURE_LENGTH) throw error(400, 'Signature too long');

	const config = await readUserConfig(pseudo);
	if (!config) throw error(404, 'Page not found');
	// L'onglet « contact » retiré côté page (`showContact: false`) ferme aussi la
	// porte côté serveur — sinon l'endpoint reste ouvert à qui connaît le pseudo.
	if (config.showContact === false) throw error(403, 'Messages disabled for this page');

	// Identité autoritaire = cookie httpOnly opaque + IP (HMAC), jamais le body.
	const vid = ensureVisitorId(cookies);
	const visitorHash = computeVisitorHash(vid, ip);

	const inserted = await recordComment(
		pseudo,
		visitorHash,
		content,
		signature.length > 0 ? signature : null,
		fingerprint
	);
	if (!inserted) {
		// Source de vérité côté serveur. On en profite pour réaligner le hint cookie
		// au cas où le client l'aurait perdu.
		cookies.set(`commented_${pseudo}`, '1', {
			path: '/',
			httpOnly: false,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365
		});
		throw error(409, 'Already commented');
	}

	cookies.set(`commented_${pseudo}`, '1', {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});

	return json({ ok: true });
};

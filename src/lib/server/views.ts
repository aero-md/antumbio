import { createHmac, randomUUID } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { query } from './db';

const DEDUP_WINDOW = '2 hours';

// Plan #03 : l'identité visiteur est ancrée sur un cookie httpOnly opaque émis par
// le serveur, plus sur une valeur client (fingerprint). Le cookie + l'IP, mixés via
// HMAC à secret serveur, donnent le hash autoritaire de dedup.
export const VISITOR_COOKIE = 'rsb_vid';

const COOKIE_OPTIONS = {
	path: '/' as const,
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: !dev,
	maxAge: 60 * 60 * 24 * 365
};

/** Lit l'id visiteur opaque depuis le cookie httpOnly ; en émet un (UUID) si absent. */
export function ensureVisitorId(cookies: Cookies): string {
	let vid = cookies.get(VISITOR_COOKIE);
	if (!vid) {
		vid = randomUUID();
		cookies.set(VISITOR_COOKIE, vid, COOKIE_OPTIONS);
	}
	return vid;
}

/**
 * Hash d'identité = HMAC(VISITOR_SECRET, vidCookie|ip).
 * HMAC plutôt que SHA-256 nu : empêche tout calcul/forge offline du hash même si le
 * cookie fuit (il reste httpOnly de toute façon). Le userAgent est volontairement
 * exclu (bruit, change aux mises à jour navigateur).
 */
export function computeVisitorHash(vidCookie: string, ip: string): string {
	const secret = env.VISITOR_SECRET;
	if (!secret) throw new Error('VISITOR_SECRET is not defined. Set it in .env.');
	return createHmac('sha256', secret).update(`${vidCookie}|${ip}`).digest('hex');
}

export async function recordView(
	pseudo: string,
	visitorHash: string,
	fingerprint: string | null
): Promise<void> {
	await query(
		`INSERT INTO page_views (pseudo, visitor_hash, fingerprint)
		 SELECT $1, $2, $3
		 WHERE NOT EXISTS (
		   SELECT 1 FROM page_views
		   WHERE pseudo = $1 AND visitor_hash = $2
		     AND viewed_at > now() - interval '${DEDUP_WINDOW}'
		 )`,
		[pseudo, visitorHash, fingerprint]
	);
}

export async function getUniqueViewCount(pseudo: string): Promise<number> {
	const result = await query<{ count: string }>(
		'SELECT COUNT(DISTINCT visitor_hash)::text AS count FROM page_views WHERE pseudo = $1',
		[pseudo]
	);
	return Number(result.rows[0]?.count ?? 0);
}

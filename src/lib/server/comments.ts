import { query } from './db';

export const MAX_CONTENT_LENGTH = 512;
export const MAX_SIGNATURE_LENGTH = 32;

export interface Comment {
	content: string;
	signature: string | null;
	createdAt: string;
}

/**
 * Insert si pas déjà commenté. Renvoie false si le visiteur a déjà laissé un commentaire.
 * La contrainte UNIQUE (pseudo, visitor_hash) garantit l'unicité côté DB même en cas de race.
 */
export async function recordComment(
	pseudo: string,
	visitorHash: string,
	content: string,
	signature: string | null,
	fingerprint: string | null
): Promise<boolean> {
	const result = await query(
		`INSERT INTO comments (pseudo, visitor_hash, content, signature, fingerprint)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (pseudo, visitor_hash) DO NOTHING`,
		[pseudo, visitorHash, content, signature, fingerprint]
	);
	return (result.rowCount ?? 0) > 0;
}

export async function getCommentCount(pseudo: string): Promise<number> {
	const result = await query<{ count: string }>(
		'SELECT COUNT(*)::text AS count FROM comments WHERE pseudo = $1',
		[pseudo]
	);
	return Number(result.rows[0]?.count ?? 0);
}

// ATTENTION : les commentaires sont stockés en texte brut. S'ils sont un jour
// affichés, les rendre via interpolation Svelte échappée ({comment}), JAMAIS via
// {@html}. Sinon : stored XSS. Cf. docs/security/plan-05.
export async function getComments(pseudo: string): Promise<Comment[]> {
	const result = await query<{ content: string; signature: string | null; created_at: Date }>(
		`SELECT content, signature, created_at
		 FROM comments
		 WHERE pseudo = $1
		 ORDER BY created_at DESC`,
		[pseudo]
	);
	return result.rows.map((r) => ({
		content: r.content,
		signature: r.signature,
		createdAt: r.created_at.toISOString()
	}));
}

import { env } from '$env/dynamic/private';

// Snowflake Discord : 17–20 chiffres. Filtre les configs cassées avant l'I/O.
const SNOWFLAKE_RE = /^\d{17,20}$/;
const SUCCESS_TTL_MS = 60 * 60 * 1000; // 1h, cap demandé
const ERROR_TTL_MS = 5 * 60 * 1000;    // 5min : on retente plus vite qu'un succès
const DISCORD_API = 'https://discord.com/api/v10';

interface CacheEntry {
	url: string | null;
	expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
// Le token absent est un état attendu (feature optionnelle) → on log une seule fois
// par process pour ne pas spammer les logs à chaque pageview.
let tokenWarnLogged = false;

function avatarUrl(userId: string, hash: string): string {
	// Une PP animée a un hash préfixé `a_`. Toutes les extensions statiques (.png, .webp,
	// .jpg) marchent sur ce hash mais n'en servent que la première frame.
	//
	// Piège : `.gif`, que la doc Discord donne encore comme LE format animé, renvoie
	// un **415** sur le CDN (vérifié sur un hash `a_` réel). L'animation ne sort plus
	// que via `.webp?animated=true` — c'est ce que demande le client Discord lui-même.
	// Ne pas "corriger" ça en repassant au .gif.
	//
	// size=128 : l'avatar fait 4rem (64 px), donc 128 couvre le retina 2x. Le 256
	// animé pèse 4× plus lourd (~590 Ko contre ~250) pour un disque de 64 px.
	if (hash.startsWith('a_')) {
		return `https://cdn.discordapp.com/avatars/${userId}/${hash}.webp?size=128&animated=true`;
	}
	return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=256`;
}

function defaultAvatarUrl(userId: string): string {
	// Système pomelo (post-2023) : index = (id >> 22) % 6. BigInt parce que les snowflakes
	// dépassent Number.MAX_SAFE_INTEGER.
	const idx = Number((BigInt(userId) >> 22n) % 6n);
	return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

/**
 * Récupère l'URL de la PP Discord courante pour un user_id.
 *
 * Ordre des gates (du moins cher au plus cher) :
 *   1. format snowflake → cheap, élimine les configs cassées
 *   2. token serveur présent → lookup env synchrone (+ warn one-shot si absent)
 *   3. cache hit → Map lookup, évite l'I/O réseau
 *   4. appel API Discord → I/O, peut fail (4xx/5xx/timeout)
 *
 * En cas d'échec : null + cache négatif court (évite de re-spammer Discord pendant 5min).
 * Les gates user-level (`useDiscordPfp` true, `discordUserId` truthy) sont à faire
 * côté caller pour ne même pas entrer dans cette fonction si pas d'opt-in.
 */
export async function getDiscordAvatarUrl(userId: string): Promise<string | null> {
	if (!SNOWFLAKE_RE.test(userId)) return null;

	const token = env.DISCORD_BOT_TOKEN;
	if (!token) {
		if (!tokenWarnLogged) {
			console.warn('[discordAvatar] DISCORD_BOT_TOKEN missing — Discord PFP feature disabled');
			tokenWarnLogged = true;
		}
		return null;
	}

	const now = Date.now();
	const hit = cache.get(userId);
	if (hit && hit.expiresAt > now) return hit.url;

	try {
		const res = await fetch(`${DISCORD_API}/users/${userId}`, {
			headers: { Authorization: `Bot ${token}` }
		});

		if (!res.ok) {
			console.warn(`[discordAvatar] HTTP ${res.status} for user ${userId}`);
			cache.set(userId, { url: null, expiresAt: now + ERROR_TTL_MS });
			return null;
		}

		const user = (await res.json()) as { id: string; avatar: string | null };
		const url = user.avatar ? avatarUrl(userId, user.avatar) : defaultAvatarUrl(userId);

		cache.set(userId, { url, expiresAt: now + SUCCESS_TTL_MS });
		return url;
	} catch (err) {
		console.warn(`[discordAvatar] fetch failed for user ${userId}:`, err);
		cache.set(userId, { url: null, expiresAt: now + ERROR_TTL_MS });
		return null;
	}
}

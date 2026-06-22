// Rate limiter en mémoire — fixed window par clé (typiquement une IP).
// Simple, sans dépendance ; suffit pour un site mono-process.
// Au restart du service, les compteurs sont remis à zéro (acceptable ici).

interface Entry {
	count: number;
	reset: number;
}

const buckets = new Map<string, Entry>();

// Nettoyage périodique des entrées expirées pour éviter une fuite mémoire.
let purgeTimer: ReturnType<typeof setInterval> | null = null;
function startPurge() {
	if (purgeTimer) return;
	purgeTimer = setInterval(() => {
		const now = Date.now();
		for (const [k, v] of buckets) {
			if (v.reset < now) buckets.delete(k);
		}
	}, 60_000);
	if (typeof purgeTimer === 'object' && purgeTimer && 'unref' in purgeTimer) {
		(purgeTimer as { unref: () => void }).unref();
	}
}

export function take(key: string, max: number, windowMs: number): boolean {
	startPurge();
	const now = Date.now();
	const entry = buckets.get(key);
	if (!entry || entry.reset < now) {
		buckets.set(key, { count: 1, reset: now + windowMs });
		return true;
	}
	if (entry.count >= max) return false;
	entry.count++;
	return true;
}

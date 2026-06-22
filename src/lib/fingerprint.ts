let cachedId: Promise<string> | null = null;

export function getVisitorId(): Promise<string> {
	if (cachedId) return cachedId;
	cachedId = (async () => {
		const mod = await import('@fingerprintjs/fingerprintjs');
		const fp = await mod.load();
		const result = await fp.get();
		return result.visitorId;
	})();
	return cachedId;
}

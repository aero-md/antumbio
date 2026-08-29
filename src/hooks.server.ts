import type { Handle } from '@sveltejs/kit';
import { ensureVisitorId } from '$lib/server/views';

export const handle: Handle = async ({ event, resolve }) => {
	// Plan #03 : émettre/réutiliser le cookie d'identité visiteur httpOnly opaque
	// dès la première requête (pose le Set-Cookie sur la réponse via event.cookies).
	ensureVisitorId(event.cookies);

	const response = await resolve(event);

	// Plan #06 : déclare le groupe de reporting référencé par `report-to: csp-endpoint`
	// dans la CSP (svelte.config.js). `report-uri` reste le fallback large support.
	response.headers.set('Reporting-Endpoints', 'csp-endpoint="/api/csp-report"');

	return response;
};

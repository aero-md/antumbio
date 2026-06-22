import { error } from '@sveltejs/kit';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import { join, normalize, resolve, sep, extname } from 'node:path';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';
import { isValidPseudo, userDir, USERS_ROOT } from '$lib/server/pages';

const MIME: Record<string, string> = {
	'.css': 'text/css; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.wav': 'audio/wav',
	'.m4a': 'audio/mp4',
	'.aac': 'audio/aac',
	'.flac': 'audio/flac',
	'.mp4': 'video/mp4',
	'.webm': 'video/webm',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2'
};

function streamPart(filepath: string, start?: number, end?: number): ReadableStream {
	const stream = createReadStream(filepath, start !== undefined ? { start, end } : undefined);
	return Readable.toWeb(stream) as unknown as ReadableStream;
}

export const GET: RequestHandler = async ({ params, request }) => {
	const { pseudo, path } = params;
	if (!pseudo || !isValidPseudo(pseudo)) throw error(404, 'Not found');
	if (!path) throw error(404, 'Not found');

	// config.json reste serveur-only — pas accessible via cette route.
	if (path === 'config.json' || path.endsWith('/config.json')) throw error(404, 'Not found');

	const base = userDir(pseudo);
	const requested = resolve(base, normalize(path));

	// anti path-traversal : le chemin résolu doit rester sous users/[pseudo]/
	if (requested !== base && !requested.startsWith(base + sep)) throw error(403, 'Forbidden');
	// défense supplémentaire : interdire de sortir de USERS_ROOT
	if (!requested.startsWith(USERS_ROOT + sep)) throw error(403, 'Forbidden');

	let info;
	try {
		info = await stat(requested);
	} catch {
		throw error(404, 'Not found');
	}
	if (!info.isFile()) throw error(404, 'Not found');

	// Étanchéité symlink (plan #04) : les checks ci-dessus sont lexicaux (resolve/normalize
	// ne suivent pas les liens). On re-vérifie sur le chemin RÉEL (liens suivis). realBase
	// est résolu aussi car un composant parent (ex: /srv) peut lui-même être un lien.
	let realBase: string;
	let realRequested: string;
	try {
		realBase = await realpath(base);
		realRequested = await realpath(requested);
	} catch {
		throw error(404, 'Not found');
	}
	if (realRequested !== realBase && !realRequested.startsWith(realBase + sep)) {
		throw error(403, 'Forbidden');
	}

	const mime = MIME[extname(requested).toLowerCase()] ?? 'application/octet-stream';
	const totalSize = info.size;
	const rangeHeader = request.headers.get('range');

	// Pas de Range demandé → 200 plein, mais on annonce le support pour les futurs seeks audio/vidéo.
	if (!rangeHeader) {
		return new Response(streamPart(requested), {
			headers: {
				'Content-Type': mime,
				'Content-Length': String(totalSize),
				'Accept-Ranges': 'bytes',
				'Cache-Control': 'public, max-age=300'
			}
		});
	}

	// Parse "bytes=START-END" (ou "bytes=-N" pour suffix range).
	const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
	if (!match) {
		return new Response('Invalid Range', {
			status: 416,
			headers: { 'Content-Range': `bytes */${totalSize}` }
		});
	}
	const [, startStr, endStr] = match;

	let start: number;
	let end: number;
	if (startStr === '' && endStr !== '') {
		// "bytes=-N" → N derniers octets
		const suffix = Number(endStr);
		start = Math.max(0, totalSize - suffix);
		end = totalSize - 1;
	} else if (startStr !== '') {
		start = Number(startStr);
		end = endStr !== '' ? Number(endStr) : totalSize - 1;
	} else {
		return new Response('Invalid Range', {
			status: 416,
			headers: { 'Content-Range': `bytes */${totalSize}` }
		});
	}

	if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= totalSize || end >= totalSize || start > end) {
		return new Response('Range Not Satisfiable', {
			status: 416,
			headers: { 'Content-Range': `bytes */${totalSize}` }
		});
	}

	return new Response(streamPart(requested, start, end), {
		status: 206,
		headers: {
			'Content-Type': mime,
			'Content-Length': String(end - start + 1),
			'Content-Range': `bytes ${start}-${end}/${totalSize}`,
			'Accept-Ranges': 'bytes',
			'Cache-Control': 'public, max-age=300'
		}
	});
};

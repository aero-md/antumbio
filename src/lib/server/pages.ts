import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { PageConfig } from '$lib/types';

const PSEUDO_REGEX = /^[a-z0-9_-]{1,32}$/i;

export const USERS_ROOT = resolve(process.cwd(), 'users');

export function isValidPseudo(pseudo: string): boolean {
	return PSEUDO_REGEX.test(pseudo);
}

export function userDir(pseudo: string): string {
	return join(USERS_ROOT, pseudo);
}

export async function readUserConfig(pseudo: string): Promise<PageConfig | null> {
	if (!isValidPseudo(pseudo)) return null;
	try {
		const raw = await readFile(join(userDir(pseudo), 'config.json'), 'utf8');
		return JSON.parse(raw) as PageConfig;
	} catch (err: unknown) {
		if (isFileNotFound(err)) return null;
		throw err;
	}
}

export async function readUserHtml(pseudo: string): Promise<string> {
	return readFragment(pseudo, 'index.html');
}

// Contenu de l'onglet « Détails ». Optionnel : sans contenu, la page n'affiche
// pas l'onglet du tout. Un fichier réduit à ses commentaires — le cas du template
// `_example` recopié puis vidé de ses sections — compte comme absent : il ne rend
// rien à l'écran, un onglet vide serait une impasse.
export async function readUserDetailsHtml(pseudo: string): Promise<string> {
	const raw = await readFragment(pseudo, 'details.html');
	return hasRenderableContent(raw) ? raw : '';
}

/** Reste-t-il quelque chose une fois les commentaires HTML et les blancs retirés ? */
function hasRenderableContent(html: string): boolean {
	return html.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;
}

async function readFragment(pseudo: string, file: string): Promise<string> {
	if (!isValidPseudo(pseudo)) return '';
	try {
		return await readFile(join(userDir(pseudo), file), 'utf8');
	} catch (err: unknown) {
		if (isFileNotFound(err)) return '';
		throw err;
	}
}

function isFileNotFound(err: unknown): boolean {
	return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'ENOENT';
}

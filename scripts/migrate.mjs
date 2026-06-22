// Applique toutes les migrations SQL dans l'ordre, via le driver `pg`.
//
// Pourquoi Bun + pg plutôt que psql :
//   - psql n'est pas garanti dans le PATH (ni en local Windows, ni forcément sur le Pi) ;
//   - Bun est déjà présent des deux côtés et charge automatiquement le .env (DATABASE_URL).
//
// Idempotence : toutes les migrations utilisent IF NOT EXISTS / blocs DO idempotents,
// donc ce runner est rejouable sans risque — il tourne à chaque déploiement.
//
// Usage : bun scripts/migrate.mjs   (DATABASE_URL lue depuis .env ou l'environnement)

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const DIR = 'migrations';

const url = process.env.DATABASE_URL;
if (!url) {
	console.error('[migrate] DATABASE_URL non définie (la placer dans .env, chargé par Bun).');
	process.exit(1);
}

const files = readdirSync(DIR)
	.filter((f) => f.endsWith('.sql'))
	.sort(); // 001_, 002_, 003_… ordre lexicographique = ordre d'application voulu

if (files.length === 0) {
	console.log('[migrate] Aucune migration trouvée.');
	process.exit(0);
}

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
	for (const f of files) {
		const sql = readFileSync(join(DIR, f), 'utf8');
		process.stdout.write(`[migrate] ${f} … `);
		// Une transaction par fichier : si une migration échoue à mi-chemin, rollback
		// complet de ce fichier plutôt qu'un état partiel.
		try {
			await client.query('BEGIN');
			await client.query(sql);
			await client.query('COMMIT');
			console.log('ok');
		} catch (err) {
			await client.query('ROLLBACK');
			throw new Error(`${f}: ${err.message}`);
		}
	}
	console.log(`[migrate] ${files.length} migration(s) appliquée(s).`);
} catch (err) {
	console.error(`[migrate] ÉCHEC — ${err.message}`);
	process.exitCode = 1;
} finally {
	await client.end();
}

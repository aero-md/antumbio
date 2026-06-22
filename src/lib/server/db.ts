import pg from 'pg';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
	if (_pool) return _pool;
	if (!env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not defined. Copy .env.example to .env and set it.');
	}
	_pool = new Pool({
		connectionString: env.DATABASE_URL,
		max: 10
	});
	return _pool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
	text: string,
	params?: unknown[]
): Promise<pg.QueryResult<T>> {
	return getPool().query<T>(text, params);
}

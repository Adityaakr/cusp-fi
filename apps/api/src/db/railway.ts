import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { DATABASE_URL } from "../config/index.js";

let _pool: Pool | null = null;

export function getRailwayPool(): Pool {
  if (!_pool) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL not configured");
    }
    _pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("railway") ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });
  }
  return _pool;
}

export async function railwayQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
) {
  return getRailwayPool().query<T>(text, params);
}

export async function withRailwayTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getRailwayPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

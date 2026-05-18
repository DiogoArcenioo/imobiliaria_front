import "server-only";

import pg from "pg";

const { Pool } = pg;

function readBoolean(value) {
  if (value == null) return undefined;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function hasDatabaseConfig() {
  return Boolean(
    process.env.DATABASE_URL ||
      (process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER && process.env.DB_PASSWORD),
  );
}

function getPoolConfig() {
  const sslEnabled = readBoolean(process.env.DB_SSL);
  const ssl = sslEnabled === undefined ? undefined : sslEnabled ? { rejectUnauthorized: false } : false;

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ...(ssl === undefined ? {} : { ssl }),
    };
  }

  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...(ssl === undefined ? {} : { ssl }),
  };
}

export function getPool() {
  if (!hasDatabaseConfig()) {
    throw new Error("Database env vars are missing. Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD.");
  }

  if (!globalThis.__imobiliariaPgPool) {
    globalThis.__imobiliariaPgPool = new Pool({
      ...getPoolConfig(),
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return globalThis.__imobiliariaPgPool;
}

export async function query(text, params) {
  return getPool().query(text, params);
}

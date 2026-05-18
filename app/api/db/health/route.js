import { NextResponse } from "next/server";
import { hasDatabaseConfig, query } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasDatabaseConfig()) {
    return NextResponse.json(
      {
        ok: false,
        error: "DATABASE_NOT_CONFIGURED",
        message: "Configure DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD.",
      },
      { status: 500 },
    );
  }

  const startedAt = Date.now();

  try {
    const { rows } = await query(`
      select
        current_database() as database_name,
        current_schema() as schema_name,
        now() as checked_at
    `);

    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      database: rows[0].database_name,
      schema: rows[0].schema_name,
      checkedAt: rows[0].checked_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "DB_CONNECTION_FAILED",
        message: error instanceof Error ? error.message : "Unknown database error",
      },
      { status: 500 },
    );
  }
}

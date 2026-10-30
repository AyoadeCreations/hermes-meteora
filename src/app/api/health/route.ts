import { NextResponse } from 'next/server';
import { listMarkets } from '@/lib/db';
import { classifyDbError, DbNotConfiguredError } from '@/lib/db/diagnose';

// Open /api/health on any deployment to see whether the database is reachable.
// Reports modes and a short code only: never a connection string, host or secret.
export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = Boolean(process.env.DATABASE_URL);
  const base = {
    database:    configured ? 'postgres' : 'sqlite',
    configured,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
  };

  const started = Date.now();
  try {
    if (!configured && process.env.VERCEL) throw new DbNotConfiguredError();
    await listMarkets(); // creates the schema if needed, then reads
    return NextResponse.json({ ok: true, ...base, latencyMs: Date.now() - started });
  } catch (err) {
    const info = classifyDbError(err);
    console.error(`[GET /api/health] (${info.code})`, err);
    return NextResponse.json(
      { ok: false, ...base, code: info.code, hint: info.hint, latencyMs: Date.now() - started },
      { status: info.status }
    );
  }
}

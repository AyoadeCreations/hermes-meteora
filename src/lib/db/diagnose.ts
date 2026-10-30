/**
 * Turn a raw database error into something safe to show and useful to act on.
 *
 * The full error always goes to the server log. What leaves the server is only
 * a short code and a plain sentence: never a host name, connection string or
 * raw driver message.
 */
import { NextResponse } from 'next/server';

export type DbErrorCode =
  | 'DB_NOT_CONFIGURED'
  | 'DB_UNREACHABLE'
  | 'DB_TIMEOUT'
  | 'DB_AUTH'
  | 'DB_NOT_FOUND'
  | 'DB_TLS'
  | 'DB_READONLY'
  | 'DB_SCHEMA'
  | 'DB_UNKNOWN';

export interface DbErrorInfo {
  code:   DbErrorCode;
  status: number;
  hint:   string;
}

export class DbNotConfiguredError extends Error {
  constructor() {
    super(
      'DATABASE_URL is not set. On Vercel, Production, Preview and Development ' +
        'environments are configured separately.'
    );
    this.name = 'DbNotConfiguredError';
  }
}

function codeOf(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return '';
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function classifyDbError(err: unknown): DbErrorInfo {
  const code = codeOf(err);
  const msg  = messageOf(err);

  if (err instanceof DbNotConfiguredError) {
    return { code: 'DB_NOT_CONFIGURED', status: 503, hint: 'The database is not configured for this environment.' };
  }
  if (code === 'SQLITE_READONLY' || code === 'SQLITE_CANTOPEN' || /readonly database|unable to open database/i.test(msg)) {
    return { code: 'DB_READONLY', status: 503, hint: 'The server cannot write to its local database. A hosted database is required here.' };
  }
  if (code === '28P01' || code === '28000' || /password authentication failed/i.test(msg)) {
    return { code: 'DB_AUTH', status: 503, hint: 'The database rejected the credentials.' };
  }
  if (code === '3D000') {
    return { code: 'DB_NOT_FOUND', status: 503, hint: 'The configured database does not exist.' };
  }
  if (/self.signed|certificate|ssl|tls/i.test(msg) && !/ECONN/.test(code)) {
    return { code: 'DB_TLS', status: 503, hint: 'The secure connection to the database failed.' };
  }
  if (code === 'ETIMEDOUT' || /timeout|timed out/i.test(msg)) {
    return { code: 'DB_TIMEOUT', status: 503, hint: 'The database took too long to respond. It may be waking up; try again.' };
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'EAI_AGAIN' || /connection terminated|getaddrinfo/i.test(msg)) {
    return { code: 'DB_UNREACHABLE', status: 503, hint: 'The database could not be reached.' };
  }
  if (code === '42P01' || code === '42703' || /relation .* does not exist|no such table|no such column/i.test(msg)) {
    return { code: 'DB_SCHEMA', status: 500, hint: 'The database tables are missing or out of date.' };
  }
  return { code: 'DB_UNKNOWN', status: 500, hint: 'Something went wrong on our side. Please try again.' };
}

/** Log the real error, return a safe JSON response. */
export function dbErrorResponse(err: unknown, error: string, route?: string): NextResponse {
  const info = classifyDbError(err);
  console.error(`[${route ?? 'api'}] ${error} (${info.code})`, err);
  return NextResponse.json(
    { error, message: info.hint, code: info.code },
    { status: info.status }
  );
}

import { describe, it, expect } from 'vitest';
import { classifyDbError, DbNotConfiguredError } from '@/lib/db/diagnose';

const withCode = (code: string, message = 'x') => Object.assign(new Error(message), { code });

describe('classifyDbError', () => {
  it('flags a missing DATABASE_URL', () => {
    expect(classifyDbError(new DbNotConfiguredError()).code).toBe('DB_NOT_CONFIGURED');
  });
  it('recognises a read-only SQLite file system', () => {
    expect(classifyDbError(withCode('SQLITE_READONLY')).code).toBe('DB_READONLY');
    expect(classifyDbError(new Error('attempt to write a readonly database')).code).toBe('DB_READONLY');
  });
  it('recognises bad credentials and a missing database', () => {
    expect(classifyDbError(withCode('28P01')).code).toBe('DB_AUTH');
    expect(classifyDbError(withCode('3D000')).code).toBe('DB_NOT_FOUND');
  });
  it('recognises unreachable hosts and timeouts', () => {
    expect(classifyDbError(withCode('ECONNREFUSED')).code).toBe('DB_UNREACHABLE');
    expect(classifyDbError(withCode('ENOTFOUND')).code).toBe('DB_UNREACHABLE');
    expect(classifyDbError(new Error('timeout exceeded when trying to connect')).code).toBe('DB_TIMEOUT');
  });
  it('recognises missing tables', () => {
    expect(classifyDbError(withCode('42P01')).code).toBe('DB_SCHEMA');
  });
  it('recognises TLS failures', () => {
    expect(classifyDbError(new Error('self-signed certificate in certificate chain')).code).toBe('DB_TLS');
  });
  it('falls back to unknown for anything else', () => {
    expect(classifyDbError(new Error('boom')).code).toBe('DB_UNKNOWN');
    expect(classifyDbError('weird').code).toBe('DB_UNKNOWN');
  });
  it('never leaks hosts, credentials or raw driver text in the hint', () => {
    const err = withCode('ENOTFOUND', 'getaddrinfo ENOTFOUND ep-secret-host.neon.tech postgres://user:pw@host');
    const info = classifyDbError(err);
    expect(info.hint).not.toMatch(/neon|postgres:|pw|getaddrinfo/i);
  });
});

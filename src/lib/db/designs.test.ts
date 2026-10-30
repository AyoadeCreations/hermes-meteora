/**
 * Regression tests for design persistence: duplicates must not pile up, and a
 * deployed design must survive regeneration. Runs against a throwaway SQLite file.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hermes-designs-'));
process.env['DB_PATH'] = path.join(dir, 'test.db');
delete process.env['DATABASE_URL'];

type Db = typeof import('./markets');
type Gen = typeof import('@/services/simulation/generator');
let db: Db;
let gen: Gen;

beforeAll(async () => {
  db  = await import('./markets');
  gen = await import('@/services/simulation/generator');
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

function newMarket() {
  return db.createMarket({
    tokenName: 'Test', tokenSymbol: 'TST', totalSupply: 1_000_000_000,
    quoteMint: 'So11111111111111111111111111111111111111112',
    startingPrice: 0.000001, graduationQuoteAmount: 85,
    expectedDemand: { profile: 'medium' }, objective: 'balanced',
  });
}
function fresh(market: ReturnType<Db['createMarket']>) {
  const r = gen.generateCandidates(market);
  return [...r.designs, r.baseline];
}

describe('saveDesignsIfNone', () => {
  it('saves once, then refuses to add a second set', () => {
    const m = newMarket();
    expect(db.saveDesignsIfNone(m.id, fresh(m))).toBe(true);
    const first = db.getDesigns(m.id).map((d) => d.id).sort();
    expect(db.saveDesignsIfNone(m.id, fresh(m))).toBe(false);
    expect(db.getDesigns(m.id).map((d) => d.id).sort()).toEqual(first);
  });
});

describe('replaceDesigns', () => {
  it('swaps the set for a new one without leftovers', () => {
    const m = newMarket();
    db.saveDesignsIfNone(m.id, fresh(m));
    const before = db.getDesigns(m.id).map((d) => d.id);
    db.replaceDesigns(m.id, fresh(m));
    const after = db.getDesigns(m.id).map((d) => d.id);
    expect(after.length).toBe(before.length);
    expect(after.some((id) => before.includes(id))).toBe(false);
  });

  it('keeps a design that a deployment uses', () => {
    const m = newMarket();
    db.saveDesignsIfNone(m.id, fresh(m));
    const used = db.getDesigns(m.id)[0];
    if (!used) throw new Error('no design');
    db.createDeployment({ marketId: m.id, designId: used.id, walletAddress: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' });
    db.replaceDesigns(m.id, fresh(m));
    const ids = db.getDesigns(m.id).map((d) => d.id);
    expect(ids).toContain(used.id);
  });
});

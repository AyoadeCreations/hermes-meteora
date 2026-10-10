/**
 * deriveMarketCondition.test.ts
 *
 * Tests use only realistic MarketObservation shapes — no fabricated metrics.
 * We verify: INSUFFICIENT_DATA guard, correct status derivation,
 * signal presence, and that confidence scales with data.
 */

import { describe, it, expect } from 'vitest';
import { deriveMarketCondition, MIN_OBSERVATIONS } from './deriveMarketCondition';
import type { MarketObservation } from '@/domain/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeObs(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    id:                 'obs-test',
    marketId:           'mkt-test',
    timestamp:          new Date().toISOString(),
    price:              0.000002,
    quoteReserve:       5.0,
    volume24h:          1.2,
    traders:            12,
    buyVolume:          0.8,
    sellVolume:         0.4,
    graduationProgress: 22,
    ...overrides,
  };
}

/** Build a realistic growing series of N observations.
 *  Price stays within ~100% range (normal bonding curve early progression)
 *  so tests don't accidentally hit the VOLATILE threshold.
 */
function buildGrowingSeries(n: number): MarketObservation[] {
  return Array.from({ length: n }, (_, i) => {
    const t = i / Math.max(n - 1, 1);
    return makeObs({
      id:                 `obs-${i}`,
      timestamp:          new Date(Date.now() - (n - i) * 60_000).toISOString(),
      // Price doubles at most (~100% range) — normal early-stage progression
      price:              0.000002 + t * 0.000002,
      quoteReserve:       2 + t * 10,
      volume24h:          0.5 + t * 2,
      traders:            5 + Math.floor(t * 20),
      buyVolume:          0.35 + t * 1.4,
      sellVolume:         0.15 + t * 0.6,
      graduationProgress: t * 25,
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deriveMarketCondition', () => {

  describe('INSUFFICIENT_DATA guard', () => {
    it('returns INSUFFICIENT_DATA when observations = 0', () => {
      const cond = deriveMarketCondition([]);
      expect(cond.status).toBe('INSUFFICIENT_DATA');
      expect(cond.dataAvailable).toBe(false);
      expect(cond.signals).toHaveLength(0);
      expect(cond.summary).toBe('');
    });

    it('returns INSUFFICIENT_DATA when observations < MIN_OBSERVATIONS', () => {
      const obs = Array.from({ length: MIN_OBSERVATIONS - 1 }, (_, i) =>
        makeObs({ id: `obs-${i}` })
      );
      const cond = deriveMarketCondition(obs);
      expect(cond.status).toBe('INSUFFICIENT_DATA');
      expect(cond.dataAvailable).toBe(false);
    });

    it('does NOT return INSUFFICIENT_DATA when observations >= MIN_OBSERVATIONS', () => {
      const obs = buildGrowingSeries(MIN_OBSERVATIONS);
      const cond = deriveMarketCondition(obs);
      expect(cond.status).not.toBe('INSUFFICIENT_DATA');
      expect(cond.dataAvailable).toBe(true);
    });
  });

  describe('Signal derivation', () => {
    it('includes Volume signal when volume24h data is present', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs);
      const volSignal = cond.signals.find(s => s.metric === 'Volume');
      expect(volSignal).toBeDefined();
      expect(volSignal?.direction).toBeDefined();
      expect(volSignal?.value).toContain('SOL');
    });

    it('includes Demand Pressure signal when buyVolume/sellVolume are non-zero', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs);
      const pressSignal = cond.signals.find(s => s.metric === 'Demand Pressure');
      expect(pressSignal).toBeDefined();
      expect(pressSignal?.value).toContain('%');
    });

    it('includes Liquidity signal when quoteReserve is present', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs);
      const liqSignal = cond.signals.find(s => s.metric === 'Liquidity');
      expect(liqSignal).toBeDefined();
    });

    it('includes Graduation Progress signal when graduationProgress > 0', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs);
      const gradSignal = cond.signals.find(s => s.metric === 'Graduation Progress');
      expect(gradSignal).toBeDefined();
      expect(gradSignal?.value).toContain('%');
    });

    it('does NOT include Demand Pressure when buyVolume + sellVolume = 0', () => {
      const obs = buildGrowingSeries(10).map(o => ({ ...o, buyVolume: 0, sellVolume: 0 }));
      const cond = deriveMarketCondition(obs);
      const pressSignal = cond.signals.find(s => s.metric === 'Demand Pressure');
      expect(pressSignal).toBeUndefined();
    });
  });

  describe('Status classification', () => {
    it('returns THIN for very low volume and trader count', () => {
      const obs = buildGrowingSeries(10).map(o => ({
        ...o,
        volume24h:  0.01,
        traders:    2,
        buyVolume:  0.006,
        sellVolume: 0.004,
      }));
      const cond = deriveMarketCondition(obs);
      expect(cond.status).toBe('THIN');
    });

    it('returns VOLATILE for large price spread', () => {
      const base = buildGrowingSeries(10);
      // Inject a dramatic price swing: 0.000001 → 0.000020 = ~1900% range
      const obs = base.map((o, i) => ({
        ...o,
        price:      i < 5 ? 0.000001 : 0.00002,
        volume24h:  1.5, // sufficient volume — not a thin market
        traders:    20,
      }));
      const cond = deriveMarketCondition(obs);
      expect(cond.status).toBe('VOLATILE');
    });

    it('returns DEMAND_WEAKENING when sell pressure dominates and volume falls', () => {
      const obs = buildGrowingSeries(10).map((o, i) => ({
        ...o,
        // More sell than buy throughout, volume declining in second half
        buyVolume:  i < 5 ? 0.3 : 0.2,
        sellVolume: i < 5 ? 0.7 : 0.8,
        volume24h:  i < 5 ? 2.0 : 0.8,
      }));
      const cond = deriveMarketCondition(obs);
      expect(cond.status).toBe('DEMAND_WEAKENING');
    });

    it('returns HEALTHY for growing series with positive signals', () => {
      const obs = buildGrowingSeries(40);
      const cond = deriveMarketCondition(obs);
      expect(['HEALTHY', 'ACTIVE']).toContain(cond.status);
    });
  });

  describe('Confidence scaling', () => {
    it('returns low confidence for minimal observations', () => {
      const obs = buildGrowingSeries(MIN_OBSERVATIONS);
      const cond = deriveMarketCondition(obs);
      expect(cond.confidence).toBe('low');
    });

    it('returns medium or high confidence for many observations', () => {
      const obs = buildGrowingSeries(40);
      const cond = deriveMarketCondition(obs);
      expect(['medium', 'high']).toContain(cond.confidence);
    });
  });

  describe('Metadata', () => {
    it('records correct observationCount', () => {
      const obs = buildGrowingSeries(18);
      const cond = deriveMarketCondition(obs);
      expect(cond.observationCount).toBe(18);
    });

    it('stores formationPlanId when provided', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs, 'plan-abc');
      expect(cond.formationPlanId).toBe('plan-abc');
    });

    it('leaves formationPlanId null when not provided', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs);
      expect(cond.formationPlanId).toBeNull();
    });

    it('sets updatedAt to the latest observation timestamp', () => {
      const obs = buildGrowingSeries(10);
      const cond = deriveMarketCondition(obs);
      // last in sorted order should be the most recent
      const latestTs = obs.reduce((max, o) =>
        new Date(o.timestamp) > new Date(max) ? o.timestamp : max,
        obs[0]!.timestamp
      );
      expect(cond.updatedAt).toBe(latestTs);
    });
  });
});

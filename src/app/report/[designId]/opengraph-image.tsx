import { ImageResponse } from 'next/og';
import { getDesign, getMarket } from '@/lib/db';
import { defaultStressFor } from '@/lib/report';

export const runtime = 'nodejs';
export const alt = 'HERMES launch report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ designId: string }> }) {
  const { designId } = await params;
  const design = await getDesign(designId);
  const market = design ? await getMarket(design.marketBriefId) : null;
  const stress = design ? defaultStressFor(design) : null;

  const none = stress?.presets[0];
  const best = stress?.presets.slice(1).reduce((a, b) => (b.withBots.botProfit < a.withBots.botProfit ? b : a));
  const hasStory = !!none && !!best && none.withBots.botProfit > 0.005;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: 72, color: '#0B0B10',
          background: 'linear-gradient(135deg,#FFF3E0 0%,#FFFFFF 38%,#FBE3F0 68%,#E9E1FF 100%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: -1 }}>HERMES</div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 28, color: '#6B6C76', marginBottom: 18 }}>
            {market ? `${market.tokenName} (${market.tokenSymbol}) launch report` : 'Launch report'}
          </div>
          <div style={{ display: 'flex', fontSize: 74, fontWeight: 700, letterSpacing: -3, lineHeight: 1.04 }}>
            {hasStory && none && best
              ? `Bots take ${Math.round(none.withBots.botSupplySharePct)}% of supply. Protected: ${Math.round(best.withBots.botSupplySharePct)}%.`
              : 'Rehearse the launch before you deploy it.'}
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 24, color: '#6B6C76' }}>
          Simulated and illustrative. Not a forecast.
        </div>
      </div>
    ),
    size,
  );
}

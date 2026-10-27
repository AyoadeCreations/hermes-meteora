import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDesign, getMarket } from '@/lib/db';
import { ReportView, type ReportMarket } from '@/components/report/ReportView';

// Reports read live data and are unlisted: reachable by link, not indexed.
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ designId: string }> };

async function load(designId: string) {
  const design = await getDesign(designId);
  if (!design) return null;
  const market = await getMarket(design.marketBriefId);
  if (!market) return null;
  // Only fields a public viewer needs. No wallet, deployment or database details.
  const safe: ReportMarket = {
    tokenName:             market.tokenName,
    tokenSymbol:           market.tokenSymbol,
    totalSupply:           market.totalSupply,
    startingPrice:         market.startingPrice,
    graduationQuoteAmount: market.graduationQuoteAmount,
    objective:             market.objective,
  };
  return { design, market: safe };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { designId } = await params;
  const data = await load(designId);
  if (!data) return { title: 'Launch report | HERMES', robots: { index: false } };
  const title = `${data.market.tokenName} launch plan | HERMES`;
  const description = `${data.design.name}: a simulated market formation plan for ${data.market.tokenSymbol}, stress tested against launch bots.`;
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'article', siteName: 'HERMES' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function ReportPage({ params }: Params) {
  const { designId } = await params;
  const data = await load(designId);
  if (!data) notFound();
  return <ReportView market={data.market} design={data.design} />;
}

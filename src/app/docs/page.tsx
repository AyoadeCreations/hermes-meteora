import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PageLayout } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Product guide | HERMES',
  description:
    'How HERMES works: design, simulate and stress-test a Meteora Dynamic Bonding Curve launch, and share the report before you deploy.',
  openGraph: {
    title: 'HERMES product guide',
    description: 'Design, simulate and stress-test a Meteora launch before you deploy.',
    type: 'article',
    siteName: 'HERMES',
  },
};

const SECTIONS = [
  { id: 'summary',        label: 'Summary' },
  { id: 'problem',        label: 'The problem' },
  { id: 'solution',       label: 'The solution' },
  { id: 'meteora',        label: 'Built on Meteora' },
  { id: 'reading-report', label: 'Reading a report' },
  { id: 'limits',         label: 'What Hermes does not do' },
  { id: 'status',         label: 'Current status' },
  { id: 'roadmap',        label: 'Roadmap' },
  { id: 'about',          label: 'About' },
] as const;

const H2 = 'display text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.05] mt-14 mb-4 scroll-mt-24';
const P  = 'text-[15.5px] leading-[1.7] text-text-secondary max-w-[68ch]';
const UL = 'mt-4 space-y-2.5 text-[15.5px] leading-[1.65] text-text-secondary max-w-[68ch] list-disc pl-5 marker:text-text-disabled';
const OL = 'mt-4 space-y-2.5 text-[15.5px] leading-[1.65] text-text-secondary max-w-[68ch] list-decimal pl-5 marker:text-text-tertiary';
const B  = 'text-text-primary font-medium';

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-border-subtle bg-white/60">
      <table className="w-full text-left text-sm min-w-[560px]">
        <thead>
          <tr className="border-b border-border-subtle">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border-subtle last:border-0 align-top">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? 'px-4 py-3 font-medium text-text-primary whitespace-nowrap' : 'px-4 py-3 text-text-secondary leading-relaxed'}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DocsPage() {
  return (
    <PageLayout>
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-14 pb-24">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 space-y-1">
            <p className="eyebrow mb-3">On this page</p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-sm text-text-tertiary hover:text-text-primary transition-colors py-1"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl pt-6 md:pt-10">
          <p className="eyebrow mb-4">Product guide</p>
          <h1 className="display display-md leading-[1.02]">Hermes: Product Guide</h1>
          <p className="mt-5 text-lg leading-relaxed text-text-primary max-w-[60ch]">
            Hermes is a launch-rehearsal tool for Solana token creators: it simulates a Meteora Dynamic Bonding
            Curve market, stress-tests it against snipers, and produces a shareable report before anything is
            deployed.
          </p>

          <h2 id="summary" className={H2}>Summary</h2>
          <p className={P}>
            Token launches on bonding curves are usually designed by guesswork and tuned after the damage is done.
            Hermes lets a creator describe a launch, get candidate curve designs, replay each one against organic
            buyers and a burst of sniper bots, and compare how much value leaks out under each of Meteora&rsquo;s
            anti-sniper tools. The result is a public report link a team can share with its community or partners.
          </p>
          <ul className={UL}>
            <li><span className={B}>Who it is for:</span> teams and solo builders launching tokens on Meteora DBC.</li>
            <li><span className={B}>What it gives them:</span> a design they can defend, with numbers, before real money is at risk.</li>
            <li><span className={B}>Status:</span> a working app with a tested simulation engine. See Current status for what is live.</li>
          </ul>

          <h2 id="problem" className={H2}>The problem</h2>
          <p className={P}>
            Creators pick bonding-curve parameters blind, and bots exploit the first seconds of a launch. A curve is
            a set of numbers (starting price, segments, graduation target, fees) whose real behaviour is hard to
            picture. There is no cheap way to ask &ldquo;what happens to my first buyers if five bots buy at second
            zero?&rdquo; before deploying.
          </p>
          <ul className={UL}>
            <li><span className={B}>Design is guesswork.</span> Most teams copy a past launch or accept defaults, with no way to compare alternatives against their own goals.</li>
            <li><span className={B}>Snipers take the upside.</span> Early bots buy cheap, hold, and exit into later buyers&rsquo; demand, and the creator sees it only afterwards.</li>
            <li><span className={B}>Protection has a cost.</span> Anti-sniper fees and limits also make organic buyers pay more, and that trade-off is rarely quantified.</li>
            <li><span className={B}>Nothing to show for it.</span> A team cannot hand its community or partners evidence that the launch was designed carefully.</li>
          </ul>

          <h2 id="solution" className={H2}>The solution</h2>
          <p className={P}>Hermes turns a launch brief into tested curve designs and a report a team can share. The flow has four steps:</p>
          <ol className={OL}>
            <li><span className={B}>Describe the launch.</span> Token, supply, starting price, graduation target and objective.</li>
            <li><span className={B}>Get candidate designs.</span> Hermes generates several curve designs, each scored on price impact, capital formation, price progression and fees.</li>
            <li><span className={B}>Simulate and stress test.</span> Each design is replayed against organic buyers under four buy scenarios, then against a sniper burst with the bot capital and number of buys set by the user.</li>
            <li><span className={B}>Share the report.</span> One link shows the curve, the simulated launch, the stress-test results and the known trade-offs.</li>
          </ol>
          <p className={`${P} mt-4`}>
            Every figure is labelled by how it was produced (Calculated, Simulated or Illustrative), so a reader can
            tell a model from a fact.
          </p>

          <h2 id="meteora" className={H2}>How Hermes builds on Meteora</h2>
          <p className={P}>
            Hermes is built around Meteora&rsquo;s{' '}
            <a
              href="https://docs.meteora.ag/dynamic-bonding-curve/dbc-integration/overview"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-primary underline underline-offset-4 decoration-border-strong hover:decoration-accent"
            >
              Dynamic Bonding Curve
            </a>{' '}
            and its anti-sniper tools. The stress test compares four setups, each modelled on a Meteora feature.
          </p>
          <Table
            head={['Setup', 'Meteora feature it models', 'How Hermes models it by default']}
            rows={[
              ['No protection', 'Flat base fee', 'Baseline for comparison'],
              ['Fee scheduler', 'Decaying fee', '15% fee falling to the base fee over 60 seconds'],
              ['Scheduler + rate limiter', 'Size-based surcharge', 'Extra fee on buys above 1.25x the typical organic buy, capped at 25%'],
              ['Scheduler + limiter + gated entry', 'Gated early access', '10 seconds of whitelist-only buying, 25% of organic buyers'],
            ]}
          />
          <p className={`${P} mt-5`}>
            For each setup Hermes reports how much the bots extract per 100 SOL of organic buying, how much supply
            they hold, and how much more organic buyers pay than in a bot-free launch, split into protection fees
            and bot activity. These parameters are illustrative assumptions modelled on the features, not
            Meteora&rsquo;s exact settings, and the app says so on every result. The curve maths follows
            concentrated-liquidity segments, in line with DBC&rsquo;s design.
          </p>

          <h2 id="reading-report" className={H2}>Reading a report</h2>
          <p className={P}>
            Every number in a Hermes report carries a label that says how it was produced. Read the label before the
            number.
          </p>
          <Table
            head={['Label', 'Meaning', 'Example']}
            rows={[
              ['Calculated', 'Follows directly from the design’s inputs, with no assumptions about buyers', 'The price curve, the graduation target, the design score'],
              ['Simulated', 'Produced by replaying trades under stated demand assumptions', 'Final price, average and maximum price impact, graduation progress'],
              ['Illustrative', 'Depends on parameters we chose to show how a protection behaves', 'The sniper stress test'],
            ]}
          />
          <p className={`${P} mt-5`}>A report has five parts:</p>
          <ol className={OL}>
            <li><span className={B}>Key facts:</span> starting price, graduation target, base fee and how well the design fits the creator&rsquo;s objective, out of 100.</li>
            <li><span className={B}>Price curve:</span> the price a buyer pays as more SOL flows in, up to graduation.</li>
            <li><span className={B}>Simulated launch:</span> how the curve behaves under the assumed buyers.</li>
            <li><span className={B}>Sniper stress test:</span> how much value bots extract under each protection setup, and what organic buyers pay for that protection.</li>
            <li><span className={B}>Design score and trade-offs:</span> the score split into price impact, capital formation, price progression and fees, plus the known downsides of the design.</li>
          </ol>

          <h2 id="limits" className={H2}>What Hermes does not do</h2>
          <p className={P}>Hermes is a rehearsal, not a forecast, and it does not touch your funds.</p>
          <ul className={UL}>
            <li><span className={B}>It does not predict demand.</span> Simulated trades follow stated assumptions about how many people buy and how much. Change the assumptions and the result changes.</li>
            <li><span className={B}>It does not model real bots exactly.</span> The stress test uses a fixed bot behaviour: buy early, hold, then exit when the window closes. Real bots vary.</li>
            <li><span className={B}>Its protection settings are not Meteora&rsquo;s exact settings.</span> They are modelled on the fee scheduler, rate limiter and gated early access, and labelled Illustrative.</li>
            <li><span className={B}>It is not a live market.</span> A report is a plan. Nothing in it moves real money until a creator chooses to launch.</li>
            <li><span className={B}>It is not financial advice.</span> Reports describe how a design behaves in a model, not whether a token will succeed.</li>
          </ul>

          <h2 id="status" className={H2}>Current status</h2>
          <p className={P}>Hermes is in active development. This is what works today.</p>
          <ul className={UL}>
            <li><span className={B}>Market setup and design generation:</span> create a market brief and get several scored curve designs.</li>
            <li><span className={B}>Simulation:</span> four buy scenarios, price path and capital accumulation charts, graduation tracking.</li>
            <li><span className={B}>Sniper stress test:</span> four protection setups compared, with adjustable bot capital and bot buy count.</li>
            <li><span className={B}>Shareable launch report:</span> a public, unlisted link per design with an auto-generated preview image.</li>
            <li><span className={B}>Reliability work:</span> database diagnostics, a health endpoint, and idempotent design creation.</li>
            <li><span className={B}>Quality checks:</span> 126 automated tests passing, TypeScript strict mode.</li>
          </ul>
          <p className={`${P} mt-4`}>
            <span className={B}>Stack:</span> Next.js 15, React 19, Tailwind, TypeScript, SQLite locally and Postgres
            (Neon) on Vercel, Solana wallet adapter.
          </p>
          <p className={`${P} mt-3`}>
            <span className={B}>Coming next:</span> a production release with a live database and wallet-connected
            launches. See the roadmap below.
          </p>

          <h2 id="roadmap" className={H2}>Roadmap</h2>
          <p className={P}>Proposed plan, in order. Dates are targets, not commitments.</p>
          <Table
            head={['Window', 'Goal', 'What ships']}
            rows={[
              ['Days 1 to 30', 'Live and usable', 'Production release with a live database, full wallet testing and the first public launch reports'],
              ['Days 31 to 60', 'Trust the numbers', 'Stress-test parameters checked against Meteora’s documented settings, graduation-odds estimate with a fallback plan if a launch stalls'],
              ['Days 61 to 90', 'Stay with the launch', 'Post-launch monitoring and alerts, and a comparison of simulated reports against real launches'],
            ]}
          />

          <h2 id="about" className={H2}>About Hermes</h2>
          <p className={P}>
            Hermes is built by Roland Ayoade at AyoadeCreations, for teams launching tokens on Meteora. This guide
            changes as the product does, and the roadmap above shows what comes next.
          </p>

          <div className="mt-14">
            <Link
              href="/markets/new"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-ink text-white text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-[opacity,transform] duration-200"
            >
              Start a market <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </article>
      </div>
    </PageLayout>
  );
}

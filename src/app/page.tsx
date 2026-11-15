import Image from "next/image";
import Link from "next/link";
import { HeroScene } from "@/components/hero-scene";
import { MobileMenu } from "@/components/mobile-menu";
import { Button } from "@/components/ui/button";

const STEPS = [
  ["Set up your brand", "Guidelines, approved facts with expiry dates, terminology, colours and fonts."],
  ["Check before publishing", "Text, PDF, Word, images or a web page, against your own rules."],
  ["See the evidence", "Every finding quotes the text and cites the rule or fact it breaks, with a minimal fix."],
  ["People decide", "Reviewers approve, request changes or waive with a reason. The AI never approves."],
] as const;

const SECTIONS = [["#how", "How it works"], ["#features", "Product"], ["#roles", "Roles"], ["#trust", "Security"]] as const;

const ROLES = [
  ["Owner", "Runs the Knowledge Centre and Brand Health."],
  ["Reviewer", "Decides on findings and approves content."],
  ["Creator", "Submits and revises; can't approve own work."],
  ["Agency", "Submits work; no internal facts."],
  ["Viewer", "Read-only access to results."],
] as const;

const TRUST = [
  ["Isolated per organisation", "Row-level security on every table. One organisation can never read another's data."],
  ["AI calls stay server-side", "If the AI step fails, the audit falls back to rule checks and says so."],
  ["Append-only history", "Versions, audit runs and the activity log can't be edited after the fact."],
] as const;

const pill = "h-11 rounded-full px-5";
const soft = "border-input bg-white/70 text-foreground hover:bg-white";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HERO: interactive 3D scene behind the copy (DESIGN.md §1, §8) */}
      <HeroScene>
        <header className="pointer-events-auto mx-auto flex h-[72px] max-w-[1200px] items-center gap-8">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <span aria-hidden="true" className="size-7 rounded-lg bg-[linear-gradient(135deg,#B9A6E6,#F2B89D)]" />
            INKLOOM AI
          </Link>
          <nav aria-label="Main" className="hidden gap-6 text-sm md:flex">
            {SECTIONS.map(([href, label]) => (
              <a key={href} href={href} className="text-muted-foreground transition-colors duration-150 hover:text-foreground">{label}</a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Button asChild variant="outline" size="sm" className={`rounded-full ${soft}`}><Link href="/login">Sign in</Link></Button>
            <MobileMenu links={SECTIONS} />
          </div>
        </header>

        <div className="mx-auto flex min-h-[560px] max-w-[1200px] items-center pt-16">
          <div className="reveal pointer-events-auto flex max-w-[540px] flex-col gap-6">
            <p className="self-start rounded-full border border-indigo-200 bg-lavender px-3 py-1.5 font-mono text-xs text-indigo-700">Brand governance</p>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.035em] sm:text-6xl">
              <span className="sr-only">INKLOOM AI: </span>
              Check content against your brand before it&apos;s published.
            </h1>
            <p className="text-lg leading-relaxed text-zinc-700">
              A checkpoint between creation and publication: INKLOOM checks content against your approved guidelines, facts and assets,
              explains every issue with its source, and leaves every decision to a person.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className={`${pill} shadow-[0_8px_20px_-10px_rgb(91_75_138/.6)]`}><Link href="/login">Try the demo, no sign-up</Link></Button>
              <Button asChild size="lg" variant="outline" className={`${pill} ${soft}`}><Link href="/dashboard">Open INKLOOM</Link></Button>
            </div>
            <p className="font-mono text-xs text-zinc-500">An audit takes about 40 seconds because it runs on a live AI model. Demo results are labelled “Simulated analysis”.</p>
          </div>
        </div>
      </HeroScene>

      {/* HOW IT WORKS */}
      <section id="how" className="px-6 py-24">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="eyebrow">How it works</p>
            <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">One loop, from brand book to approval</h2>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="card-lift flex flex-col gap-3 rounded-[20px] border bg-white p-6">
                <span className="font-mono text-xs text-zinc-500">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="px-6 pb-24">
        <div className="mx-auto flex max-w-[1200px] flex-wrap gap-4">
          <article className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 rounded-3xl border bg-[#F3EEFA] p-8">
            <p className="eyebrow">Evidence-linked findings</p>
            <h3 className="text-[26px] font-semibold tracking-[-0.02em]">Quote, rule, fix. Side by side.</h3>
            <Image unoptimized src="/images/finding-card.svg" width={1000} height={400} className="h-auto w-full rounded-xl" alt="A highlighted codename in a post, linked to its Critical finding card with the quote, source and suggested fix" />
          </article>
          <article className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-3xl border bg-[#FCF0E8] p-8">
            <p className="eyebrow">Brand score</p>
            <h3 className="text-[26px] font-semibold tracking-[-0.02em]">A score you can explain</h3>
            <Image unoptimized src="/images/score-ring.svg" width={600} height={400} className="h-auto w-full rounded-xl" alt="A tilted score ring showing 53 out of 100 with deductions of 25, 10, 10 and 1.8" />
          </article>
          <article className="flex min-w-0 flex-[1_1_340px] flex-col gap-4 rounded-3xl border bg-[#EEF6F0] p-8">
            <p className="eyebrow">Confidential Guard</p>
            <h3 className="text-[26px] font-semibold tracking-[-0.02em]">Codenames never leak</h3>
            <p className="text-[15px] leading-relaxed text-muted-foreground">Internal terms are caught however they&apos;re spaced or cased. Emails and phone numbers are masked before any AI call.</p>
            <p className="rounded-xl border bg-white p-4 font-mono text-[13px] text-zinc-800">“Project Atlas” · “project  atlas” · “PROJECT-ATLAS” → caught</p>
          </article>
          <article className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 rounded-3xl border bg-[#EEF3FA] p-8">
            <p className="eyebrow">Brand Health</p>
            <h3 className="text-[26px] font-semibold tracking-[-0.02em]">See what keeps going wrong</h3>
            <Image unoptimized src="/images/health-tiles.svg" width={1000} height={340} className="h-auto w-full rounded-xl" alt="Four Brand Health tiles: recurring mistakes, unclear rules, conflicting terms and fact impact" />
          </article>
        </div>
      </section>

      {/* ROLES */}
      <section id="roles" className="border-y bg-sand px-6 py-24">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className="eyebrow">Roles</p>
            <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-[40px]">Everyone sees what they should</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {ROLES.map(([role, text]) => (
              <li key={role} className="card-lift rounded-2xl border bg-white p-5">
                <p className="text-[15px] font-semibold">{role}</p>
                <p className="mt-1.5 text-sm leading-normal text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" className="px-6 py-24">
        <div className="mx-auto grid max-w-[1200px] gap-8 md:grid-cols-3">
          {TRUST.map(([title, text]) => (
            <div key={title} className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="text-[15px] leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-24">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-8 rounded-[28px] border bg-[linear-gradient(120deg,#EDE7F8_0%,#FBE6DA_55%,#E3F0E8_100%)] px-8 py-14 sm:px-12">
          <div className="flex flex-[1_1_400px] flex-col gap-3">
            <h2 className="text-3xl leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">Try it on Northbeam Cloud</h2>
            <p className="text-base text-zinc-700">A seeded demo organisation. Sign in as a brand owner or a reviewer.</p>
          </div>
          <Button asChild size="lg" className={pill}><Link href="/login">Open the demo</Link></Button>
        </div>
      </section>

      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-6 text-sm text-muted-foreground">
          <p>INKLOOM AI · Team Specfix</p>
          <p className="max-w-xl text-xs">AI review runs on Azure AI Foundry when enabled; rule checks run on our server. Demo results are labelled “Simulated analysis”.</p>
        </div>
      </footer>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

const STEPS = [
  ["Set up your brand", "Guidelines, approved facts with expiry dates, terminology, colours and fonts."],
  ["Check before publishing", "Text, PDF, Word, images or a web page, against your own rules."],
  ["See the evidence", "Every finding quotes the text and cites the rule or fact it breaks, with a minimal fix."],
  ["People decide", "Reviewers approve, request changes or waive with a reason. The AI never approves."],
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-10 px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Brand governance</p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">INKLOOM AI</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          A checkpoint between creation and publication: INKLOOM checks content against your approved guidelines, facts and assets,
          explains every issue with its source, and leaves every decision to a person.
        </p>
        <div className="flex gap-3">
          <Button asChild size="lg"><Link href="/dashboard">Open INKLOOM</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
        </div>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="rounded-lg border p-4">
            <p className="text-sm font-semibold"><span className="mr-2 tabular-nums text-muted-foreground">{i + 1}</span>{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">AI review runs on Azure AI Foundry when enabled; rule checks run on our server. Demo results are labelled “Simulated analysis”.</p>
    </main>
  );
}

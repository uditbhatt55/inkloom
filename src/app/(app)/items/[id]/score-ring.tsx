"use client";
import { useEffect, useState } from "react";

/**
 * Score ring (DESIGN.md §5, §8): draws from 0 to the score over 600ms and counts up, once.
 * With prefers-reduced-motion it shows the final value straight away. The number is always in the DOM text.
 */
export function ScoreRing({ score, tone }: { score: number; tone: "critical" | "success" | "primary" }) {
  const [shown, setShown] = useState(score);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(score); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 600);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(score * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score]);

  return (
    <div
      className="flex size-28 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(var(--${tone}) 0 ${shown}%, var(--muted) ${shown}% 100%)` }}
    >
      <p className="flex size-[88px] flex-col items-center justify-center rounded-full bg-card text-3xl font-semibold tracking-tight tabular-nums">
        <span aria-hidden="true">{shown}</span>
        <span className="sr-only">{score}</span>
        <span className="font-mono text-xs font-normal text-muted-foreground">/ 100</span>
      </p>
    </div>
  );
}

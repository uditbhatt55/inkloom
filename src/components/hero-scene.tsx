"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Landing hero background (DESIGN.md §1, §8): a layered CSS-3D scene that tilts toward the pointer.
 * Decorative only (aria-hidden); the cards' hover labels repeat what the page text already says.
 * No WebGL, no extra dependencies; with prefers-reduced-motion it stays still.
 */
export function HeroScene({ children }: { children: React.ReactNode }) {
  const [p, setP] = useState({ x: 0, y: 0 });
  const next = useRef({ x: 0, y: 0 });
  const raf = useRef<number | null>(null);
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  function onMove(e: React.PointerEvent<HTMLElement>) {
    if (still.current || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    next.current = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 };
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = null; setP(next.current); });
  }

  const layer = (d: number) => ({ transform: `translate3d(${(p.x * d).toFixed(1)}px, ${(p.y * d * 0.6).toFixed(1)}px, ${d}px)` });

  return (
    <section
      onPointerMove={onMove}
      onPointerLeave={() => setP({ x: 0, y: 0 })}
      className="relative overflow-hidden bg-[linear-gradient(135deg,#FBF8F3_0%,#F3EEF9_55%,#E9F1EC_100%)] px-6 pb-24"
    >
      <div className="hs-scene" aria-hidden="true">
        <div className="hs-stage" style={{ transform: `rotateY(${(p.x * 9).toFixed(2)}deg) rotateX(${(-p.y * 6).toFixed(2)}deg)` }}>
          <span className="hs-bloom" style={{ left: "20%", top: "10%", width: "70%", height: "70%", background: "radial-gradient(circle, rgb(217 204 242 / .9), rgb(217 204 242 / 0) 70%)" }} />
          <span className="hs-bloom" style={{ left: "55%", top: "55%", width: "50%", height: "45%", background: "radial-gradient(circle, rgb(250 217 200 / .85), rgb(250 217 200 / 0) 70%)" }} />
          <span className="hs-bloom" style={{ left: "5%", top: "60%", width: "50%", height: "40%", background: "radial-gradient(circle, rgb(205 230 215 / .85), rgb(205 230 215 / 0) 70%)" }} />

          {/* pedestal */}
          <div className="hs-layer" style={layer(0)}>
            <svg viewBox="0 0 720 200" width="620" height="172" className="absolute bottom-[3%] left-1/2 -translate-x-1/2 overflow-visible">
              <defs>
                <linearGradient id="hs-pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#ECE6F4" /></linearGradient>
                <linearGradient id="hs-pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F3EEF9" /><stop offset="1" stopColor="#D6CCE6" /></linearGradient>
              </defs>
              <ellipse cx="360" cy="146" rx="350" ry="52" fill="url(#hs-pb)" />
              <ellipse cx="360" cy="134" rx="350" ry="52" fill="url(#hs-pa)" />
              <ellipse className="hs-pulse" cx="360" cy="134" rx="320" ry="42" fill="none" stroke="#C9B8EE" strokeWidth="3" />
              <ellipse cx="360" cy="100" rx="230" ry="36" fill="url(#hs-pb)" />
              <ellipse cx="360" cy="90" rx="230" ry="36" fill="url(#hs-pa)" />
              <ellipse className="hs-pulse [animation-delay:-1.2s]" cx="360" cy="90" rx="206" ry="28" fill="none" stroke="#F2B89D" strokeWidth="2.5" />
              <ellipse cx="360" cy="62" rx="140" ry="22" fill="url(#hs-pb)" />
              <ellipse cx="360" cy="54" rx="140" ry="22" fill="url(#hs-pa)" />
              <ellipse className="hs-pulse [animation-delay:-2.4s]" cx="360" cy="54" rx="112" ry="15" fill="none" stroke="#8FC6A9" strokeWidth="2.5" />
            </svg>
          </div>

          {/* sphere, cube with shield, orbit */}
          <div className="hs-layer" style={layer(28)}>
            <div className="hs-orbit">
              <div className="hs-spin">
                <span className="hs-bead" style={{ left: -8, top: "50%", background: "#B9A6E6" }} />
                <span className="hs-bead" style={{ right: -8, top: "50%", background: "#F2B89D" }} />
                <span className="hs-bead" style={{ left: "50%", bottom: -8, background: "#8FC6A9" }} />
                <span className="hs-bead" style={{ left: "50%", top: 8, background: "#9DBCDD" }} />
              </div>
            </div>
            <div className="hs-sphere">
              <span className="hs-shine" />
              <svg className="hs-cube" viewBox="0 0 240 260" width="190" height="206">
                <defs>
                  <linearGradient id="hs-ct" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" /><stop offset="1" stopColor="#E6DDF7" stopOpacity=".85" /></linearGradient>
                  <linearGradient id="hs-cl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E4DAF6" /><stop offset="1" stopColor="#CFC0EE" /></linearGradient>
                  <linearGradient id="hs-cr" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F7E2D7" /><stop offset="1" stopColor="#E8D3E8" /></linearGradient>
                </defs>
                <path d="M120 10 L220 68 L120 126 L20 68 Z" fill="url(#hs-ct)" stroke="#FFFFFF" strokeWidth="2" />
                <path d="M20 68 L120 126 L120 250 L20 192 Z" fill="url(#hs-cl)" fillOpacity=".85" stroke="#FFFFFF" strokeWidth="2" />
                <path d="M220 68 L120 126 L120 250 L220 192 Z" fill="url(#hs-cr)" fillOpacity=".85" stroke="#FFFFFF" strokeWidth="2" />
                <path d="M120 76 L172 96 L172 138 C172 172 148 194 120 206 C92 194 68 172 68 138 L68 96 Z" fill="#FFFFFF" fillOpacity=".9" stroke="#5B4B8A" strokeWidth="5" strokeLinejoin="round" />
                <path d="M96 142 L114 160 L146 126" fill="none" stroke="#3F7F62" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* floating cards */}
          <div className="hs-layer" style={layer(60)}>
            <Card where={{ left: "2%", top: "10%" }} r={-8} delay={0} label="Image" detail="logo, palette and contrast checked">
              <svg viewBox="0 0 62 46" width="62" height="46"><rect x="1" y="1" width="60" height="44" rx="8" fill="#EDE7F8" stroke="#B9A6E6" strokeWidth="2" /><path d="M6 40 L24 22 L36 34 L44 26 L58 40 Z" fill="#B9A6E6" /><circle cx="48" cy="12" r="5" fill="#F2B89D" /></svg>
            </Card>
            <Card where={{ right: "0%", top: "8%" }} r={7} delay={-1.5} label="Typography" detail="brand fonts and tone of voice">
              <span className="font-serif text-[40px] leading-none text-primary italic">Aa</span>
            </Card>
            <Card where={{ left: "0%", top: "50%" }} r={5} delay={-3} label="Document" detail="facts and claims cited">
              <svg viewBox="0 0 58 68" width="46" height="54"><path d="M2 2 L40 2 L56 18 L56 66 L2 66 Z" fill="#FBE6DA" stroke="#F2B89D" strokeWidth="2" /><rect x="12" y="28" width="32" height="5" rx="2.5" fill="#F2B89D" /><rect x="12" y="42" width="26" height="5" rx="2.5" fill="#F2B89D" /></svg>
            </Card>
            <Card where={{ right: "0%", top: "48%" }} r={-6} delay={-4.5} label="Video" detail="captions and claims reviewed">
              <svg viewBox="0 0 96 58" width="80" height="48"><rect x="1" y="1" width="94" height="56" rx="10" fill="#E3EEF8" stroke="#9DBCDD" strokeWidth="2" /><path d="M40 16 L60 29 L40 42 Z" fill="#6E93BE" /></svg>
            </Card>
            <div className="hs-float" style={{ left: "12%", top: "76%", animationDelay: "-2.2s" }}>
              <div className="hs-card" style={{ "--r": "-3deg" } as React.CSSProperties}>
                <div className="flex h-14 items-end gap-2">
                  {[["40%", "#C9B8EE"], ["60%", "#B9A6E6"], ["80%", "#8FC6A9"], ["100%", "#F2B89D"]].map(([h, c]) => (
                    <span key={c} className="hs-col" style={{ height: h, background: c }} />
                  ))}
                </div>
                <p className="hs-slide"><strong>Brand Health</strong> · fewer repeat mistakes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="hs-fade" aria-hidden="true" />
      {/* the copy layer lets the pointer through to the scene; the header and text column take it back */}
      <div className="pointer-events-none relative z-[2]">{children}</div>
    </section>
  );
}

function Card({ where, r, delay, label, detail, children }: {
  where: React.CSSProperties; r: number; delay: number; label: string; detail: string; children: React.ReactNode;
}) {
  return (
    <div className="hs-float" style={{ ...where, animationDelay: `${delay}s` }}>
      <div className="hs-card" style={{ "--r": `${r}deg` } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          {children}
          <span className="flex flex-col gap-1.5"><span className="hs-bar w-[72px]" /><span className="hs-bar w-[52px] opacity-60" /></span>
          <span className="hs-tick">
            <svg viewBox="0 0 16 16" width="15" height="15"><path d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </div>
        <p className="hs-slide"><strong>{label}</strong> · {detail}</p>
      </div>
    </div>
  );
}

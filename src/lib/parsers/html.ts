import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parse as parseHtml } from "node-html-parser";
import { empty, LIMITS, normaliseText, ParseError, type ParsedContent } from "@/lib/parsers/types";

/* --------------------------------------------------------------- HTML → text */

const BLOCK = new Set(["p", "div", "section", "article", "header", "footer", "main", "aside", "nav", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "br", "tr", "table", "blockquote", "figure", "figcaption", "pre", "hr"]);

/** Visible text with block breaks, image alt texts, and nothing from scripts/styles/templates. */
export function parseHtmlContent(html: string, url?: string): ParsedContent {
  const root = parseHtml(html, { comment: false, blockTextElements: { script: false, style: false, noscript: false, template: false } });
  for (const el of root.querySelectorAll("script,style,noscript,template,svg,iframe")) el.remove();
  const out = empty("html", "");

  const parts: string[] = [];
  const walk = (node: ReturnType<typeof parseHtml>) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) parts.push(child.text.replace(/\s+/g, " "));
      else if (child.nodeType === 1) {
        const tag = (child as ReturnType<typeof parseHtml>).rawTagName?.toLowerCase() ?? "";
        if (BLOCK.has(tag)) parts.push("\n");
        walk(child as ReturnType<typeof parseHtml>);
        if (BLOCK.has(tag)) parts.push("\n");
      }
    }
  };
  walk(root.querySelector("body") ?? root);
  const text = parts.join("").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
  out.text = normaliseText(text, out.warnings);

  root.querySelectorAll("img").forEach((img, i) => {
    const decorative = ["presentation", "none"].includes(img.getAttribute("role") ?? "") || img.getAttribute("aria-hidden") === "true";
    const alt = img.getAttribute("alt");
    out.images.push({ label: img.getAttribute("src")?.split("/").pop()?.slice(0, 60) || `Image ${i + 1}`, alt: decorative ? "" : alt ?? null });
  });
  if (url) out.meta.url = url;
  return out;
}

/* ------------------------------------------------------- SSRF-safe page fetch */

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}

/** True for loopback, private, link-local, CGNAT, multicast, reserved and IPv4-mapped private addresses. */
export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return ipv4Private(ip);
  if (v === 6) {
    const s = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
    if (mapped) return ipv4Private(mapped[1]);
    return s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s) || s.startsWith("64:ff9b:") || s.startsWith("2001:db8");
  }
  return true; // not an IP at all: refuse
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ParseError("fetch_blocked", "That is not a valid web address.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new ParseError("fetch_blocked", "Only http and https pages can be audited.");
  if (url.username || url.password) throw new ParseError("fetch_blocked", "Addresses with a username or password are not allowed.");
  if (url.port && !["80", "443"].includes(url.port)) throw new ParseError("fetch_blocked", "Only standard web ports (80, 443) are allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addrs: string[];
  try {
    addrs = isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch {
    throw new ParseError("fetch_failed", "That website could not be found.");
  }
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new ParseError("fetch_blocked", "That address points to a private or internal network and cannot be audited.");
  return url;
}

/**
 * Fetches a public web page for auditing (§7.1, §10.1): http(s) only, public addresses only (re-checked on every redirect),
 * size and time limits, HTML only. Shortcut: DNS is resolved before fetch, so a rebinding attack between lookup and connect
 * is not covered; acceptable for the MVP, noted in docs/decisions.md.
 */
export async function fetchPage(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<ParsedContent> {
  let url = await assertPublicUrl(rawUrl);
  for (let hop = 0; ; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), LIMITS.fetchTimeoutMs);
    try {
      let res: Response;
      try {
        res = await fetchImpl(url, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": "InkloomAudit/0.1", accept: "text/html" } });
      } catch {
        throw new ParseError("fetch_failed", "The page could not be loaded.");
      }
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        if (hop >= LIMITS.maxRedirects) throw new ParseError("fetch_failed", "The page redirected too many times.");
        url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
        continue;
      }
      if (!res.ok) throw new ParseError("fetch_failed", `The page returned an error (HTTP ${res.status}).`);
      if (!/text\/html|application\/xhtml/i.test(res.headers.get("content-type") ?? "")) throw new ParseError("unsupported", "That address is not an HTML page.");
      const declared = Number(res.headers.get("content-length") ?? 0);
      if (declared > LIMITS.htmlBytes) throw new ParseError("too_large", "That page is too large to audit.");
      const html = await readLimited(res, LIMITS.htmlBytes);
      return parseHtmlContent(html, url.toString());
    } finally {
      clearTimeout(timer);
    }
  }
}

async function readLimited(res: Response, max: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new ParseError("too_large", "That page is too large to audit.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

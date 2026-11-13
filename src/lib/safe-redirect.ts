/** Only same-site paths may be used as a post-login redirect ("/items/1"), never "//evil.com" or "https://…". */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return fallback;
  return next;
}

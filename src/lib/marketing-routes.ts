/**
 * Marketing / pre-auth route allowlists.
 *
 * PUBLIC_PATHS — proxy (`src/proxy.ts`) lets these through without a session.
 * CHROMELESS_PATHS — AppShell / pollers hide chrome (full-bleed pages).
 *
 * Keep both in sync when adding landing surfaces (`/changelog`, etc.).
 */
export const PUBLIC_PATHS = new Set([
  '/sign-in',
  '/',
  '/changelog',
  '/presence',
]);

export const PUBLIC_API_PREFIXES = ['/api/auth/', '/api/public/'] as const;

export const CHROMELESS_PATHS = new Set([
  '/sign-in',
  '/',
  '/changelog',
  '/presence',
]);

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

export function isChromelessPath(pathname: string): boolean {
  return CHROMELESS_PATHS.has(pathname);
}

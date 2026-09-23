import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * ⚠️ ARCHIVO COMPARTIDO — SSO por cookie apex (spec Vento HUB §3.3).
 * Debe ser BYTE-IDÉNTICO en vento-hub, vento-cms y cota (Kaze), y pasarse en TODA
 * instanciación de cliente (browser, server y proxy) de AMBAS apps.
 * Si cambias algo aquí: cámbialo en el otro repo y despliega los dos.
 *
 * - El dominio apex viene de NEXT_PUBLIC_COOKIE_DOMAIN, definida SOLO en
 *   el scope Production de Vercel (=.ventosolutions.ca). Así localhost y
 *   los preview deployments (*.vercel.app) usan cookie host-only y el
 *   login no se rompe fuera de producción. (NEXT_PUBLIC_ porque el
 *   browser client la necesita inlined en el bundle.)
 * - NUNCA httpOnly: el browser client escribe vía document.cookie.
 * - Cambiar estas opciones deja cookies host-only viejas que las
 *   versiones actuales de @supabase/ssr limpian al escribir; puede
 *   requerir UN re-login de usuarios existentes.
 */
const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export const sharedCookieOptions: CookieOptionsWithName = {
  ...(domain ? { domain } : {}),
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};

import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// 1. Admin subdomain (production): with ADMIN_HOST=admin.brmcc.org the portal is served only there.
//    /admin on the main site redirects to the admin host; the admin host serves only the portal.
// 2. Optimistic sign-in check for the portal (the portal layout does the real check every request).
// 3. Stricter security headers on admin pages.

const ADMIN_HOST = process.env.ADMIN_HOST || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
// Redirect targets come from configuration, never from the incoming request URL (behind a proxy
// that can be an internal address).
const SITE_ORIGIN = new URL(APP_URL).origin;
const ADMIN_ORIGIN = ADMIN_HOST ? `${new URL(APP_URL).protocol}//${ADMIN_HOST}` : SITE_ORIGIN;

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/set-password"];
// Paths the admin host may serve besides /admin (framework assets, uploads, APIs, logo).
const ADMIN_HOST_PASSTHROUGH = ["/admin", "/_next", "/api", "/media", "/brand"];
const passesThrough = (path: string) => path === "/favicon.ico" || ADMIN_HOST_PASSTHROUGH.some((p) => path === p || path.startsWith(`${p}/`));

function adminHeaders(res: NextResponse) {
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

// `signedIn`: an optimistic check only (the portal layout checks properly on every request).
function handle(request: NextRequest, signedIn: boolean) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? "";
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  if (ADMIN_HOST) {
    const onAdminHost = host === ADMIN_HOST;
    if (!onAdminHost && isAdminPath) return NextResponse.redirect(`${ADMIN_ORIGIN}${pathname}${search}`);
    if (onAdminHost && pathname === "/") return NextResponse.redirect(`${ADMIN_ORIGIN}/admin`);
    if (onAdminHost && !passesThrough(pathname)) return NextResponse.redirect(`${SITE_ORIGIN}${pathname}${search}`);
  }

  if (!isAdminPath) return NextResponse.next();

  const isPublicAdminPage = PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isPublicAdminPage && !signedIn) {
    const url = new URL("/admin/login", ADMIN_ORIGIN);
    url.searchParams.set("next", `${pathname}${search}`);
    return adminHeaders(NextResponse.redirect(url));
  }
  return adminHeaders(NextResponse.next());
}

// AUTH_PROVIDER=clerk: Clerk reads its session first; dev: the local session cookie.
export const proxy =
  process.env.AUTH_PROVIDER === "clerk"
    ? clerkMiddleware(async (auth, request) => handle(request, !!(await auth()).userId))
    : (request: NextRequest) => handle(request, request.cookies.has("bmcc_session"));

export const config = {
  // Everything except Next's static files (the admin-host rules need to see public paths too).
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

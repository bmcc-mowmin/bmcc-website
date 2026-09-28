import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: no session cookie → straight to sign-in. The admin layout does the
// real check (valid signature, user exists, role = ADMIN) on every request.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("bmcc_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin", "/admin/:path*"] };

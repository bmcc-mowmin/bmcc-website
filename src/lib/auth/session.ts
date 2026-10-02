import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

// Session cookie for the local dev-login provider (AUTH_PROVIDER=dev).
// A signed JWT holding only the user id; the user's role is always re-read from the database.
export const SESSION_COOKIE = "bmcc_session";
// Staff sessions are short; members stay signed in for a month on their own device.
export const STAFF_SESSION_SEC = 8 * 60 * 60;
export const MEMBER_SESSION_SEC = 30 * 24 * 60 * 60;

const key = () => new TextEncoder().encode(env.SESSION_SECRET);

export async function createSession(userId: string, maxAgeSec = STAFF_SESSION_SEC) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(key());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });
}

export async function readSession(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !env.SESSION_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

// First-time LOCAL setup: creates .env with local defaults and fills in local secrets.
// Safe to re-run; it never overwrites values you have already set.
// (On this branch no env template is committed. Hosted settings live in Render — see render.yaml.)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

// Local development defaults (Postgres + Mailpit from docker-compose). Anything not listed here
// falls back to the default in src/lib/env.ts.
const LOCAL_DEFAULTS = `APP_ENV=local
APP_URL=http://localhost:3000
APP_PORT=3000
POSTGRES_USER=bmcc
POSTGRES_PASSWORD=bmcc
POSTGRES_DB=bmcc
POSTGRES_PORT=5432
DATABASE_URL=postgresql://bmcc:bmcc@localhost:5432/bmcc
AUTH_PROVIDER=dev
SESSION_SECRET=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/account
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/account
SEED_ADMIN_EMAIL=admin@bmcc.local
SEED_ADMIN_PASSWORD=
SEED_MEMBER_EMAIL=member@bmcc.local
SEED_MEMBER_PASSWORD=
SEED_STAFF_PASSWORD=
MAIL_TRANSPORT=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
MAILPIT_UI_PORT=8025
MAILPIT_SMTP_PORT=1025
MAILPIT_API_URL=http://localhost:8025
PAYMENT_PROVIDER=mock
STORAGE_DRIVER=local
UPLOAD_DIR=./uploads
PLAYWRIGHT_BASE_URL=http://localhost:3000
`;

const generated = {
  SESSION_SECRET: () => randomBytes(32).toString("base64url"),
  SEED_ADMIN_PASSWORD: () => "admin-" + randomBytes(6).toString("base64url"),
  SEED_MEMBER_PASSWORD: () => "member-" + randomBytes(6).toString("base64url"),
  SEED_STAFF_PASSWORD: () => "staff-" + randomBytes(6).toString("base64url"),
};

let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
if (!env) console.log("Creating .env with local defaults");
// Add any local default this .env doesn't have yet.
for (const line of LOCAL_DEFAULTS.split("\n")) {
  const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
  if (key && !new RegExp(`^${key}=`, "m").test(env)) {
    env += `${env === "" || env.endsWith("\n") ? "" : "\n"}${line}\n`;
  }
}
for (const [key, make] of Object.entries(generated)) {
  const re = new RegExp(`^${key}=\\s*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, `${key}=${make()}`);
    console.log(`Generated ${key}`);
  }
}
writeFileSync(".env", env);
console.log("Test account passwords are in .env (SEED_ADMIN_PASSWORD, SEED_MEMBER_PASSWORD, SEED_STAFF_PASSWORD).");

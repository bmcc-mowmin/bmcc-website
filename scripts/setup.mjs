// First-time local setup: creates .env from .env.example and fills in local secrets.
// Safe to re-run; it never overwrites values you have already set.
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  console.log("Created .env from .env.example");
}

const generated = {
  SESSION_SECRET: () => randomBytes(32).toString("base64url"),
  SEED_ADMIN_PASSWORD: () => "admin-" + randomBytes(6).toString("base64url"),
  SEED_MEMBER_PASSWORD: () => "member-" + randomBytes(6).toString("base64url"),
};

let env = readFileSync(".env", "utf8");
for (const [key, make] of Object.entries(generated)) {
  const re = new RegExp(`^${key}=\\s*$`, "m");
  if (re.test(env)) {
    env = env.replace(re, `${key}=${make()}`);
    console.log(`Generated ${key}`);
  }
}
writeFileSync(".env", env);
console.log("Test account passwords are in .env (SEED_ADMIN_PASSWORD / SEED_MEMBER_PASSWORD).");

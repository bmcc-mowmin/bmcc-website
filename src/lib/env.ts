import "server-only";
import { z } from "zod";

// All settings come from environment variables and are validated once at startup.
// Anything that differs between local and production is a setting here, never a code change.

const bool = z
  .enum(["true", "false", ""])
  .optional()
  .transform((v) => v === "true");
const optional = z.string().optional().transform((v) => (v ? v : undefined));

const schema = z
  .object({
    APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
    APP_URL: z.url().default("http://localhost:3000"),
    // Production: the admin portal's own host, e.g. "admin.brmcc.org". Blank = served at /admin.
    ADMIN_HOST: optional,
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

    DATABASE_URL: z.string().min(1),

    AUTH_PROVIDER: z.enum(["dev", "clerk"]).default("dev"),
    SESSION_SECRET: optional,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optional,
    CLERK_SECRET_KEY: optional,
    CLERK_WEBHOOK_SECRET: optional,

    MAIL_TRANSPORT: z.enum(["smtp", "resend", "postmark"]).default("smtp"),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_SECURE: bool,
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    MAIL_PROVIDER_API_KEY: optional,
    MAIL_FROM: z.string().default("BMCC <no-reply@brmcc.org>"),
    MAIL_REPLY_TO: optional,
    CONTACT_INBOX: z.string().default("info@brmcc.org"),

    PAYMENT_PROVIDER: z.enum(["mock", "stripe"]).default("mock"),
    STRIPE_SECRET_KEY: optional,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    STRIPE_PRICE_MEMBERSHIP_MONTHLY: optional,
    STRIPE_PRICE_MEMBERSHIP_YEARLY: optional,
    DEFAULT_DONATION_FREQUENCY: z.enum(["one-time", "monthly"]).default("monthly"),

    ORG_LEGAL_NAME: z.string().default("Brentwood Muslim Community Center"),
    ORG_EIN: optional,
    ORG_ADDRESS: z.string().default("7701 Lone Tree Way, Brentwood, CA 94513"),
    ORG_PHONE: z.string().default("925-298-BMCC (2622)"),
    ORG_PHONE_TEL: z.string().default("+19252982622"),
    ORG_EMAIL: z.string().default("info@brmcc.org"),

    MASJID_TIMEZONE: z.string().default("America/Los_Angeles"),
    MASJID_LAT: z.coerce.number().default(37.93),
    MASJID_LNG: z.coerce.number().default(-121.7),

    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_DIR: z.string().default("./uploads"),
    S3_ENDPOINT: optional,
    S3_REGION: optional,
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_PUBLIC_URL: optional,

    RATE_LIMIT_WINDOW_SEC: z.coerce.number().int().positive().default(600),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional,
    TURNSTILE_SECRET_KEY: optional,

    GOOGLE_MAPS_EMBED_API_KEY: optional,
    SHOW_RESUB_BAR_SITEWIDE: bool,
  })
  .superRefine((e, ctx) => {
    const need = (key: keyof typeof e, why: string) => {
      if (!e[key]) ctx.addIssue({ code: "custom", path: [key], message: `required ${why}` });
    };
    if (e.AUTH_PROVIDER === "dev") {
      need("SESSION_SECRET", "when AUTH_PROVIDER=dev");
      if (e.APP_ENV === "production")
        ctx.addIssue({ code: "custom", path: ["AUTH_PROVIDER"], message: "dev login is not allowed in production" });
    }
    if (e.AUTH_PROVIDER === "clerk") {
      need("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "when AUTH_PROVIDER=clerk");
      need("CLERK_SECRET_KEY", "when AUTH_PROVIDER=clerk");
      // Development keys on the live site would send members to Clerk's test instance.
      if (e.APP_ENV === "production" && (e.CLERK_SECRET_KEY?.startsWith("sk_test_") || e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_")))
        ctx.addIssue({ code: "custom", path: ["CLERK_SECRET_KEY"], message: "use Clerk production keys (pk_live_/sk_live_) in production" });
    }
    if (e.PAYMENT_PROVIDER === "mock" && e.APP_ENV === "production")
      ctx.addIssue({ code: "custom", path: ["PAYMENT_PROVIDER"], message: "mock payments are not allowed in production" });
    if (e.PAYMENT_PROVIDER === "stripe") {
      need("STRIPE_SECRET_KEY", "when PAYMENT_PROVIDER=stripe");
      need("STRIPE_WEBHOOK_SECRET", "when PAYMENT_PROVIDER=stripe");
      need("STRIPE_PRICE_MEMBERSHIP_MONTHLY", "when PAYMENT_PROVIDER=stripe");
      need("STRIPE_PRICE_MEMBERSHIP_YEARLY", "when PAYMENT_PROVIDER=stripe");
    }
    if (e.MAIL_TRANSPORT !== "smtp") need("MAIL_PROVIDER_API_KEY", `when MAIL_TRANSPORT=${e.MAIL_TRANSPORT}`);
    if (e.STORAGE_DRIVER === "s3") {
      for (const k of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const)
        need(k, "when STORAGE_DRIVER=s3");
    }
  });

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment settings:\n${lines.join("\n")}\nSee .env.example.`);
  }
  return parsed.data;
}

export const env = load();
export const isProduction = env.APP_ENV === "production";

// Absolute URL of an admin page (used in invite emails).
export function adminUrl(path: string) {
  if (!env.ADMIN_HOST) return `${env.APP_URL}${path}`;
  const protocol = new URL(env.APP_URL).protocol;
  return `${protocol}//${env.ADMIN_HOST}${path}`;
}

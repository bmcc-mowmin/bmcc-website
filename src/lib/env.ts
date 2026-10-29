import "server-only";
import { z } from "zod";
import { DEFAULT_PAYMENT_METHODS, methodsInUse, parsePaymentMethods } from "@/lib/payments/methods";

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

    // "off" = send nothing (each skipped email is logged) — for a hosted test site before email is set up.
    MAIL_TRANSPORT: z.enum(["smtp", "resend", "postmark", "off"]).default("smtp"),
    SMTP_HOST: z.string().default("localhost"),
    SMTP_PORT: z.coerce.number().int().default(1025),
    SMTP_SECURE: bool,
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    MAIL_PROVIDER_API_KEY: optional,
    MAIL_FROM: z.string().default("BMCC <no-reply@brmcc.org>"),
    MAIL_REPLY_TO: optional,
    CONTACT_INBOX: z.string().default("info@brmcc.org"),

    // mock = the site's own test checkout (no money). live = real providers, chosen per payment
    // type by PAYMENT_METHODS (src/lib/payments/methods.ts). "stripe" is accepted as an old name for live.
    PAYMENT_PROVIDER: z.preprocess((v) => (v === "stripe" ? "live" : v), z.enum(["mock", "live"]).default("mock")),
    PAYMENT_METHODS: z.string().default(DEFAULT_PAYMENT_METHODS),
    // Stripe hosted Checkout. Prices are created per checkout, so no Stripe products need setting up.
    STRIPE_SECRET_KEY: optional,
    STRIPE_WEBHOOK_SECRET: optional,
    // PayPal (Orders for one-time gifts, Subscriptions for monthly gifts and dues).
    PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
    PAYPAL_CLIENT_ID: optional,
    PAYPAL_CLIENT_SECRET: optional,
    PAYPAL_WEBHOOK_ID: optional,
    // Subscription plans, created once with `npm run paypal:setup` (prices are set per subscription).
    PAYPAL_PLAN_MONTHLY: optional,
    PAYPAL_PLAN_YEARLY: optional,
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

    // Which visitor address rate limits count (src/lib/security/client-ip.ts). Behind Cloudflare
    // (including Render, whose edge is Cloudflare): CLIENT_IP_HEADER=cf-connecting-ip.
    CLIENT_IP_HEADER: z
      .string()
      .optional()
      .transform((v) => (v ? v.trim().toLowerCase() : undefined)),
    TRUSTED_PROXY_HOPS: z.coerce.number().int().min(1).max(10).default(1),
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
    const methods = parsePaymentMethods(e.PAYMENT_METHODS);
    if (!methods.ok) {
      for (const m of methods.errors) ctx.addIssue({ code: "custom", path: ["PAYMENT_METHODS"], message: m });
    } else if (e.PAYMENT_PROVIDER === "live") {
      const used = methodsInUse(methods.map);
      if (used.has("stripe")) {
        need("STRIPE_SECRET_KEY", "when Stripe is in PAYMENT_METHODS");
        // Renewals and failed payments arrive only by webhook.
        if (e.APP_ENV === "production") need("STRIPE_WEBHOOK_SECRET", "in production when Stripe is in PAYMENT_METHODS");
        if (e.APP_ENV === "production" && e.STRIPE_SECRET_KEY?.startsWith("sk_test_"))
          ctx.addIssue({ code: "custom", path: ["STRIPE_SECRET_KEY"], message: "use a live Stripe key (sk_live_) in production" });
      }
      if (used.has("paypal")) {
        need("PAYPAL_CLIENT_ID", "when PayPal is in PAYMENT_METHODS");
        need("PAYPAL_CLIENT_SECRET", "when PayPal is in PAYMENT_METHODS");
        if (e.APP_ENV === "production") need("PAYPAL_WEBHOOK_ID", "in production when PayPal is in PAYMENT_METHODS");
        if (e.APP_ENV === "production" && e.PAYPAL_ENV !== "live")
          ctx.addIssue({ code: "custom", path: ["PAYPAL_ENV"], message: "use PAYPAL_ENV=live in production" });
        if (methods.map.donation_monthly.includes("paypal") || methods.map.dues.includes("paypal")) need("PAYPAL_PLAN_MONTHLY", "when PayPal takes monthly payments (npm run paypal:setup)");
        if (methods.map.dues.includes("paypal")) need("PAYPAL_PLAN_YEARLY", "when PayPal takes yearly dues (npm run paypal:setup)");
      }
    }
    if (e.MAIL_TRANSPORT === "resend" || e.MAIL_TRANSPORT === "postmark") need("MAIL_PROVIDER_API_KEY", `when MAIL_TRANSPORT=${e.MAIL_TRANSPORT}`);
    if (e.STORAGE_DRIVER === "s3") {
      for (const k of ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const)
        need(k, "when STORAGE_DRIVER=s3");
    }
  });

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment settings:\n${lines.join("\n")}\nSee RENDER.md for the full list.`);
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

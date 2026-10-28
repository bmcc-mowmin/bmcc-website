import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  // Security headers on every response. Admin pages additionally get X-Frame-Options: DENY,
  // no-referrer, noindex and no-store from src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HTTPS only. Short max-age while the domain moves; raise to 31536000 after launch is stable.
          { key: "Strict-Transport-Security", value: "max-age=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Only this site may frame its pages (clickjacking). A full Content-Security-Policy must also
          // allow Clerk, Turnstile, Stripe/PayPal and Constant Contact — see TECH_TODO.md.
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Admin uploads (timetable PDFs up to 10 MB) plus multipart overhead.
      bodySizeLimit: "11mb",
      // Extra hosts a reverse proxy/tunnel may serve the site from (comma-separated, wildcards
      // allowed), e.g. SERVER_ACTIONS_ALLOWED_ORIGINS=*.connect.remote.it. Read at build time.
      allowedOrigins: (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
  },
};

export default nextConfig;

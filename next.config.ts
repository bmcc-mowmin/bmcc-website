import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  poweredByHeader: false,
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

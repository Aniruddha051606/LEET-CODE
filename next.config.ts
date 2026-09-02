import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Next generates AGENTS.md / CLAUDE.md on `next dev`; not part of this project.
  agentRules: false,
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "pg"],
  // The database CA certificate is read from disk at runtime. Next's output tracer
  // cannot see a dynamic readFileSync, so the file is included explicitly — otherwise
  // it is absent from the serverless bundle and every query fails on Vercel.
  outputFileTracingIncludes: {
    "/**": ["./certs/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const isStaticPreview = process.env.STATIC_EXPORT === "true";
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: isStaticPreview ? "true" : "false",
  },
  ...(isStaticPreview ? { output: "export" as const, assetPrefix: "." } : {}),
  ...(!isStaticPreview
    ? {
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }
    : {}),
} satisfies NextConfig;

export default nextConfig;


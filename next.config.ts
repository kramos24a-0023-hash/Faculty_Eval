import type { NextConfig } from "next";

const isStaticPreview = process.env.STATIC_EXPORT === "true";

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_STATIC_EXPORT: isStaticPreview ? "true" : "false",
  },
  ...(isStaticPreview ? { output: "export" as const, assetPrefix: "." } : {}),
} satisfies NextConfig;

export default nextConfig;

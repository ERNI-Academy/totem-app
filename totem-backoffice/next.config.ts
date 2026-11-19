import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["pg", "playwright-core", "@sparticuz/chromium", "sharp"],
  outputFileTracingRoot: require("node:path").resolve(__dirname, ".."),
  outputFileTracingIncludes: {
    "/api/visualisations/**/*": ["../packages/totem-original/web/**/*", "../packages/totem-original/resources/icons/**/*", "../packages/totem-original/resources/animations/*", "../packages/totem-original/resources/fonts/*", "../packages/totem-original/web-editor/*"],
    "/api/visualisations/*/publish": ["../node_modules/@sparticuz/chromium/bin/**/*"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ] }];
  }
};

export default nextConfig;

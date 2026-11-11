import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/** Hosts that may serve product photos: the API (admin uploads) and this site (bundled placeholder art). */
const imageHosts = [process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000', process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'].map(
  (origin) => new URL(origin),
);

const nextConfig: NextConfig = {
  // This app lives next to the API in the same repo; pin the root so Next doesn't guess.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  images: {
    // The bundled placeholders in /public/images are SVG illustrations we generate ourselves.
    // SVGs are served as-is (not rasterised) and sandboxed by this CSP.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // In development the API and the site are both on localhost, a private address Next's image
    // optimiser refuses to fetch, so images are served as they are. Production optimises them.
    unoptimized: isDev,
    remotePatterns: imageHosts.map((url) => ({
      protocol: url.protocol.replace(':', '') as 'http' | 'https',
      hostname: url.hostname,
      port: url.port,
    })),
  },
};

export default nextConfig;

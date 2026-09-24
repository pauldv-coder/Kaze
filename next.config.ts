import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Un proceso grande (reference/captura/ejemplos/grande.json) y el envío a revisión, que lleva el
    // SVG del diagrama (≤ 2 MB), pasan del 1 MB por defecto. Vercel corta en 4,5 MB.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;

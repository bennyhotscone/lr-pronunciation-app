import type { NextConfig } from "next";

/**
 * Transformers.js / ONNX Runtime Web prefer cross-origin isolation so they can
 * use SharedArrayBuffer + multi-threaded WASM. Without these headers the model
 * still runs (single-threaded WASM), but production often looks "broken" when
 * workers fail or when browsers warn about missing COOP/COEP.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

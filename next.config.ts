import type { NextConfig } from "next";

/**
 * Transformers.js / ONNX Runtime Web prefer cross-origin isolation so they can
 * use SharedArrayBuffer + multi-threaded WASM. Without these headers the model
 * still runs (single-threaded WASM), but production often looks "broken" when
 * workers fail or when browsers warn about missing COOP/COEP.
 */
const nextConfig: NextConfig = {
  // tesseract.js loads WASM/workers at runtime — keep it external to the bundler.
  serverExternalPackages: ["tesseract.js"],
  async redirects() {
    return [
      // Legacy singular path (bookmarks / old screenshots used /teacher/class/:id)
      {
        source: "/teacher/class/:id",
        destination: "/teacher/classes/:id",
        permanent: false,
      },
    ];
  },
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

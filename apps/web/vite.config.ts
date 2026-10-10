import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "mam-chung-pwa",
      apply: "build",
      generateBundle(_options, bundle) {
        const files = [
          ...Object.keys(bundle).filter((name) => name.startsWith("assets/")),
          "offline.html",
          "favicon.svg",
          "manifest.webmanifest",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/maskable-512.png",
        ].map((name) => "/" + name);
        const version = createHash("sha256")
          .update(JSON.stringify(files))
          .update(
            readFileSync(new URL("./public/favicon.svg", import.meta.url)),
          )
          .update(
            readFileSync(
              new URL("./public/manifest.webmanifest", import.meta.url),
            ),
          )
          .update(
            readFileSync(
              new URL("./public/icons/icon-192.png", import.meta.url),
            ),
          )
          .update(
            readFileSync(
              new URL("./public/icons/icon-512.png", import.meta.url),
            ),
          )
          .update(
            readFileSync(
              new URL("./public/icons/maskable-512.png", import.meta.url),
            ),
          )
          .update(
            readFileSync(new URL("./public/offline.html", import.meta.url)),
          )
          .update(readFileSync(new URL("./sw-template.js", import.meta.url)))
          .digest("hex")
          .slice(0, 16);
        const source = readFileSync(
          new URL("./sw-template.js", import.meta.url),
          "utf8",
        )
          .replace("__VERSION__", version)
          .replace("__PRECACHE__", JSON.stringify(files));
        this.emitFile({ type: "asset", fileName: "sw.js", source });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/recharts|d3-|victory-vendor/.test(id)) return "charts";
            if (
              /react-dom|node_modules[\\/]react[\\/]|scheduler|react-router/.test(
                id,
              )
            )
              return "react-vendor";
          }
        },
      },
    },
  },
  server: { port: 5180, proxy: { "/api": "http://127.0.0.1:4000" } },
  test: {
    maxWorkers: 2,
    minWorkers: 1,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    testTimeout: 10000,
  },
});

"use strict";
// Single-origin hosting for Render Free; existing Docker entry point is unchanged.
const path = require("node:path");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const apiRequire = createRequire(path.resolve(__dirname, "../apps/api/package.json"));
const express = apiRequire("express");
const helmet = apiRequire("helmet");
const mongoose = apiRequire("mongoose");
if (!process.env.CORS_ORIGIN && process.env.RENDER_EXTERNAL_URL) {
  process.env.CORS_ORIGIN = new URL(process.env.RENDER_EXTERNAL_URL).origin;
}
const { app: api } = require("../apps/api/dist/app");
const { env } = require("../apps/api/dist/config/env");
const { connectDatabase } = require("../apps/api/dist/config/db");
const { startRecurringJob } = require("../apps/api/dist/modules/planning/job");
const { startTaskReminderJob } = require("../apps/api/dist/modules/tasks/job");
const webRoot = path.resolve(__dirname, "../apps/web/dist");
if (!fs.existsSync(path.join(webRoot, "index.html"))) {
  throw new Error("Missing frontend build. Run npm run build first.");
}
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY_HOPS);
// Delegate API requests without changing their path or authentication behavior.
app.use((req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
    return api(req, res, next);
  }
  next();
});
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "blob:"], connectSrc: ["'self'"],
  workerSrc: ["'self'"], manifestSrc: ["'self'"],
  frameAncestors: ["'none'"], formAction: ["'self'"], objectSrc: ["'none'"],
} } }));
app.use((_req, res, next) => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  next();
});
app.get("/healthz", (_req, res) => res.type("text").send("ok\n"));
app.use(express.static(webRoot, {
  dotfiles: "deny", index: false,
  setHeaders(res, file) {
    const assetDir = path.join(webRoot, "assets") + path.sep;
    res.setHeader("Cache-Control", file.startsWith(assetDir)
      ? "public, max-age=31536000, immutable" : "no-store");
  },
}));
app.get("*", (req, res) => {
  if (req.path.split("/").some(part => part.startsWith(".")) ||
      path.extname(req.path) || !req.accepts("html")) {
    return res.status(404).end();
  }
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(path.join(webRoot, "index.html"));
});
async function start() {
  await connectDatabase();
  const server = app.listen(env.PORT, "0.0.0.0", () => console.log("Mam Chung is ready"));
  const stops = [startRecurringJob(), startTaskReminderJob()];
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => {
      Promise.all(stops.map(fn => fn()))
        .then(() => mongoose.disconnect())
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
start().catch(() => {
  console.error("Startup failed. Check private environment configuration and MongoDB connectivity.");
  process.exit(1);
});

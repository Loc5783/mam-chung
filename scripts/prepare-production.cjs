const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
function configuration(domain, email) {
  if (
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
      domain || "",
    ) ||
    /\.(?:localhost|local|test)$/i.test(domain)
  )
    throw Error("Use a real hostname without scheme, path or port.");
  if (!/^[a-z0-9.!%+_-]+@[a-z0-9.-]+\.[a-z]{2,63}$/i.test(email || ""))
    throw Error("Use a valid certificate contact email.");
  const secret = () => crypto.randomBytes(48).toString("base64url");
  return `DOMAIN=${domain.toLowerCase()}\nACME_EMAIL=${email}\nJWT_SECRET=${secret()}\nMONGO_ROOT_PASSWORD=${secret()}\nMONGO_APP_PASSWORD=${secret()}\nMONGO_BACKUP_PASSWORD=${secret()}\nBACKUP_INTERVAL_SECONDS=86400\n`;
}
function writeConfiguration(file, domain, email) {
  const content = configuration(domain, email);
  fs.writeFileSync(file, content, { flag: "wx", mode: 0o600 });
}
if (require.main === module) {
  try {
    writeConfiguration(
      path.resolve(__dirname, "../.env.production"),
      process.argv[2],
      process.argv[3],
    );
    console.log(
      "Created private .env.production. Existing files are never overwritten; secrets are not printed.",
    );
  } catch (e) {
    console.error(
      e.code === "EEXIST"
        ? ".env.production already exists; keep it or rotate credentials deliberately."
        : e.message,
    );
    process.exitCode = 1;
  }
}
module.exports = { configuration, writeConfiguration };

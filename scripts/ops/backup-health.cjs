const fs = require("node:fs");
const path = require("node:path");
function healthy(
  directory = "/backups",
  seconds = Number(process.env.BACKUP_INTERVAL_SECONDS || 86400),
  now = Date.now(),
) {
  try {
    const last = JSON.parse(
      fs.readFileSync(path.join(directory, "last-success.json"), "utf8"),
    );
    const age = now - Date.parse(last.at);
    return (
      Number.isSafeInteger(seconds) &&
      seconds >= 60 &&
      Number.isFinite(age) &&
      age >= 0 &&
      age <= seconds * 2000 &&
      /^mam-chung-[0-9TZ]+-[a-f0-9]{8}\.archive\.gz$/.test(last.archive) &&
      fs.statSync(path.join(directory, last.archive)).size > 0 &&
      fs.statSync(path.join(directory, last.archive + ".sha256")).size > 0
    );
  } catch {
    return false;
  }
}
if (require.main === module) process.exitCode = healthy() ? 0 : 1;
module.exports = { healthy };

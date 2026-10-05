// Run using mongosh --nodb. Secrets stay in environment, never in CLI arguments.
const admin = new Mongo("mongodb://mongo:27017/?directConnection=true").getDB(
  "admin",
);
if (!admin.auth("mam_admin", process.env.MONGO_ROOT_PASSWORD))
  throw Error("MongoDB admin authentication failed");
try {
  const status = admin.runCommand({ replSetGetStatus: 1 });
  if (status.ok !== 1) throw status;
} catch (e) {
  if (e.code !== 94 && e.codeName !== "NotYetInitialized") throw e;
  const result = admin.runCommand({
    replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "mongo:27017" }] },
  });
  if (result.ok !== 1) throw Error("Replica set initialization failed");
}
let ready = false;
for (let i = 0; i < 120; i++) {
  if (admin.runCommand({ hello: 1 }).isWritablePrimary) {
    ready = true;
    break;
  }
  sleep(1000);
}
if (!ready) throw Error("Replica set primary not ready");
const appDB = admin.getSiblingDB("mam_chung");
if (!appDB.getUser("mam_app"))
  appDB.createUser({
    user: "mam_app",
    pwd: process.env.MONGO_APP_PASSWORD,
    roles: [{ role: "readWrite", db: "mam_chung" }],
  });
if (!admin.getUser("mam_backup"))
  admin.createUser({
    user: "mam_backup",
    pwd: process.env.MONGO_BACKUP_PASSWORD,
    roles: [{ role: "backup", db: "admin" }],
  });
print(
  "Replica set primary and app/backup users ready; existing users preserved.",
);

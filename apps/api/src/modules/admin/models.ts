import { Schema, model } from "mongoose";

const adminAuditLogSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, default: null },
    adminEmail: { type: String, required: true },
    ip: { type: String, default: null },
    action: {
      type: String,
      required: true,
      enum: [
        "admin_grant",
        "admin_revoke",
        "lock_user",
        "unlock_user",
        "delete_user",
        "reset_password",
        "transfer_owner",
        "archive_couple",
        "change_setting",
      ],
    },
    targetType: {
      type: String,
      enum: ["user", "couple", "setting"],
      required: true,
    },
    targetId: { type: String, default: null },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    details: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ action: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetType: 1, targetId: 1 });

export const AdminAuditLog = model(
  "AdminAuditLog",
  adminAuditLogSchema,
  "admin_audit_logs",
);
export type AdminAuditLogRecord = InstanceType<typeof AdminAuditLog>;

const appSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    registrationOpen: { type: Boolean, default: true },
    allowNewCouples: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const AppSettings = model(
  "AppSettings",
  appSettingsSchema,
  "app_settings",
);
export type AppSettingsRecord = InstanceType<typeof AppSettings>;

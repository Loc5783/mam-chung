import { Schema, model } from "mongoose";
const coupleSchema = new Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    anniversary: { type: String, default: null },
    archivedAt: { type: Date, default: null },
    archivedReason: { type: String, default: null },
    revision: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const Couple = model("Couple", coupleSchema, "couples");
const memberSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: ["owner", "member"], required: true },
    active: { type: Boolean, default: true },
    nameSnapshot: { type: String, required: true },
    avatarSnapshot: { type: String, default: null },
    leftAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
memberSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
memberSchema.index({ coupleId: 1, userId: 1 }, { unique: true });
export const CoupleMember = model(
  "CoupleMember",
  memberSchema,
  "couple_members",
);
const inviteSchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, required: true },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    codeHash: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: ["active", "used", "revoked"],
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    usedBy: { type: Schema.Types.ObjectId, default: null },
    usedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
inviteSchema.index({ coupleId: 1, status: 1 });
export const CoupleInvite = model(
  "CoupleInvite",
  inviteSchema,
  "couple_invites",
);
const activitySchema = new Schema(
  {
    coupleId: { type: Schema.Types.ObjectId, required: true, index: true },
    actorId: { type: Schema.Types.ObjectId, required: true },
    actorName: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "created",
        "invite_created",
        "invite_revoked",
        "joined",
        "updated",
        "owner_transferred",
        "archived",
      ],
      required: true,
    },
    message: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
activitySchema.index({ coupleId: 1, createdAt: -1, _id: -1 });
export const CoupleActivity = model(
  "CoupleActivity",
  activitySchema,
  "couple_activities",
);
export const coupleModels = [
  Couple,
  CoupleMember,
  CoupleInvite,
  CoupleActivity,
];
export type CoupleRecord = InstanceType<typeof Couple>;

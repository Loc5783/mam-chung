import { Schema, model, ClientSession } from "mongoose";
const schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    eventKey: { type: String, required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    href: { type: String, required: true },
    payload: { sourceId: { type: String, required: true } },
    active: { type: Boolean, default: true },
    readAt: { type: Date, default: null },
    occurredAt: { type: Date, required: true },
  },
  { timestamps: true },
);
schema.index({ userId: 1, eventKey: 1 }, { unique: true });
schema.index({ userId: 1, active: 1, readAt: 1, occurredAt: -1 });
export const Notification = model("Notification", schema, "notifications");
const receipt = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    inviteId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);
receipt.index({ userId: 1, inviteId: 1 }, { unique: true });
export const InviteReceipt = model(
  "InviteReceipt",
  receipt,
  "notification_invite_receipts",
);
export const notificationModels = [Notification, InviteReceipt];
export async function rememberInvitation(
  userId: string,
  inviteId: string,
  s: ClientSession,
) {
  await InviteReceipt.updateOne(
    { userId, inviteId },
    { $setOnInsert: { userId, inviteId } },
    { upsert: true, session: s },
  );
}

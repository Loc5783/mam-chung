import { Schema, model } from "mongoose";
const taskSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    deadline: { type: String, default: null },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"],
      default: "TODO",
    },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    coupleId: { type: Schema.Types.ObjectId, default: null, index: true },
    assignedTo: { type: Schema.Types.ObjectId, default: null },
    assignmentVersion: { type: Number, default: 0 },
    creatorName: { type: String, required: true },
    kind: { type: String, enum: ["task", "shopping"], default: "task" },
    labels: { type: [String], default: [] },
    checklist: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            text: { type: String, required: true },
            done: { type: Boolean, default: false },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    recurrence: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    anchorDay: { type: Number, default: null },
    completedAt: { type: Date, default: null },
    sourceTaskId: { type: Schema.Types.ObjectId, default: null },
    revision: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
taskSchema.index(
  { sourceTaskId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceTaskId: { $type: "objectId" } },
  },
);
taskSchema.index({ coupleId: 1, deletedAt: 1, deadline: 1 });
export const Task = model("Task", taskSchema, "tasks");
export const TaskComment = model(
  "TaskComment",
  new Schema(
    {
      taskId: { type: Schema.Types.ObjectId, required: true, index: true },
      coupleId: { type: Schema.Types.ObjectId, required: true },
      userId: { type: Schema.Types.ObjectId, required: true },
      authorName: { type: String, required: true },
      text: { type: String, required: true },
    },
    { timestamps: true },
  ),
  "task_comments",
);
export const taskModels = [Task, TaskComment];

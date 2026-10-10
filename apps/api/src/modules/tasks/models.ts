import { Schema, model } from "mongoose";
const taskSchema = new Schema(
  {
    listId: { type: Schema.Types.ObjectId, default: null },
    position: { type: String, default: null },
    startDate: { type: String, default: null },
    deadlineHasTime: { type: Boolean, default: false },
    deadlineTime: { type: String, default: null },
    deadlineTimezone: { type: String, default: null },
    lastNudgedAt: { type: Date, default: null },
    reminderAt: { type: Date, default: null },
    estimateMinutes: { type: Number, default: null },
    timeSpentSeconds: { type: Number, default: 0 },
    completedBy: { type: Schema.Types.ObjectId, default: null },
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
    recurrenceRule: {
      type: new Schema(
        {
          frequency: { type: String, enum: ["daily", "weekly", "monthly"] },
          interval: { type: Number, default: 1 },
          weekdays: { type: [Number], default: [] },
        },
        { _id: false },
      ),
      default: null,
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
taskSchema.index({ coupleId: 1, listId: 1, position: 1 });
taskSchema.index({ createdBy: 1, listId: 1, position: 1 });
taskSchema.index({ assignedTo: 1, status: 1, deadline: 1 });
taskSchema.index(
  { reminderAt: 1 },
  { partialFilterExpression: { reminderAt: { $type: "date" } } },
);
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
const listSchema = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String, default: "#7E9B57" },
    icon: { type: String, default: "ListTodo" },
    type: { type: String, enum: ["normal", "shopping"], default: "normal" },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    coupleId: { type: Schema.Types.ObjectId, default: null },
    position: { type: String, required: true },
    systemKey: { type: String, default: null },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true },
);
listSchema.pre("validate", function () {
  if (!!this.ownerId === !!this.coupleId)
    this.invalidate("ownerId", "Danh sách cần đúng một chủ sở hữu.");
});
listSchema.index({ ownerId: 1, position: 1 });
listSchema.index({ coupleId: 1, position: 1 });
listSchema.index(
  { systemKey: 1 },
  { unique: true, partialFilterExpression: { systemKey: { $type: "string" } } },
);
export const TaskList = model("TaskList", listSchema, "task_lists");
export const TaskActivity = model(
  "TaskActivity",
  new Schema(
    {
      taskId: { type: Schema.Types.ObjectId, required: true, index: true },
      actorId: { type: Schema.Types.ObjectId, required: true },
      actorName: { type: String, required: true },
      message: { type: String, required: true },
    },
    { timestamps: true },
  ),
  "task_activity",
);
const timeSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    sessionId: { type: String, required: true },
    seconds: { type: Number, required: true },
  },
  { timestamps: true },
);
timeSchema.index({ taskId: 1, userId: 1, sessionId: 1 }, { unique: true });
export const TaskTimeReceipt = model(
  "TaskTimeReceipt",
  timeSchema,
  "task_time_receipts",
);
const templateSchema = new Schema(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, default: null },
    coupleId: { type: Schema.Types.ObjectId, default: null },
    type: { type: String, enum: ["normal", "shopping"], default: "normal" },
    items: { type: [Schema.Types.Mixed], default: [] },
  },
  { timestamps: true },
);
templateSchema.pre("validate", function () {
  if (!!this.ownerId === !!this.coupleId)
    this.invalidate("ownerId", "Mẫu cần đúng một chủ sở hữu.");
});
templateSchema.index({ ownerId: 1 });
templateSchema.index({ coupleId: 1 });
export const TaskTemplate = model(
  "TaskTemplate",
  templateSchema,
  "task_templates",
);
export const taskModels = [
  Task,
  TaskComment,
  TaskList,
  TaskActivity,
  TaskTimeReceipt,
  TaskTemplate,
];

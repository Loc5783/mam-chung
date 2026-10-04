import { Schema, model } from "mongoose";
const options = { timestamps: true } as const;
const own = {
  userId: { type: Schema.Types.ObjectId, required: true, index: true },
  deletedAt: { type: Date, default: null },
};
const exercise = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, default: null },
    systemKey: { type: String, default: null },
    name: { type: String, required: true },
    muscleGroup: { type: String, required: true },
    deletedAt: { type: Date, default: null },
  },
  options,
);
exercise.index(
  { systemKey: 1 },
  { unique: true, partialFilterExpression: { systemKey: { $type: "string" } } },
);
export const Exercise = model("Exercise", exercise, "exercises");
export const WorkoutSession = model(
  "WorkoutSession",
  new Schema(
    {
      ...own,
      date: { type: String, required: true, index: true },
      durationMinutes: { type: Number, required: true },
      notes: { type: String, default: "" },
      startTime: { type: Date, default: null },
      endTime: { type: Date, default: null },
      mood: { type: Number, default: null },
      bodyWeight: { type: Number, default: null },
      revision: { type: Number, default: 0 },
    },
    options,
  ),
  "workout_sessions",
);
const set = new Schema(
  {
    ...own,
    sessionId: { type: Schema.Types.ObjectId, required: true, index: true },
    exerciseId: { type: Schema.Types.ObjectId, required: true, index: true },
    exerciseName: { type: String, required: true },
    muscleGroup: { type: String, required: true },
    setNumber: { type: Number, required: true },
    weight: { type: Number, required: true },
    reps: { type: Number, required: true },
    done: { type: Boolean, default: true },
    setType: {
      type: String,
      enum: ["warmup", "working", "dropset", "failure"],
      default: "working",
    },
    rpe: { type: Number, default: null },
    revision: { type: Number, default: 0 },
  },
  options,
);
set.index(
  { sessionId: 1, exerciseId: 1, setNumber: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
export const WorkoutSet = model("WorkoutSet", set, "workout_sets");
export const WorkoutTemplate = model(
  "WorkoutTemplate",
  new Schema(
    {
      ...own,
      name: { type: String, required: true },
      notes: { type: String, default: "" },
      items: {
        type: [
          new Schema(
            {
              exerciseId: { type: Schema.Types.ObjectId, required: true },
              weight: { type: Number, required: true },
              reps: { type: Number, required: true },
              setType: { type: String, required: true },
              rpe: { type: Number, default: null },
            },
            { _id: false },
          ),
        ],
        default: [],
      },
      revision: { type: Number, default: 0 },
    },
    options,
  ),
  "workout_templates",
);
export const BodyMetric = model(
  "BodyMetric",
  new Schema(
    {
      ...own,
      date: { type: String, required: true },
      weight: { type: Number, default: null },
      waist: { type: Number, default: null },
      chest: { type: Number, default: null },
      hips: { type: Number, default: null },
      arm: { type: Number, default: null },
      thigh: { type: Number, default: null },
      notes: { type: String, default: "" },
      revision: { type: Number, default: 0 },
    },
    options,
  ),
  "body_metrics",
);
BodyMetric.schema.index(
  { userId: 1, date: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
export const FitnessGoal = model(
  "FitnessGoal",
  new Schema(
    {
      userId: { type: Schema.Types.ObjectId, required: true, unique: true },
      sessionsPerWeek: { type: Number, default: 4 },
    },
    options,
  ),
  "fitness_goals",
);
export const fitnessModels = [
  Exercise,
  WorkoutSession,
  WorkoutSet,
  WorkoutTemplate,
  BodyMetric,
  FitnessGoal,
];

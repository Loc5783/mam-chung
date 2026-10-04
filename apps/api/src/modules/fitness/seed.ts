import { Exercise } from "./models";
const defaults = [
  ["bench", "Bench Press", "Ngực"],
  ["incline", "Incline Press", "Ngực"],
  ["squat", "Squat", "Chân"],
  ["deadlift", "Deadlift", "Lưng"],
  ["pullup", "Pull Up", "Lưng"],
  ["shoulder", "Shoulder Press", "Vai"],
  ["row", "Barbell Row", "Lưng"],
  ["legpress", "Leg Press", "Chân"],
  ["curl", "Bicep Curl", "Tay"],
  ["triceps", "Triceps Pushdown", "Tay"],
  ["plank", "Plank", "Bụng"],
];
export async function seedExercises() {
  for (const [systemKey, name, muscleGroup] of defaults)
    await Exercise.updateOne(
      { systemKey },
      {
        $setOnInsert: {
          systemKey,
          name,
          muscleGroup,
          userId: null,
          deletedAt: null,
        },
      },
      { upsert: true },
    );
}

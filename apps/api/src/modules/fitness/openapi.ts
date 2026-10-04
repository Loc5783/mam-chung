const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" },
  day = { type: "string", format: "date" },
  revision = {
    type: "integer",
    minimum: 0,
    description: "Revision đang thấy; bản cũ trả 409.",
  },
  notes = { type: "string", maxLength: 2000, default: "" };
const obj = (
  properties: Record<string, unknown>,
  required: string[] = [],
  strict = false,
) => ({
  type: "object",
  properties,
  required,
  ...(strict ? { additionalProperties: false } : {}),
});
const array = (name: string) => ({ type: "array", items: ref(name) });
const kg = { type: "number", minimum: 0, maximum: 1000 },
  reps = { type: "integer", minimum: 1, maximum: 1000 },
  setType = {
    type: "string",
    enum: ["warmup", "working", "dropset", "failure"],
    default: "working",
  },
  rpe = {
    type: "number",
    minimum: 1,
    maximum: 10,
    multipleOf: 0.5,
    nullable: true,
    default: null,
  };
const exercise = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  muscleGroup: {
    type: "string",
    enum: ["Ngực", "Lưng", "Chân", "Vai", "Tay", "Bụng", "Toàn thân"],
  },
};
const session = {
  date: day,
  durationMinutes: {
    type: "number",
    exclusiveMinimum: true,
    minimum: 0,
    maximum: 1440,
    description: "Nếu có start/end, server tính từ chênh lệch hai giờ.",
  },
  notes,
  startTime: { type: "string", format: "date-time", nullable: true },
  endTime: { type: "string", format: "date-time", nullable: true },
  mood: { type: "integer", minimum: 1, maximum: 5, nullable: true },
  bodyWeight: {
    type: "number",
    exclusiveMinimum: true,
    minimum: 0,
    maximum: 500,
    nullable: true,
  },
};
const set = {
  exerciseId: id,
  weight: kg,
  reps,
  done: { type: "boolean", default: true },
  setType,
  rpe,
};
const item = { exerciseId: id, weight: kg, reps, setType, rpe };
const template = {
  name: { type: "string", minLength: 1, maxLength: 100 },
  notes,
  items: { ...array("FitnessTemplateItem"), minItems: 1, maxItems: 100 },
};
const measurement = (max: number) => ({
  type: "number",
  exclusiveMinimum: true,
  minimum: 0,
  maximum: max,
  nullable: true,
});
const body = {
  date: day,
  weight: measurement(500),
  waist: measurement(300),
  chest: measurement(300),
  hips: measurement(300),
  arm: measurement(300),
  thigh: measurement(300),
  notes,
};
const n = { type: "number" },
  summary = obj({ sessions: n, volume: n, averageReps: n });
export const fitnessSchemas = {
  FitnessExerciseInput: obj(exercise, ["name", "muscleGroup"], true),
  FitnessExerciseUpdate: obj(exercise, [], true),
  FitnessExercise: obj({ ...exercise, id, isSystem: { type: "boolean" } }),
  FitnessSessionInput: obj(session, ["date", "durationMinutes"], true),
  FitnessSessionUpdate: obj({ ...session, revision }, ["revision"], true),
  FitnessDelete: obj({ revision }, ["revision"], true),
  FitnessSession: obj({
    ...session,
    id,
    revision,
    sets: array("FitnessSet"),
    volume: n,
  }),
  FitnessSetInput: obj(
    {
      ...set,
      sessionId: id,
      setNumber: {
        type: "integer",
        minimum: 1,
        maximum: 10000,
        description: "Bỏ để server cấp số tiếp theo theo bài/buổi.",
      },
    },
    ["sessionId", "exerciseId", "weight", "reps"],
    true,
  ),
  FitnessSetUpdate: obj(
    {
      ...set,
      setNumber: { type: "integer", minimum: 1, maximum: 10000 },
      revision,
    },
    ["revision"],
    true,
  ),
  FitnessSet: obj({
    ...set,
    id,
    sessionId: id,
    setNumber: { type: "integer" },
    exerciseName: { type: "string" },
    muscleGroup: { type: "string" },
    volume: n,
    revision,
  }),
  FitnessTemplateItem: obj(item, ["exerciseId", "weight", "reps"], true),
  FitnessTemplateInput: obj(template, ["name", "items"], true),
  FitnessTemplateUpdate: obj(
    { ...template, revision },
    ["name", "items", "revision"],
    true,
  ),
  FitnessTemplate: obj({ ...template, id, revision }),
  FitnessBodyInput: {
    ...obj(body, ["date"], true),
    description:
      "Ít nhất một số đo khác null; mỗi người một bản chưa xóa/ngày.",
  },
  FitnessBodyUpdate: obj({ ...body, revision }, ["date", "revision"], true),
  FitnessBody: obj({ ...body, id, revision }),
  FitnessGoal: obj(
    {
      sessionsPerWeek: { type: "integer", minimum: 1, maximum: 14, default: 4 },
    },
    ["sessionsPerWeek"],
    true,
  ),
  FitnessVolume: obj({ sessionId: id, date: day, volume: n }),
  FitnessRep: obj({
    name: { type: "string" },
    range: { type: "string" },
    count: { type: "integer" },
    percent: n,
  }),
  FitnessProgress: obj({
    sessionId: id,
    date: day,
    maxWeight: { ...n, nullable: true },
    oneRM: { ...n, nullable: true },
  }),
  FitnessPR: obj({
    sessionId: id,
    date: day,
    exerciseId: id,
    exerciseName: { type: "string" },
    weight: n,
    volume: n,
    oneRM: n,
    baseline: { type: "boolean" },
    flags: obj({
      weight: { type: "boolean" },
      volume: { type: "boolean" },
      oneRM: { type: "boolean" },
    }),
  }),
  FitnessReport: obj({
    from: day,
    to: day,
    exerciseId: { ...id, nullable: true },
    stats: obj({
      weekSessions: n,
      monthSessions: n,
      rangeSessions: n,
      averageReps: n,
      totalMinutes: n,
      averageMinutes: n,
      lastVolume: n,
      frequencyPerWeek: n,
    }),
    volume: array("FitnessVolume"),
    repDistribution: array("FitnessRep"),
    progress: array("FitnessProgress"),
    prs: array("FitnessPR"),
    bests: {
      type: "array",
      items: obj({ exerciseId: id, weight: n, volume: n, oneRM: n }),
    },
    comparison: obj({ current: summary, previous: summary, delta: summary }),
    weeklyGoal: obj({ target: n, done: n, progress: n }),
    body: array("FitnessBody"),
    latest: { ...ref("FitnessSession"), nullable: true },
    continueFrom: { ...ref("FitnessSession"), nullable: true },
  }),
  FitnessLast: obj({
    date: { ...day, nullable: true },
    sessionId: { ...id, nullable: true },
    sets: array("FitnessSet"),
  }),
};
const query = (name: string, schema: unknown) => ({
  name,
  in: "query",
  schema,
});
const idParam = { name: "id", in: "path", required: true, schema: id };
const exerciseParam = {
  name: "exerciseId",
  in: "path",
  required: true,
  schema: id,
};
const page = [
  query("page", { type: "integer", minimum: 1, default: 1 }),
  query("limit", { type: "integer", minimum: 1, maximum: 100, default: 20 }),
  query("from", day),
  query("to", day),
];
const analysis = [
  query("range", {
    type: "string",
    enum: ["7d", "30d", "90d"],
    default: "30d",
  }),
  query("from", day),
  query("to", day),
  query("exerciseId", id),
];
const content = (schema: unknown) => ({ "application/json": { schema } });
function op(
  summary: string,
  result: unknown,
  parameters: unknown[] = [],
  input?: string,
  code = 200,
) {
  return {
    tags: ["Fitness riêng tư"],
    summary,
    security: [{ bearerAuth: [] }],
    parameters,
    ...(input
      ? { requestBody: { required: true, content: content(ref(input)) } }
      : {}),
    responses: {
      [code]: {
        description: code === 204 ? "Đã xóa" : "Thành công",
        ...(code === 204 ? {} : { content: content(result) }),
      },
      400: { description: "Dữ liệu không hợp lệ" },
      401: { description: "Chưa đăng nhập" },
      404: { description: "Không tồn tại hoặc không thuộc bạn" },
      409: {
        description:
          "Revision cũ, số set trùng, số đo trùng ngày hoặc bài đã dùng",
      },
    },
  };
}
const list = (name: string) => obj({ items: array(name) }),
  paged = (name: string) =>
    obj({ items: array(name), page: n, limit: n, total: n });
export const fitnessPaths = {
  "/exercises": {
    get: op("Bài hệ thống và bài riêng", list("FitnessExercise"), [
      query("search", { type: "string", maxLength: 100 }),
      query("muscleGroup", exercise.muscleGroup),
    ]),
    post: op(
      "Tạo bài riêng",
      ref("FitnessExercise"),
      [],
      "FitnessExerciseInput",
      201,
    ),
  },
  "/exercises/{id}": {
    put: op(
      "Sửa bài riêng, không sửa bài hệ thống",
      ref("FitnessExercise"),
      [idParam],
      "FitnessExerciseUpdate",
    ),
    delete: op(
      "Xóa bài riêng chưa có lịch sử hoặc mẫu",
      {},
      [idParam],
      undefined,
      204,
    ),
  },
  "/workout-sessions": {
    get: op(
      "Lịch sử riêng, ngày bao gồm hai đầu",
      paged("FitnessSession"),
      page,
    ),
    post: op(
      "Ghi buổi tập riêng",
      ref("FitnessSession"),
      [],
      "FitnessSessionInput",
      201,
    ),
  },
  "/workout-sessions/{id}": {
    get: op("Buổi tập và set thuộc bạn", ref("FitnessSession"), [idParam]),
    put: op(
      "Sửa buổi tập",
      ref("FitnessSession"),
      [idParam],
      "FitnessSessionUpdate",
    ),
    delete: op(
      "Xóa buổi và tất cả set trong cùng transaction",
      {},
      [idParam],
      "FitnessDelete",
      204,
    ),
  },
  "/workout-sets": {
    post: op(
      "Ghi set, số thứ tự tự tăng theo bài/buổi",
      ref("FitnessSet"),
      [],
      "FitnessSetInput",
      201,
    ),
  },
  "/workout-sets/{id}": {
    put: op(
      "Sửa kg/rep, loại, RPE hoặc hoàn thành",
      ref("FitnessSet"),
      [idParam],
      "FitnessSetUpdate",
    ),
    delete: op(
      "Xóa set và tính lại báo cáo",
      {},
      [idParam],
      "FitnessDelete",
      204,
    ),
  },
  "/workout-templates": {
    get: op("Mẫu tập riêng", list("FitnessTemplate")),
    post: op(
      "Lưu mẫu có ít nhất một set",
      ref("FitnessTemplate"),
      [],
      "FitnessTemplateInput",
      201,
    ),
  },
  "/workout-templates/{id}": {
    put: op(
      "Thay thế mẫu với revision",
      ref("FitnessTemplate"),
      [idParam],
      "FitnessTemplateUpdate",
    ),
    delete: op(
      "Xóa mẫu, giữ các buổi đã ghi",
      {},
      [idParam],
      "FitnessDelete",
      204,
    ),
  },
  "/workout-templates/{id}/start": {
    post: op(
      "Tạo buổi mới và sao chép set chưa hoàn thành, atomic",
      ref("FitnessSession"),
      [idParam],
      "FitnessSessionInput",
      201,
    ),
  },
  "/body-metrics": {
    get: op("Số đo riêng, phân trang", paged("FitnessBody"), page),
    post: op(
      "Ghi số đo ngày, không ghi đè ngày trùng",
      ref("FitnessBody"),
      [],
      "FitnessBodyInput",
      201,
    ),
  },
  "/body-metrics/{id}": {
    put: op(
      "Thay thế số đo ngày với revision",
      ref("FitnessBody"),
      [idParam],
      "FitnessBodyUpdate",
    ),
    delete: op("Xóa số đo", {}, [idParam], "FitnessDelete", 204),
  },
  "/fitness/goal": {
    get: op("Mục tiêu buổi/tuần riêng, mặc định 4", ref("FitnessGoal")),
    put: op("Đặt mục tiêu buổi/tuần", ref("FitnessGoal"), [], "FitnessGoal"),
  },
  "/fitness/last/{exerciseId}": {
    get: op(
      "Các set hoàn thành của bài trong buổi gần nhất đến hôm nay",
      ref("FitnessLast"),
      [exerciseParam],
    ),
  },
  "/fitness/stats": {
    get: op(
      "Báo cáo đầy đủ; ngày lịch theo timezone hồ sơ; PR tính lịch sử trước khoảng",
      ref("FitnessReport"),
      analysis,
    ),
  },
  "/fitness/volume": {
    get: op(
      "Volume theo buổi chỉ gồm set hoàn thành, kể cả khởi động",
      obj({ items: array("FitnessVolume"), from: day, to: day }),
      analysis,
    ),
  },
  "/fitness/rep-distribution": {
    get: op(
      "Số set và phần trăm nhóm 1–5 / 6–12 / 13+",
      obj({ items: array("FitnessRep"), from: day, to: day }),
      analysis,
    ),
  },
  "/fitness/progress/{exerciseId}": {
    get: op(
      "Kg cao nhất và Epley 1RM cho một bài, bỏ khởi động",
      obj({ items: array("FitnessProgress"), from: day, to: day }),
      [exerciseParam, ...analysis.filter((p) => p.name !== "exerciseId")],
    ),
  },
  "/fitness/prs": {
    get: op(
      "Mốc đầu hoặc PR kg/volume bài-buổi/1RM, bỏ khởi động",
      obj({ items: array("FitnessPR"), from: day, to: day }),
      analysis,
    ),
  },
};

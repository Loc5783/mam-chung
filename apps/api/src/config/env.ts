import "dotenv/config";
import { z } from "zod";
const schema = z.object({
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1),
  CORS_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
  JWT_SECRET: z.string().min(32),
});
export const env = schema.parse(process.env);
if (env.NODE_ENV === "production" && env.JWT_SECRET.includes("replace-with-"))
  throw new Error(
    "Production cần JWT_SECRET ngẫu nhiên riêng, không dùng giá trị minh họa.",
  );

import "dotenv/config";
import { parseEnvironment } from "./environment";
export const env = parseEnvironment(process.env);

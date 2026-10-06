import { ClientSession } from "mongoose";
import { AppError } from "../../utils/AppError";
import { userRepository } from "../users/repository";
import { Couple } from "../couples/models";
import { coupleRepository } from "../couples/repository";
export const missing = () =>
  new AppError(
    404,
    "NOT_FOUND",
    "Không tìm thấy công việc hoặc bạn không có quyền truy cập.",
  );
export async function user(id: string, s: ClientSession, write = false) {
  const u = await userRepository.byId(id, s);
  if (!u) throw missing();
  if (write && !(await userRepository.touch(id, u.securityVersion, s)))
    throw missing();
  return u;
}
export async function shared(
  userId: string,
  id: string,
  s: ClientSession,
  write = false,
) {
  const m = await coupleRepository.member(userId, id, s);
  if (!m) throw missing();
  const c = write
    ? await coupleRepository.lock(id, s)
    : await Couple.findOne({ _id: id, deletedAt: null }).session(s);
  if (!c || (c.status === "active" && !m.active) || (write && !m.active))
    throw missing();
  return c;
}

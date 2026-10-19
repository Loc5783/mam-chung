import { User } from "../users/model";
import { Couple, CoupleMember, CoupleInvite } from "../couples/models";
import { tokenRepository } from "../auth/repository";
import { AdminAuditLog, AppSettings } from "./models";
import { AppError } from "../../utils/AppError";
import { emailSchema } from "../auth/schema";
import { inTransaction } from "../../utils/transaction";
import { authService } from "../auth/service";
import {
  adminUsersQuerySchema,
  adminCouplesQuerySchema,
  adminAuditQuerySchema,
  adminSettingsPatchSchema,
} from "./schema";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function recordAuditLog(entry: {
  adminId?: string | null;
  adminEmail: string;
  ip?: string | null;
  action:
    | "admin_grant"
    | "admin_revoke"
    | "lock_user"
    | "unlock_user"
    | "delete_user"
    | "reset_password"
    | "transfer_owner"
    | "archive_couple"
    | "change_setting";
  targetType: "user" | "couple" | "setting";
  targetId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
}) {
  return await AdminAuditLog.create({
    adminId: entry.adminId ?? null,
    adminEmail: entry.adminEmail,
    ip: entry.ip ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    details: entry.details ?? null,
  });
}

export const adminService = {
  recordAuditLog,

  async getOverview() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers7d,
      disabledUsers,
      newUsers7d,
      activeCouples,
      archivedCouples,
      settings,
    ] = await Promise.all([
      User.countDocuments({ deletedAt: null }),
      User.countDocuments({
        deletedAt: null,
        lastLoginAt: { $gte: sevenDaysAgo },
      }),
      User.countDocuments({ deletedAt: null, disabledAt: { $ne: null } }),
      User.countDocuments({
        deletedAt: null,
        createdAt: { $gte: sevenDaysAgo },
      }),
      Couple.countDocuments({ deletedAt: null, status: "active" }),
      Couple.countDocuments({ deletedAt: null, status: "archived" }),
      AppSettings.findOne({ key: "global" }),
    ]);

    return {
      totalUsers,
      activeUsers7d,
      disabledUsers,
      newUsers7d,
      activeCouples,
      archivedCouples,
      registrationOpen: settings?.registrationOpen ?? true,
    };
  },

  async getUsers(rawParams: unknown) {
    const params = adminUsersQuerySchema.parse(rawParams);
    const filter: Record<string, unknown> = {};

    if (params.status === "active") {
      filter.deletedAt = null;
      filter.disabledAt = null;
    } else if (params.status === "disabled") {
      filter.deletedAt = null;
      filter.disabledAt = { $ne: null };
    } else if (params.status === "deleted") {
      filter.deletedAt = { $ne: null };
    }

    if (params.query) {
      const escaped = escapeRegex(params.query);
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(filter);
    const skip = (params.page - 1) * params.limit;
    const users = await User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(params.limit);

    const coupleIds = users
      .map((u) => u.coupleId)
      .filter((id): id is NonNullable<typeof id> => id != null);

    const couples =
      coupleIds.length > 0
        ? await Couple.find({ _id: { $in: coupleIds } }).select("name status")
        : [];
    const coupleMap = new Map(couples.map((c) => [c.id as string, c]));

    const items = users.map((user) => {
      const userCouple = user.coupleId
        ? coupleMap.get(user.coupleId.toString())
        : null;
      const status = user.deletedAt
        ? "deleted"
        : user.disabledAt
          ? "disabled"
          : "active";
      const lockedUntil =
        user.lockUntil && user.lockUntil > new Date()
          ? user.lockUntil.toISOString()
          : null;

      return {
        id: user.id as string,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        status,
        lockedUntil,
        coupleName: userCouple?.name ?? null,
        coupleStatus: userCouple?.status ?? null,
        role: (user.role ?? "user") as "user" | "admin",
      };
    });

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit) || 1,
    };
  },

  async getCouples(rawParams: unknown) {
    const params = adminCouplesQuerySchema.parse(rawParams);
    const filter: Record<string, unknown> = { deletedAt: null };

    if (params.status && params.status !== "all") {
      filter.status = params.status;
    }

    const total = await Couple.countDocuments(filter);
    const skip = (params.page - 1) * params.limit;
    const couples = await Couple.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(params.limit);

    const coupleIds = couples.map((c) => c._id);
    const [allMembers, allActiveInvites] = await Promise.all([
      coupleIds.length > 0
        ? CoupleMember.find({
            coupleId: { $in: coupleIds },
            deletedAt: null,
          }).select("coupleId userId nameSnapshot role active")
        : [],
      coupleIds.length > 0
        ? CoupleInvite.find({
            coupleId: { $in: coupleIds },
            status: "active",
            expiresAt: { $gt: new Date() },
          }).select("coupleId")
        : [],
    ]);

    const items = couples.map((c) => {
      const members = allMembers
        .filter((m) => m.coupleId.toString() === c.id)
        .sort((a, b) => {
          if (a.role === "owner" && b.role !== "owner") return -1;
          if (b.role === "owner" && a.role !== "owner") return 1;
          return a.nameSnapshot.localeCompare(b.nameSnapshot);
        });
      const activeInvites = allActiveInvites.filter(
        (i) => i.coupleId.toString() === c.id,
      );

      return {
        id: c.id as string,
        name: c.name,
        status: c.status as "active" | "archived",
        createdAt: c.createdAt.toISOString(),
        memberCount: members.filter((m) => m.active).length,
        members: members.map((m) => ({
          userId: m.userId.toString(),
          name: m.nameSnapshot,
          role: m.role as "owner" | "member",
          active: m.active,
        })),
        activeInviteCount: activeInvites.length,
      };
    });

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit) || 1,
    };
  },

  async getAuditLogs(rawParams: unknown) {
    const params = adminAuditQuerySchema.parse(rawParams);
    const filter: Record<string, unknown> = {};

    if (params.action) {
      filter.action = params.action;
    }

    const total = await AdminAuditLog.countDocuments(filter);
    const skip = (params.page - 1) * params.limit;
    const logs = await AdminAuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(params.limit);

    const items = logs.map((log) => ({
      id: log.id as string,
      adminId: log.adminId?.toString() ?? null,
      adminEmail: log.adminEmail,
      ip: log.ip,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      before: log.before,
      after: log.after,
      details: log.details,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit) || 1,
    };
  },

  async grantAdminRole(rawEmail: string, actorEmail = "system:cli") {
    const email = emailSchema.parse(rawEmail);
    const user = await User.findOne({ email, deletedAt: null });
    if (!user) {
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        `Không tìm thấy người dùng với email: ${email}`,
      );
    }
    if (user.role === "admin") {
      return { user, changed: false };
    }
    user.role = "admin";
    await user.save();

    await recordAuditLog({
      adminId: null,
      adminEmail: actorEmail,
      action: "admin_grant",
      targetType: "user",
      targetId: user.id as string,
      after: { role: "admin" },
      details: { email: user.email, name: user.name },
    });

    return { user, changed: true };
  },

  async revokeAdminRole(rawEmail: string, actorEmail = "system:cli") {
    const email = emailSchema.parse(rawEmail);
    const user = await User.findOne({ email, deletedAt: null });
    if (!user) {
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        `Không tìm thấy người dùng với email: ${email}`,
      );
    }
    if (user.role !== "admin") {
      throw new AppError(
        400,
        "NOT_AN_ADMIN",
        `Người dùng ${email} không phải là quản trị viên.`,
      );
    }

    const adminCount = await User.countDocuments({
      role: "admin",
      deletedAt: null,
    });
    if (adminCount <= 1) {
      throw new AppError(
        400,
        "LAST_ADMIN_CANNOT_BE_REVOKED",
        "Không thể gỡ quyền: Đây là quản trị viên cuối cùng của hệ thống.",
      );
    }

    user.role = "user";
    user.securityVersion += 1;
    user.sessionRevision += 1;
    await user.save();
    await tokenRepository.revoke(user.id as string);

    await recordAuditLog({
      adminId: null,
      adminEmail: actorEmail,
      action: "admin_revoke",
      targetType: "user",
      targetId: user.id as string,
      before: { role: "admin" },
      after: { role: "user" },
      details: { email: user.email, name: user.name },
    });

    return { user, changed: true };
  },

  async listAdmins() {
    return await User.find({ role: "admin", deletedAt: null }).sort({
      createdAt: 1,
    });
  },

  async lockUser(
    targetUserId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    if (targetUserId === adminId) {
      throw new AppError(
        400,
        "CANNOT_LOCK_SELF",
        "Quản trị viên không thể tự khóa chính mình.",
      );
    }
    const target = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng.");
    }
    const before = {
      disabledAt: target.disabledAt ? target.disabledAt.toISOString() : null,
    };
    target.disabledAt = new Date();
    target.securityVersion += 1;
    target.sessionRevision += 1;
    await target.save();
    await tokenRepository.revoke(target.id as string);

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "lock_user",
      targetType: "user",
      targetId: target.id as string,
      before,
      after: { disabledAt: target.disabledAt.toISOString() },
      details: { email: target.email, name: target.name },
    });

    return { success: true, message: "Đã tạm khóa tài khoản." };
  },

  async unlockUser(
    targetUserId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    const target = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng.");
    }
    const before = {
      disabledAt: target.disabledAt ? target.disabledAt.toISOString() : null,
      loginAttempts: target.loginAttempts,
      lockUntil: target.lockUntil ? target.lockUntil.toISOString() : null,
    };
    target.disabledAt = null;
    target.loginAttempts = 0;
    target.lockUntil = null;
    await target.save();

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "unlock_user",
      targetType: "user",
      targetId: target.id as string,
      before,
      after: { disabledAt: null, loginAttempts: 0, lockUntil: null },
      details: { email: target.email, name: target.name },
    });

    return { success: true, message: "Đã mở khóa tài khoản." };
  },

  async unlockLogin(
    targetUserId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    const target = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng.");
    }
    const before = {
      loginAttempts: target.loginAttempts,
      lockUntil: target.lockUntil ? target.lockUntil.toISOString() : null,
    };
    target.loginAttempts = 0;
    target.lockUntil = null;
    await target.save();

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "unlock_user",
      targetType: "user",
      targetId: target.id as string,
      before,
      after: { loginAttempts: 0, lockUntil: null },
      details: {
        email: target.email,
        name: target.name,
        note: "reset_login_attempts_only",
      },
    });

    return {
      success: true,
      message: "Đã xóa trạng thái tạm khóa do sai mật khẩu.",
    };
  },

  async deleteUser(
    targetUserId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    if (targetUserId === adminId) {
      throw new AppError(
        400,
        "CANNOT_DELETE_SELF",
        "Quản trị viên không thể tự xóa tài khoản của mình.",
      );
    }
    const target = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng.");
    }
    if (target.role === "admin") {
      const adminCount = await User.countDocuments({
        role: "admin",
        deletedAt: null,
      });
      if (adminCount <= 1) {
        throw new AppError(
          400,
          "LAST_ADMIN_CANNOT_BE_DELETED",
          "Không thể xóa quản trị viên cuối cùng của hệ thống.",
        );
      }
    }

    const oldEmail = target.email;
    const oldName = target.name;
    const deletedEmail = `deleted_${Date.now()}_${oldEmail}`;

    await inTransaction(async (session) => {
      let coupleId = target.coupleId;
      if (!coupleId) {
        const activeMembership = await CoupleMember.findOne({
          userId: target._id,
          active: true,
          deletedAt: null,
        }).session(session);
        if (activeMembership) {
          coupleId = activeMembership.coupleId;
        }
      }

      if (coupleId) {
        const couple = await Couple.findOne({
          _id: coupleId,
          deletedAt: null,
        }).session(session);

        if (couple) {
          const members = await CoupleMember.find({
            coupleId: couple._id,
            deletedAt: null,
            active: true,
          }).session(session);

          const currentMember = members.find(
            (m) => m.userId.toString() === targetUserId,
          );
          if (currentMember) {
            currentMember.active = false;
            currentMember.leftAt = new Date();
            currentMember.nameSnapshot = "Tài khoản đã xóa";
            await currentMember.save({ session });
          }

          const remainingMembers = members.filter(
            (m) => m.userId.toString() !== targetUserId,
          );

          if (remainingMembers.length === 0) {
            couple.status = "archived";
            couple.archivedAt = new Date();
            couple.archivedReason = "admin_action";
            await couple.save({ session });
            await CoupleInvite.updateMany(
              { coupleId: couple._id, status: "active" },
              { $set: { status: "revoked" } },
              { session },
            );
          } else {
            if (couple.ownerId.toString() === targetUserId) {
              const nextOwner = remainingMembers[0];
              couple.ownerId = nextOwner.userId;
              await couple.save({ session });
              nextOwner.role = "owner";
              await nextOwner.save({ session });
            }
          }
        }
        target.coupleId = null;
      }

      target.email = deletedEmail;
      target.name = "Tài khoản đã xóa";
      target.passwordHash = "deleted";
      target.deletedAt = new Date();
      target.securityVersion += 1;
      target.sessionRevision += 1;
      await target.save({ session });
      await tokenRepository.revoke(target.id as string, session);
    });

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "delete_user",
      targetType: "user",
      targetId: target.id as string,
      before: { email: oldEmail, name: oldName },
      after: { deletedAt: target.deletedAt?.toISOString() },
      details: { originalEmail: oldEmail },
    });

    return { success: true, message: "Đã xóa tài khoản người dùng." };
  },

  async resetPassword(
    targetUserId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    const target = await User.findOne({ _id: targetUserId, deletedAt: null });
    if (!target) {
      throw new AppError(404, "USER_NOT_FOUND", "Không tìm thấy người dùng.");
    }
    const result = await authService.adminResetPassword(target.email);

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "reset_password",
      targetType: "user",
      targetId: target.id as string,
      details: { email: target.email, name: target.name },
    });

    return {
      success: true,
      temporaryPassword: result.temporaryPassword,
      message:
        "Đã đặt lại mật khẩu thành công. Hãy gửi mật khẩu tạm này cho người dùng.",
    };
  },

  async archiveCouple(
    coupleId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    const couple = await Couple.findOne({ _id: coupleId, deletedAt: null });
    if (!couple) {
      throw new AppError(
        404,
        "COUPLE_NOT_FOUND",
        "Không tìm thấy không gian chung.",
      );
    }
    if (couple.status === "archived") {
      throw new AppError(
        400,
        "COUPLE_ALREADY_ARCHIVED",
        "Không gian chung đã được lưu trữ trước đó.",
      );
    }

    await inTransaction(async (session) => {
      couple.status = "archived";
      couple.archivedAt = new Date();
      couple.archivedReason = "admin_action";
      await couple.save({ session });

      await CoupleInvite.updateMany(
        { coupleId: couple._id, status: "active" },
        { $set: { status: "revoked" } },
        { session },
      );
    });

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "archive_couple",
      targetType: "couple",
      targetId: couple.id as string,
      before: { status: "active" },
      after: { status: "archived", archivedReason: "admin_action" },
      details: { name: couple.name },
    });

    return {
      success: true,
      message: "Đã lưu trữ không gian chung thành công.",
    };
  },

  async transferCoupleOwner(
    coupleId: string,
    newOwnerId: string,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    let coupleName = "";
    let oldOwnerId = "";

    await inTransaction(async (session) => {
      const couple = await Couple.findOne({
        _id: coupleId,
        deletedAt: null,
      }).session(session);
      if (!couple) {
        throw new AppError(
          404,
          "COUPLE_NOT_FOUND",
          "Không tìm thấy không gian chung.",
        );
      }
      coupleName = couple.name;
      oldOwnerId = couple.ownerId.toString();

      if (couple.ownerId.toString() === newOwnerId) {
        throw new AppError(
          400,
          "ALREADY_OWNER",
          "Thành viên này hiện đã là chủ không gian chung.",
        );
      }

      const newOwnerMember = await CoupleMember.findOne({
        coupleId: couple._id,
        userId: newOwnerId,
        active: true,
        deletedAt: null,
      }).session(session);

      if (!newOwnerMember) {
        throw new AppError(
          400,
          "INVALID_MEMBER",
          "Thành viên được chọn không thuộc không gian chung này hoặc không còn hoạt động.",
        );
      }

      const oldOwnerMember = await CoupleMember.findOne({
        coupleId: couple._id,
        userId: couple.ownerId,
        active: true,
        deletedAt: null,
      }).session(session);

      if (oldOwnerMember) {
        oldOwnerMember.role = "member";
        await oldOwnerMember.save({ session });
      }

      newOwnerMember.role = "owner";
      await newOwnerMember.save({ session });

      couple.ownerId = newOwnerMember.userId;
      await couple.save({ session });
    });

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "transfer_owner",
      targetType: "couple",
      targetId: coupleId,
      before: { ownerId: oldOwnerId },
      after: { ownerId: newOwnerId },
      details: { coupleName },
    });

    return {
      success: true,
      message: "Đã chuyển quyền chủ không gian chung thành công.",
    };
  },

  async getSettings() {
    const settings = await AppSettings.findOne({ key: "global" });
    return {
      registrationOpen: settings?.registrationOpen ?? true,
      allowNewCouples: settings?.allowNewCouples ?? true,
    };
  },

  async updateSettings(
    rawInput: unknown,
    adminId: string,
    adminEmail: string,
    ip?: string | null,
  ) {
    const input = adminSettingsPatchSchema.parse(rawInput);
    let settings = await AppSettings.findOne({ key: "global" });
    if (!settings) {
      settings = new AppSettings({ key: "global" });
    }

    const before = {
      registrationOpen: settings.registrationOpen,
      allowNewCouples: settings.allowNewCouples,
    };

    if (typeof input.registrationOpen === "boolean") {
      settings.registrationOpen = input.registrationOpen;
    }
    if (typeof input.allowNewCouples === "boolean") {
      settings.allowNewCouples = input.allowNewCouples;
    }

    await settings.save();

    const after = {
      registrationOpen: settings.registrationOpen,
      allowNewCouples: settings.allowNewCouples,
    };

    await recordAuditLog({
      adminId,
      adminEmail,
      ip,
      action: "change_setting",
      targetType: "setting",
      targetId: "global",
      before,
      after,
    });

    return {
      registrationOpen: settings.registrationOpen,
      allowNewCouples: settings.allowNewCouples,
    };
  },
};

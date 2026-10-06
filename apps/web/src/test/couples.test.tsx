import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../lib/apiClient";
import { useAuthStore } from "../features/auth/store";
import {
  CouplePage,
  InvitePage,
  CouplePreview,
} from "../features/couples/CouplePage";
import { CoupleData } from "../features/couples/types";
const futureInviteExpiry = () =>
  new Date(Date.now() + 48 * 3600000).toISOString();
const profile = {
  id: "qa",
  name: "Minh",
  email: "minh@example.test",
  avatar: null,
  timezone: "Asia/Ho_Chi_Minh",
  coupleId: null as string | null,
  createdAt: "2026-10-03T00:00:00Z",
};
const solo: CoupleData = {
  id: "couple",
  name: "Hành trình chúng mình",
  status: "active",
  role: "owner",
  ownerId: "qa",
  anniversary: "2020-10-03",
  anniversaryInfo: {
    date: "2020-10-03",
    daysTogether: 2191,
    nextDate: "2026-10-03",
    daysUntil: 0,
    isToday: true,
  },
  createdAt: "2026-10-03T00:00:00Z",
  archivedAt: null,
  archivedReason: null,
  members: [
    {
      userId: "qa",
      name: "Minh",
      avatar: null,
      role: "owner",
      active: true,
      joinedAt: "2026-10-03T00:00:00Z",
      leftAt: null,
    },
  ],
  invite: null,
  outstanding: { count: 0, summaryAvailable: false },
};
let active: CoupleData | null, archived: CoupleData[];
function wrap(node: React.ReactNode, route = "/couple") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter
        initialEntries={[route]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/couple" element={node} />
          <Route path="/invite/:code" element={<InvitePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.restoreAllMocks();
  active = null;
  archived = [];
  useAuthStore.getState().setSession("token", profile);
  vi.spyOn(apiClient, "get").mockImplementation(async (url) => ({
    data:
      url === "/couples/me"
        ? { couple: active }
        : url === "/couples/archives"
          ? { items: archived, total: archived.length }
          : url === "/couples/activity"
            ? {
                items: [
                  {
                    id: "event",
                    actorName: "Minh",
                    type: "created",
                    message: "Minh đã tạo hành trình.",
                    createdAt: "2026-10-03T00:00:00Z",
                  },
                ],
                total: 1,
              }
            : url === "/users/me"
              ? { ...profile, coupleId: active?.id ?? null }
              : {
                  name: "Chúng mình",
                  inviterName: "Lan",
                  expiresAt: futureInviteExpiry(),
                  isSelf: false,
                },
  }));
  vi.spyOn(apiClient, "post").mockImplementation(async (url, body) => {
    if (url === "/couples") {
      active = structuredClone(solo);
      return { data: active };
    }
    if (url === "/couples/invite") {
      active = {
        ...active!,
        invite: { id: "invite", expiresAt: futureInviteExpiry() },
      };
      return {
        data: {
          id: "invite",
          code: "ABCD2345",
          path: "/invite/ABCD2345",
          expiresAt: futureInviteExpiry(),
        },
      };
    }
    if (url === "/couples/accept") {
      active = structuredClone(solo);
      return { data: active };
    }
    if (url === "/couples/transfer-owner") {
      active = { ...active!, role: "member", ownerId: "lan" };
    }
    return { data: body };
  });
  vi.spyOn(apiClient, "put").mockResolvedValue({ data: solo });
  vi.spyOn(apiClient, "delete").mockImplementation(async (url) => {
    if (url === "/couples/leave") {
      archived = [
        { ...active!, status: "archived", archivedAt: "2026-10-03T00:00:00Z" },
      ];
      active = null;
    }
    if (url === "/couples/invite") active = { ...active!, invite: null };
    return { data: {} };
  });
});
afterEach(() => vi.unstubAllGlobals());
it("empty state offers create and inspect invitation, no fake debt", async () => {
  wrap(<CouplePage />);
  expect(
    await screen.findByText("Một chỗ dành cho chúng mình"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Tạo không gian chung" }),
  ).toBeEnabled();
  expect(screen.queryByText(/Đã cân bằng/)).not.toBeInTheDocument();
});
it("create validates name and submits anniversary", async () => {
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Tạo không gian chung" }),
  );
  await userEvent.clear(screen.getByLabelText("Tên không gian chung"));
  expect(screen.getByRole("button", { name: "Lưu hành trình" })).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("Tên không gian chung"),
    "Minh & Lan",
  );
  fireEvent.change(screen.getByLabelText("Ngày bắt đầu bên nhau"), {
    target: { value: "2020-10-03" },
  });
  await userEvent.click(screen.getByRole("button", { name: "Lưu hành trình" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/couples", {
      name: "Minh & Lan",
      anniversary: "2020-10-03",
    }),
  );
  expect(await screen.findByText("Chờ người thương")).toBeInTheDocument();
});
it("code form opens preview instead of accepting without review", async () => {
  wrap(<CouplePage />);
  await userEvent.type(
    await screen.findByLabelText("Mã mời của người thương"),
    "abcd2345",
  );
  await userEvent.click(screen.getByRole("button", { name: /Xem lời mời/ }));
  expect(
    await screen.findByText("Một lời mời cùng vun đắp"),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalledWith(
    "/couples/accept",
    expect.anything(),
  );
});
it("owner sees anniversary and creates code with copy buttons", async () => {
  active = structuredClone(solo);
  wrap(<CouplePage />);
  expect(
    await screen.findByText(/Hôm nay là ngày kỷ niệm của chúng mình/),
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Tạo mã mời" }));
  expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sao chép mã" })).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Sao chép liên kết" }),
  ).toBeEnabled();
});
it("invitation revocation requires confirmation", async () => {
  active = {
    ...structuredClone(solo),
    invite: { id: "invite", expiresAt: futureInviteExpiry() },
  };
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Thu hồi mã" }),
  );
  expect(apiClient.delete).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Xác nhận thu hồi" }),
  );
  await waitFor(() =>
    expect(apiClient.delete).toHaveBeenCalledWith("/couples/invite", {
      data: {},
    }),
  );
});
it("member has no owner invite actions", async () => {
  active = {
    ...structuredClone(solo),
    role: "member",
    ownerId: "lan",
    members: [
      ...solo.members,
      {
        userId: "lan",
        name: "Lan",
        avatar: null,
        role: "owner",
        active: true,
        joinedAt: "2026-10-03T00:00:00Z",
        leftAt: null,
      },
    ],
  };
  wrap(<CouplePage />);
  expect(
    await screen.findByRole("button", { name: "Rời không gian chung" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Tạo mã mời" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Chuyển quyền chủ không gian" }),
  ).not.toBeInTheDocument();
});
it("owner with partner must transfer before leaving", async () => {
  active = {
    ...structuredClone(solo),
    members: [
      ...solo.members,
      {
        userId: "lan",
        name: "Lan",
        avatar: null,
        role: "member",
        active: true,
        joinedAt: "2026-10-03T00:00:00Z",
        leftAt: null,
      },
    ],
  };
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Chuyển quyền chủ không gian" }),
  );
  expect(apiClient.post).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Chuyển quyền" }));
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/couples/transfer-owner", {
      userId: "lan",
    }),
  );
  expect(
    await screen.findByRole("button", { name: "Rời không gian chung" }),
  ).toBeInTheDocument();
});
it("solo dissolution gated by checkbox and archives without fake deletion", async () => {
  active = structuredClone(solo);
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Giải tán không gian chung" }),
  );
  expect(
    screen.getByRole("button", { name: "Xác nhận lưu trữ" }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByLabelText("Tôi hiểu và xác nhận lưu trữ không gian chung."),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Xác nhận lưu trữ" }),
  );
  await waitFor(() =>
    expect(apiClient.delete).toHaveBeenCalledWith("/couples/leave", {
      data: { confirm: true, dissolve: true, confirmOutstanding: false },
    }),
  );
  expect(
    await screen.findByText("Một chỗ dành cho chúng mình"),
  ).toBeInTheDocument();
});
it("outstanding debt needs a separate confirmation", async () => {
  active = {
    ...structuredClone(solo),
    outstanding: { count: 2, summaryAvailable: false },
  };
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Giải tán không gian chung" }),
  );
  await userEvent.click(
    screen.getByLabelText("Tôi hiểu và xác nhận lưu trữ không gian chung."),
  );
  expect(
    screen.getByRole("button", { name: "Xác nhận lưu trữ" }),
  ).toBeDisabled();
  await userEvent.click(
    screen.getByLabelText("Tôi xác nhận vẫn lưu trữ khi còn công nợ."),
  );
  expect(
    screen.getByRole("button", { name: "Xác nhận lưu trữ" }),
  ).toBeEnabled();
});
it("archive is read only and still displays activity", async () => {
  archived = [
    {
      ...structuredClone(solo),
      status: "archived",
      archivedAt: "2026-10-03T00:00:00Z",
    },
  ];
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", {
      name: /Hành trình chúng mình.*Chỉ đọc/,
    }),
  );
  expect(await screen.findByText(/Chỉ đọc · Lưu trữ/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Sửa thông tin & ngày kỷ niệm" }),
  ).not.toBeInTheDocument();
  expect(
    await screen.findByText("Minh đã tạo hành trình."),
  ).toBeInTheDocument();
});
it("invitation preview requires explicit accept and preserves personal privacy notice", async () => {
  wrap(<CouplePage />, "/invite/ABCD2345");
  expect(await screen.findByText(/Lan mời bạn/)).toBeInTheDocument();
  expect(
    screen.getByText(/Tài chính cá nhân và tập luyện vẫn riêng tư/),
  ).toBeInTheDocument();
  expect(apiClient.post).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("button", { name: "Chấp nhận và ghép đôi" }),
  );
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith("/couples/accept", {
      code: "ABCD2345",
    }),
  );
});
it("already paired account cannot accept an invitation", async () => {
  active = { ...structuredClone(solo), id: "existing" };
  useAuthStore.getState().updateUser({ ...profile, coupleId: "existing" });
  wrap(<CouplePage />, "/invite/ABCD2345");
  expect(
    await screen.findByText(/Bạn đã có không gian chung/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Chấp nhận và ghép đôi" }),
  ).not.toBeInTheDocument();
});
it("server expiration error appears without exposing another couple", async () => {
  const previous = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
    if (url.startsWith("/couples/invite/"))
      throw {
        isAxiosError: true,
        response: {
          data: { error: { message: "Mã mời không còn hiệu lực." } },
        },
      };
    return previous(url, config);
  });
  wrap(<CouplePage />, "/invite/ABCD2345");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Mã mời không còn hiệu lực.",
  );
  expect(
    screen.queryByRole("button", { name: "Chấp nhận và ghép đôi" }),
  ).not.toBeInTheDocument();
});
it("dashboard uses real anniversary instead of sample names", async () => {
  active = structuredClone(solo);
  wrap(<CouplePreview />);
  expect(
    await screen.findByText(/Hôm nay là ngày kỷ niệm ♡/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Mở không gian chung/ }),
  ).toHaveAttribute("href", "/couple");
});

it("server membership refresh clears stale coupleId after partner leaves", async () => {
  useAuthStore.getState().updateUser({ ...profile, coupleId: "old" });
  wrap(<CouplePage />);
  await screen.findByText("Một chỗ dành cho chúng mình");
  expect(useAuthStore.getState().user?.coupleId).toBeNull();
});

it("mã mời đã tạo vẫn hiển thị khi tải lại hồ sơ bị lỗi mạng", async () => {
  active = structuredClone(solo);
  const original = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => {
    if (url === "/users/me") throw new Error("Mất mạng");
    return original(url, config);
  });
  wrap(<CouplePage />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Tạo mã mời" }),
  );
  expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
  expect(apiClient.post).toHaveBeenCalledTimes(1);
});

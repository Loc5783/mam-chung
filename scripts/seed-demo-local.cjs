/* Adds only two named local demo accounts. Never resets existing accounts or data. */
const assert = require("node:assert/strict");
const BASE = "http://127.0.0.1:4000/api";
const PASSWORD = "DemoMam2026!";
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const shift = (n) =>
  new Date(Date.parse(date + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
async function request(token, method, url, body) {
  const r = await fetch(BASE + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text(),
    data = text ? JSON.parse(text) : null;
  if (!r.ok)
    throw Object.assign(
      new Error(
        url + " " + r.status + " " + (data?.error?.message ?? "Lỗi API"),
      ),
      { status: r.status },
    );
  return data;
}
async function account(email, name) {
  try {
    return await request(null, "POST", "/auth/login", {
      email,
      password: PASSWORD,
    });
  } catch (error) {
    if (error.status !== 401) throw error;
    try {
      return await request(null, "POST", "/auth/register", {
        email,
        name,
        password: PASSWORD,
      });
    } catch (e) {
      if (e.status === 409)
        throw Error(
          "Tài khoản demo đã tồn tại với mật khẩu khác; không ghi đè.",
        );
      throw e;
    }
  }
}
async function seed() {
  const health = await request(null, "GET", "/health");
  assert.equal(health.status, "ok");
  assert.equal(
    health.development,
    true,
    "Chỉ tạo dữ liệu demo trên API development local",
  );
  const a = await account("minh.demo@mamchung.test", "Minh · dữ liệu demo"),
    b = await account("an.demo@mamchung.test", "An · dữ liệu demo");
  assert.equal(
    a.user.name,
    "Minh · dữ liệu demo",
    "Không sửa tài khoản khác trùng email demo",
  );
  assert.equal(
    b.user.name,
    "An · dữ liệu demo",
    "Không sửa tài khoản khác trùng email demo",
  );
  const call = (u, method, url, body) =>
      request(u.accessToken, method, url, body),
    list = async (u, url) => (await call(u, "GET", url)).items;
  const cats = await list(a, "/categories?limit=100"),
    food = cats.find((x) => x.isSystem && x.name === "Ăn uống"),
    salary = cats.find((x) => x.isSystem && x.name === "Lương");
  assert(food && salary);
  const wallets = await list(a, "/wallets?limit=100");
  const wallet =
    wallets.find((x) => x.name === "Demo · Ví sinh hoạt") ??
    (await call(a, "POST", "/wallets", {
      name: "Demo · Ví sinh hoạt",
      type: "bank",
      initialBalance: 2000000,
    }));
  for (const [description, type, amount, categoryId] of [
    ["Demo · Thu nhập tháng", "income", 12000000, salary.id],
    ["Demo · Bữa ăn và thực phẩm", "expense", 1700000, food.id],
    ["Demo · Cà phê cuối tuần", "expense", 400000, food.id],
  ]) {
    if (
      !(
        await list(
          a,
          "/transactions?limit=100&search=" + encodeURIComponent(description),
        )
      ).some((t) => t.description === description)
    )
      await call(a, "POST", "/transactions", {
        walletId: wallet.id,
        categoryId,
        date,
        description,
        type,
        amount,
      });
  }
  if (
    !(await list(a, "/budgets?month=" + date.slice(0, 7))).some(
      (x) => x.categoryId === food.id,
    )
  )
    await call(a, "POST", "/budgets", {
      categoryId: food.id,
      month: date.slice(0, 7),
      amount: 2000000,
    });
  const goals = await list(a, "/goals");
  const goal =
    goals.find((x) => x.name === "Demo · Quỹ học tập") ??
    (await call(a, "POST", "/goals", {
      name: "Demo · Quỹ học tập",
      targetAmount: 5000000,
    }));
  if (
    !(await list(a, "/goals/" + goal.id + "/contributions?limit=100")).some(
      (x) => x.notes === "Demo · Để dành đầu tiên",
    )
  )
    await call(a, "POST", "/goals/" + goal.id + "/contribute", {
      amount: 1000000,
      date,
      notes: "Demo · Để dành đầu tiên",
    });
  let pair = (await call(a, "GET", "/couples/me")).couple,
    other = (await call(b, "GET", "/couples/me")).couple;
  if (!pair && !other) {
    pair = await call(a, "POST", "/couples", {
      name: "Demo · Hành trình Minh & An",
      anniversary: shift(-365),
    });
  }
  assert.equal(
    pair?.name,
    "Demo · Hành trình Minh & An",
    "Demo đang ở cặp khác; không thay đổi",
  );
  if (!other) {
    const invite = await call(a, "POST", "/couples/invite", {});
    await call(b, "GET", "/couples/invite/" + invite.code);
    other = await call(b, "POST", "/couples/accept", { code: invite.code });
  }
  assert.equal(
    other.id,
    pair.id,
    "Hai tài khoản demo thuộc cặp khác; không thay đổi",
  );
  const funds = await list(a, "/shared-wallets"),
    fund =
      funds.find((x) => x.name === "Demo · Quỹ cuối tuần") ??
      (await call(a, "POST", "/shared-wallets", {
        name: "Demo · Quỹ cuối tuần",
      }));
  if (
    !(
      await list(a, "/shared-wallets/" + fund.id + "/contributions?limit=100")
    ).some((x) => x.notes === "Demo · Nạp quỹ ban đầu")
  )
    await call(a, "POST", "/shared-wallets/" + fund.id + "/contribute", {
      amount: 1500000,
      date,
      notes: "Demo · Nạp quỹ ban đầu",
    });
  let createdPersonalExpense = false;
  for (const [description, amount, paidFrom] of [
    ["Demo · Vé vui chơi", 300001, "personal"],
    ["Demo · Bữa tối chung", 250000, "fund"],
  ]) {
    if (
      !(await list(a, "/shared-transactions?limit=100")).some(
        (x) => x.description === description,
      )
    ) {
      await call(a, "POST", "/shared-transactions", {
        sharedWalletId: fund.id,
        payerId: a.user.id,
        amount,
        date,
        description,
        categoryId: food.id,
        splitType: "equal",
        paidFrom,
      });
      if (paidFrom === "personal") createdPersonalExpense = true;
    }
  }
  const debt = (await list(b, "/settlements?limit=100")).find(
    (x) => x.status === "pending" && x.amount === 150000,
  );
  if (debt && createdPersonalExpense)
    await call(b, "PUT", "/settlements/" + debt.id + "/mark-paid", {
      notes: "Demo · Đã chuyển bên ngoài ứng dụng",
    });
  for (const [title, scope, deadline, assignedTo] of [
    ["Demo · Chuẩn bị bữa tối", "shared", date, b.user.id],
    ["Demo · Đọc sách 20 phút", "personal", date, a.user.id],
    ["Demo · Sắp xếp bàn làm việc", "personal", shift(-1), a.user.id],
  ]) {
    if (
      !(
        await list(a, "/tasks?limit=100&search=" + encodeURIComponent(title))
      ).some((x) => x.title === title)
    )
      await call(a, "POST", "/tasks", {
        title,
        scope,
        deadline,
        assignedTo,
        priority: "MEDIUM",
      });
  }
  const ex = (await list(a, "/exercises")).find(
    (x) => x.name === "Bench Press",
  );
  assert(ex);
  for (let i = 0; i < 3; i++) {
    const note = "Demo · Buổi tập " + (i + 1);
    let session = (await list(a, "/workout-sessions?limit=100")).find(
      (x) => x.notes === note,
    );
    if (!session)
      session = await call(a, "POST", "/workout-sessions", {
        date: shift(-i * 2),
        durationMinutes: 45 + i * 5,
        notes: note,
        mood: 4,
      });
    const detail = await call(a, "GET", "/workout-sessions/" + session.id);
    for (let number = 1; number <= 3; number++)
      if (
        !detail.sets.some(
          (x) => x.setNumber === number && x.exerciseId === ex.id,
        )
      )
        await call(a, "POST", "/workout-sets", {
          sessionId: session.id,
          exerciseId: ex.id,
          setNumber: number,
          weight: 60 + i * 5,
          reps: 8,
          done: true,
        });
  }
  if (
    !(await list(a, "/workout-templates")).some(
      (x) => x.name === "Demo · Tập ngực nhẹ",
    )
  )
    await call(a, "POST", "/workout-templates", {
      name: "Demo · Tập ngực nhẹ",
      items: [
        { exerciseId: ex.id, weight: 60, reps: 8, setType: "working", rpe: 7 },
      ],
    });
  if (
    !(await list(a, "/body-metrics?limit=100")).some(
      (x) => x.notes === "Demo · Số đo tham khảo",
    )
  )
    await call(a, "POST", "/body-metrics", {
      date,
      weight: 65,
      waist: 76,
      notes: "Demo · Số đo tham khảo",
    });
  for (const u of [a, b]) await call(u, "GET", "/notifications");
  console.log(
    "Demo đã sẵn sàng: minh.demo@mamchung.test / an.demo@mamchung.test · mật khẩu DemoMam2026!",
  );
  console.log(
    "Dữ liệu hoàn toàn giả. Chạy lại giữ những mục đã có; không reset hoặc sửa tài khoản demo cũ.",
  );
  for (const u of [a, b]) await call(u, "POST", "/auth/logout");
}
seed().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

const storageKey = "porsche-family-expenses";
const budgetStorageKey = "porsche-family-budget";
const recurringStorageKey = "porsche-family-recurring";
const syncEndpointStorageKey = "porsche-family-sheet-endpoint";

const categories = {
  food: { label: "อาหาร / เครื่องดื่ม", icon: "i-food", color: "#ff8b9d", group: "daily" },
  travel: { label: "เดินทาง", icon: "i-car", color: "#ffdc79", group: "daily" },
  child: { label: "ค่าใช้จ่ายลูก", icon: "i-child", color: "#ff9bb0", group: "lifestyle" },
  home: { label: "บ้าน / ค่าสาธารณูปโภค", icon: "i-house", color: "#a9e8db", group: "daily" },
  shop: { label: "ช้อปปิ้ง / ของใช้", icon: "i-bag", color: "#cbb6f2", group: "lifestyle" },
  education: { label: "การศึกษา", icon: "i-grad", color: "#ffd978", group: "education" },
  health: { label: "สุขภาพ", icon: "i-health", color: "#8de0c4", group: "health" },
  car: { label: "รถยนต์", icon: "i-steering", color: "#8fcdee", group: "daily" },
  subscription: { label: "ค่าสมาชิก / แอป", icon: "i-apps", color: "#a9a0ef", group: "lifestyle" },
  installment: { label: "ผ่อนชำระ", icon: "i-card", color: "#ffb38a", group: "daily" },
  other: { label: "อื่นๆ", icon: "i-more", color: "#dcd6ed", group: "daily" },
};

const quickGroups = {
  daily: "ค่าใช้จ่ายประจำวัน",
  education: "การศึกษา",
  health: "สุขภาพ",
  lifestyle: "ไลฟ์สไตล์",
};

const demoExpenses = [
  { id: 1, title: "ซื้อวัตถุดิบทำอาหาร", category: "food", amount: 450, date: "2024-05-31" },
  { id: 2, title: "ค่าเทอม น้องพอร์ช", category: "child", amount: 2800, date: "2024-05-18" },
  { id: 3, title: "เติมน้ำมัน", category: "travel", amount: 800, date: "2024-05-17" },
  { id: 4, title: "ค่าน้ำประปา", category: "home", amount: 285, date: "2024-05-16" },
  { id: 5, title: "ซื้อของใช้ในบ้าน", category: "shop", amount: 690, date: "2024-05-15" },
  { id: 6, title: "อาหารกลางวัน", category: "food", amount: 5470, date: "2024-05-14" },
  { id: 7, title: "รถรับส่งโรงเรียน", category: "travel", amount: 2530, date: "2024-05-12" },
  { id: 8, title: "ค่าหนังสือ", category: "education", amount: 4850, date: "2024-05-10" },
  { id: 9, title: "ยาสามัญ", category: "health", amount: 2360, date: "2024-05-08" },
  { id: 10, title: "ของเล่นเสริมพัฒนาการ", category: "child", amount: 1280, date: "2024-05-07" },
  { id: 11, title: "บริการจิปาถะ", category: "other", amount: 1045, date: "2024-05-06" },
  { id: 12, title: "ค่าอาหารเดือนเมษายน", category: "food", amount: 5200, date: "2024-04-22" },
  { id: 13, title: "ค่าน้ำมันเดือนเมษายน", category: "travel", amount: 3100, date: "2024-04-12" },
  { id: 14, title: "ค่าไฟเดือนเมษายน", category: "home", amount: 2120, date: "2024-04-05" },
  { id: 15, title: "ของใช้เด็ก", category: "child", amount: 5200, date: "2024-04-03" },
  { id: 16, title: "ค่าอาหารเดือนมีนาคม", category: "food", amount: 4890, date: "2024-03-19" },
  { id: 17, title: "ค่ารักษาพยาบาล", category: "health", amount: 3600, date: "2024-03-11" },
  { id: 18, title: "ซื้อของใช้", category: "shop", amount: 3400, date: "2024-03-09" },
  { id: 19, title: "ค่าเดินทางเดือนกุมภาพันธ์", category: "travel", amount: 4230, date: "2024-02-14" },
  { id: 20, title: "ค่าหนังสือเรียน", category: "education", amount: 7000, date: "2024-02-03" },
  { id: 21, title: "อาหารครอบครัว", category: "food", amount: 3000, date: "2024-01-20" },
  { id: 22, title: "ค่าส่วนกลาง", category: "home", amount: 9450, date: "2024-01-07" },
];

const defaultBudget = {
  total: 25000,
  categories: { food: 6500, travel: 4000, child: 5500, home: 3500 },
};

const defaultRecurring = [
  { id: 101, title: "ค่าน้ำประปา", category: "home", amount: 285, day: 16 },
  { id: 102, title: "ค่าอินเทอร์เน็ตบ้าน", category: "home", amount: 899, day: 25 },
  { id: 103, title: "ค่าเทอม น้องพอร์ช", category: "child", amount: 2800, day: 18 },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortMoney = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
});

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

let state = {
  expenses: loadExpenses(),
  budget: loadBudget(),
  recurring: loadRecurring(),
  syncEndpoint: loadSyncEndpoint(),
  month: currentMonthKey(),
  categoryFilter: "all",
  period: "month",
  view: "home",
};

function loadExpenses() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return demoExpenses;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : demoExpenses;
  } catch {
    return demoExpenses;
  }
}

function loadBudget() {
  const saved = localStorage.getItem(budgetStorageKey);
  const fallback = clone(defaultBudget);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadRecurring() {
  const saved = localStorage.getItem(recurringStorageKey);
  const fallback = clone(defaultRecurring);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

// ลิงก์ Google Apps Script Web App เริ่มต้น (ฝังไว้ให้ทุกเครื่องใช้ได้เลย ไม่ต้องกรอกเอง)
const DEFAULT_SYNC_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyMfOvzJL56lBaO1qzLNGRgjPyN4O2ZqwkQt9eMGRISj_6nm35mklvDeLUQStwvF5OBQw/exec";

function loadSyncEndpoint() {
  return localStorage.getItem(syncEndpointStorageKey) || DEFAULT_SYNC_ENDPOINT;
}

function saveExpenses() {
  localStorage.setItem(storageKey, JSON.stringify(state.expenses));
  queueAutoSync();
}

function saveBudget() {
  localStorage.setItem(budgetStorageKey, JSON.stringify(state.budget));
  queueAutoSync();
}

function saveRecurring() {
  localStorage.setItem(recurringStorageKey, JSON.stringify(state.recurring));
  queueAutoSync();
}

function saveLocalSnapshot() {
  localStorage.setItem(storageKey, JSON.stringify(state.expenses));
  localStorage.setItem(budgetStorageKey, JSON.stringify(state.budget));
  localStorage.setItem(recurringStorageKey, JSON.stringify(state.recurring));
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function iconMarkup(id) {
  return `<svg class="svg-icon"><use href="#${id}"></use></svg>`;
}

function iconBadge(categoryKey, fallbackIcon = "i-more") {
  const category = categories[categoryKey];
  const color = category?.color || "#dcd6ed";
  const icon = category?.icon || fallbackIcon;
  return `<span class="category-icon" style="--cat-color:${color}; --cat-bg:${softColor(color)}">${iconMarkup(icon)}</span>`;
}

function softColor(hex) {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, 0.16)`;
}

function monthOf(date) {
  return String(date).slice(0, 7);
}

function daysInMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

// แปลง "รายจ่ายประจำ" เป็นรายการเสมือนของเดือนนั้น เพื่อให้ถูกนับในยอดรวม/กราฟอัตโนมัติ
function recurringVirtualForMonth(monthKey) {
  if (!Array.isArray(state.recurring)) return [];
  const last = daysInMonth(monthKey);
  return state.recurring.map((r) => ({
    id: `rec_${r.id}_${monthKey}`,
    recurringId: r.id,
    title: r.title,
    category: r.category,
    amount: Number(r.amount || 0),
    date: `${monthKey}-${String(Math.min(Number(r.day) || 1, last)).padStart(2, "0")}`,
    recurringVirtual: true,
  }));
}

function realForMonth(monthKey) {
  return state.expenses.filter((item) => monthOf(item.date) === monthKey);
}

// รายการจริงที่บันทึกเอง (ไม่รวมรายจ่ายประจำ) — ใช้กับลิสต์ "รายการทั้งหมด" และ "รายการล่าสุด"
function realMonthlyExpenses() {
  return realForMonth(state.month);
}

// รวมรายจ่ายประจำเข้าไปด้วย — ใช้กับยอดรวม/โดนัท/หมวด/งบ
function monthlyExpenses() {
  return [...realForMonth(state.month), ...recurringVirtualForMonth(state.month)];
}

function selectedExpenses() {
  if (state.period === "year") {
    const year = state.month.slice(0, 4);
    const real = state.expenses.filter((item) => monthOf(item.date).slice(0, 4) === year);
    const virtual = [];
    for (let m = 1; m <= 12; m += 1) {
      virtual.push(...recurringVirtualForMonth(`${year}-${String(m).padStart(2, "0")}`));
    }
    return [...real, ...virtual];
  }

  if (state.period === "day") {
    const base = monthlyExpenses();
    const latestDate = sortedByDate(base)[0]?.date;
    return latestDate ? base.filter((item) => item.date === latestDate) : [];
  }

  return monthlyExpenses();
}

// ตัวกรองสำหรับลิสต์ "รายการทั้งหมด" — แสดงเฉพาะรายการจริง ไม่รวมรายจ่ายประจำ
function filteredExpenses() {
  const base = realMonthlyExpenses();
  if (state.categoryFilter === "all") return base;
  return base.filter((item) => item.category === state.categoryFilter);
}

function categoryTotals(items = selectedExpenses()) {
  return Object.keys(categories).map((key) => {
    const total = sum(items.filter((item) => item.category === key));
    return { key, total, ...categories[key] };
  });
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

// แปลงค่าวันที่ให้เป็นรูปแบบ YYYY-MM-DD เสมอ (รองรับกรณี Google Sheet คืนค่าเป็น ISO timestamp เต็ม)
function toISODate(value) {
  if (!value) return "";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
  const date = new Date(`${toISODate(value)}T00:00:00`);
  const today = new Date();
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (sameDay) return "วันนี้";

  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function formatMonth(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return date.toLocaleDateString("th-TH", { month: "long", year: "numeric" });
}

function selectedMonthDate(day = 1) {
  const [year, month] = state.month.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${state.month}-${String(Math.min(Number(day), lastDay)).padStart(2, "0")}`;
}

function daysUntil(day) {
  const today = new Date();
  const due = new Date(`${selectedMonthDate(day)}T00:00:00`);
  return Math.ceil((due - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

function donutGradient(items, total) {
  if (!total) return "conic-gradient(#f3e7eb 0 100%)";

  let cursor = 0;
  const parts = items
    .filter((item) => item.total > 0)
    .map((item) => {
      const start = cursor;
      const size = (item.total / total) * 100;
      cursor += size;
      return `${item.color} ${start}% ${cursor}%`;
    });

  return `conic-gradient(${parts.join(", ")})`;
}

function setView(view) {
  if (!["home", "records", "analysis"].includes(view)) view = "home";
  state.view = view;
  document.querySelectorAll(".phone-screen").forEach((screen) => {
    screen.classList.toggle("is-current", screen.id === view || (view === "home" && screen.classList.contains("home-screen")));
  });
  document.querySelectorAll("[data-nav]").forEach((nav) => {
    nav.classList.toggle("active", nav.dataset.nav === view);
  });
  if (view === "home") window.location.hash = "home";
  if (view === "records") window.location.hash = "records";
  if (view === "analysis") window.location.hash = "analysis";
}

function renderLabels() {
  document.querySelectorAll("[data-month-label]").forEach((el) => {
    el.textContent = `ค่าใช้จ่าย ${formatMonth(state.month)}`;
  });
  document.querySelectorAll("[data-report-month]").forEach((el) => {
    el.textContent = formatMonth(state.month);
  });
  document.querySelectorAll("[data-month-filter]").forEach((el) => {
    el.value = state.month;
  });
}

function renderTotals() {
  const total = sum(selectedExpenses());
  document.querySelectorAll("[data-total-amount]").forEach((el) => {
    el.textContent = `฿ ${money.format(total)}`;
  });
  document.querySelectorAll("[data-total-short], [data-analysis-total]").forEach((el) => {
    el.textContent = `฿ ${shortMoney.format(total)}`;
  });
}

function renderQuickCards() {
  const items = selectedExpenses();
  Object.entries(quickGroups).forEach(([group, label]) => {
    const card = document.querySelector(`[data-quick-group="${group}"]`);
    if (!card) return;

    const groupItems = items.filter((item) => categories[item.category]?.group === group);
    card.querySelector("h2").textContent = label;
    card.querySelector("strong").textContent = `฿ ${money.format(sum(groupItems))}`;
    card.querySelector("small").textContent = `${groupItems.length} รายการ`;
  });
}

function renderBudget() {
  const total = sum(monthlyExpenses());
  const budget = Number(state.budget.total || 0);
  const ratio = budget ? Math.min(100, Math.round((total / budget) * 100)) : 0;
  const left = Math.max(0, budget - total);

  document.querySelectorAll("[data-budget-used]").forEach((el) => {
    el.textContent = `฿ ${shortMoney.format(total)}`;
  });
  document.querySelectorAll("[data-budget-text]").forEach((el) => {
    el.textContent = budget ? `ใช้ไป ${ratio}% ของงบ ฿ ${shortMoney.format(budget)}` : "ยังไม่ได้ตั้งงบรวม";
  });
  document.querySelectorAll("[data-budget-left]").forEach((el) => {
    el.textContent = budget ? `เหลือ ฿ ${shortMoney.format(left)}` : "ตั้งงบ";
    el.classList.toggle("is-over", budget > 0 && total > budget);
  });
  document.querySelectorAll("[data-budget-progress]").forEach((el) => {
    el.style.width = `${ratio}%`;
    el.classList.toggle("is-over", budget > 0 && total > budget);
  });
}

function renderCategoryViews() {
  const items = categoryTotals();
  const total = sum(selectedExpenses());
  const visibleItems = items.filter((item) => item.total > 0);
  const gradient = donutGradient(items, total);
  document.querySelectorAll("[data-donut], [data-big-donut]").forEach((el) => {
    el.style.background = gradient;
  });

  const legend = document.querySelector("[data-legend-list]");
  if (legend) {
    legend.innerHTML = visibleItems.length
      ? visibleItems
          .map(
            (item) =>
              `<li>${iconBadge(item.key)}<b>${item.label}</b><em>${percent(item.total, total)}%</em></li>`,
          )
          .join("")
      : `<li><span class="category-icon">${iconMarkup("i-more")}</span><b>ยังไม่มีข้อมูล</b><em>0%</em></li>`;
  }

  const categoryList = document.querySelector("[data-category-list]");
  if (categoryList) {
    categoryList.innerHTML = visibleItems.length
      ? visibleItems
          .sort((a, b) => b.total - a.total)
          .map(
            (item) =>
              `<li>${iconBadge(item.key)}<b>${item.label}</b><em>${percent(item.total, total)}%</em><strong>฿ ${money.format(item.total)}</strong><i>›</i></li>`,
          )
          .join("")
      : `<li class="empty-row"><b>ยังไม่มีรายจ่ายในช่วงนี้</b></li>`;
  }

  // สร้างป้ายหมวดรอบโดนัทใหญ่อัตโนมัติจากทุกหมวด (กระจายตำแหน่งเท่าๆ กันรอบวง)
  document.querySelectorAll("[data-big-donut]").forEach((donut) => {
    donut.querySelectorAll(".chart-label").forEach((el) => el.remove());
    const n = items.length;
    const cx = 119, cy = 119, rx = 150, ry = 142;
    items.forEach((item, i) => {
      const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      const span = document.createElement("span");
      span.className = "chart-label";
      span.dataset.category = item.key;
      span.style.left = `${Math.round(x - 46)}px`;
      span.style.top = `${Math.round(y - 30)}px`;
      span.style.setProperty("--cat-color", item.color);
      span.style.setProperty("--cat-bg", softColor(item.color));
      span.innerHTML = `<span class="label-icon">${iconMarkup(item.icon)}</span><b>${percent(item.total, total)}%</b><small>${item.label}</small>`;
      donut.appendChild(span);
    });
  });
}

function recurringPosted(recurring) {
  return state.expenses.some(
    (item) =>
      item.recurringId === recurring.id &&
      monthOf(item.date) === state.month,
  );
}

function renderRecurring() {
  const list = document.querySelector("[data-recurring-list]");
  if (!list) return;

  list.innerHTML = state.recurring.length
    ? state.recurring
        .slice()
        .sort((a, b) => Number(a.day) - Number(b.day))
        .map((item) => {
          const category = categories[item.category] || categories.other;
          const posted = recurringPosted(item);
          return `<li>
    <span class="category-icon" style="--cat-color:${category.color}; --cat-bg:${softColor(category.color)}">${iconMarkup("i-repeat")}</span>
            <b>${item.title}<small>${category.label} · ทุกวันที่ ${item.day}</small></b>
            <strong>฿ ${money.format(item.amount)}</strong>
            <span class="small-pill auto-pill" title="นับเข้ายอดอัตโนมัติทุกเดือน">อัตโนมัติ</span>
            <button class="delete-expense" type="button" data-delete-recurring="${item.id}" aria-label="ลบ ${item.title}">${iconMarkup("i-trash")}</button>
          </li>`;
        })
        .join("")
    : `<li class="empty-row"><b>ยังไม่มีรายจ่ายประจำ</b></li>`;
}

function buildAlerts() {
  const alerts = [];
  const monthlyTotal = sum(monthlyExpenses());
  const budget = Number(state.budget.total || 0);

  if (budget && monthlyTotal > budget) {
    alerts.push({
      title: "ใช้เกินงบรวมแล้ว",
      detail: `เกินงบไป ฿ ${money.format(monthlyTotal - budget)}`,
      tone: "danger",
    });
  } else if (budget && monthlyTotal / budget >= 0.8) {
    alerts.push({
      title: "ใช้งบไปเกิน 80%",
      detail: `เหลือ ฿ ${money.format(Math.max(0, budget - monthlyTotal))}`,
      tone: "warn",
    });
  }

  Object.entries(state.budget.categories || {}).forEach(([key, value]) => {
    const limit = Number(value || 0);
    if (!limit) return;
    const categoryTotal = sum(monthlyExpenses().filter((item) => item.category === key));
    if (categoryTotal > limit) {
      alerts.push({
        title: `${categories[key]?.label || "หมวดนี้"} เกินงบ`,
        detail: `ใช้ไป ฿ ${money.format(categoryTotal)} จากงบ ฿ ${money.format(limit)}`,
        tone: "danger",
      });
    }
  });

  state.recurring.forEach((item) => {
    if (recurringPosted(item)) return;
    const remaining = daysUntil(item.day);
    if (remaining <= 7) {
      alerts.push({
        title: `บิลใกล้ครบกำหนด: ${item.title}`,
        detail: remaining < 0 ? "เลยกำหนดแล้วและยังไม่ได้บันทึก" : `อีก ${remaining} วัน · ฿ ${money.format(item.amount)}`,
        tone: remaining < 0 ? "danger" : "warn",
      });
    }
  });

  if (!monthlyExpenses().some((item) => item.date === new Date().toISOString().slice(0, 10))) {
    alerts.push({
      title: "วันนี้ยังไม่มีรายการใหม่",
      detail: "แตะปุ่ม + เพื่อบันทึกรายจ่ายวันนี้",
      tone: "info",
    });
  }

  return alerts;
}

function renderAlerts() {
  const alerts = buildAlerts();
  document.querySelectorAll("[data-alert-count]").forEach((el) => {
    el.textContent = String(Math.min(alerts.length, 9));
    el.hidden = alerts.length === 0;
  });

  const list = document.querySelector("[data-alert-list]");
  if (!list) return;
  list.innerHTML = alerts.length
    ? alerts
        .map(
          (alert) =>
            `<li class="${alert.tone}"><span>${iconMarkup(alert.tone === "info" ? "i-bell" : "i-budget")}</span><b>${alert.title}<small>${alert.detail}</small></b></li>`,
        )
        .join("")
    : `<li class="info"><span>${iconMarkup("i-bell")}</span><b>ไม่มีแจ้งเตือน<small>ทุกอย่างยังอยู่ในเกณฑ์ดี</small></b></li>`;
}

function transactionMarkup(item, editable = false) {
  const category = categories[item.category] || categories.other;
  return `<li>
    ${iconBadge(item.category)}
    <b>${item.title}<small>${category.label}</small></b>
    <strong>฿ ${money.format(item.amount)}</strong>
    <em>${formatDate(item.date)}</em>
    <button class="edit-expense" type="button" data-edit-id="${item.id}" aria-label="แก้ไข ${item.title}">${iconMarkup("i-edit")}</button>
    <button class="delete-expense" type="button" data-delete-id="${item.id}" aria-label="ลบ ${item.title}">${iconMarkup("i-trash")}</button>
    ${editable ? "" : ""}
  </li>`;
}

function sortedByDate(items) {
  return items.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
  const recent = document.querySelector("[data-transaction-list]");
  if (recent) {
    const items = sortedByDate(realMonthlyExpenses()).slice(0, 7);
    recent.innerHTML = items.length
      ? items.map((item) => transactionMarkup(item)).join("")
      : `<li class="empty-row"><b>ยังไม่มีรายการในเดือนนี้</b></li>`;
  }

  const full = document.querySelector("[data-full-transaction-list]");
  const filtered = sortedByDate(filteredExpenses());
  if (full) {
    full.innerHTML = filtered.length
      ? filtered.map((item) => transactionMarkup(item, true)).join("")
      : `<li class="empty-row"><b>ยังไม่มีรายการตามตัวกรอง</b></li>`;
  }

  document.querySelectorAll("[data-record-count]").forEach((el) => {
    el.textContent = `${filtered.length} รายการ`;
  });
  document.querySelectorAll("[data-filtered-total]").forEach((el) => {
    el.textContent = `฿ ${money.format(sum(filtered))}`;
  });
  document.querySelectorAll("[data-filtered-note]").forEach((el) => {
    el.textContent = `${filtered.length} รายการ`;
  });
}

function trendData() {
  const [year, month] = state.month.split("-").map(Number);
  const rows = [];
  for (let index = 4; index >= 0; index -= 1) {
    const date = new Date(year, month - 1 - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    rows.push({
      key,
      label: date.toLocaleDateString("th-TH", { month: "short" }).replace(".", ""),
      total: sum([...state.expenses.filter((item) => monthOf(item.date) === key), ...recurringVirtualForMonth(key)]),
    });
  }
  return rows;
}

function renderTrend() {
  const rows = trendData();
  const max = Math.max(...rows.map((row) => row.total), 1);
  const width = 320;
  const top = 18;
  const bottom = 146;
  const usable = bottom - top;
  const xStep = 58;
  const points = rows.map((row, index) => {
    const x = 20 + index * xStep;
    const y = bottom - (row.total / max) * usable;
    return { ...row, x, y };
  });

  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L${points.at(-1).x} 150 L${points[0].x} 150 Z`;

  document.querySelector("[data-trend-line]")?.setAttribute("d", linePath);
  document.querySelector("[data-trend-area]")?.setAttribute("d", areaPath);

  const pointLayer = document.querySelector("[data-trend-points]");
  if (pointLayer) {
    pointLayer.innerHTML = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="7" />`).join("");
  }

  const labelLayer = document.querySelector("[data-trend-labels]");
  if (labelLayer) {
    labelLayer.innerHTML = points
      .map((point) => `<text x="${point.x}" y="${Math.max(12, point.y - 17)}">${shortMoney.format(point.total)}</text>`)
      .join("");
  }

  const monthLayer = document.querySelector("[data-trend-months]");
  if (monthLayer) {
    monthLayer.innerHTML = points.map((point) => `<text x="${point.x}" y="166">${point.label}</text>`).join("");
  }
}

function renderAll() {
  renderLabels();
  renderTotals();
  renderQuickCards();
  renderBudget();
  renderCategoryViews();
  renderTransactions();
  renderRecurring();
  renderAlerts();
  renderTrend();
}

function openModal(item = null) {
  const modal = document.querySelector("[data-entry-modal]");
  const form = document.querySelector("[data-expense-form]");
  const dateInput = form?.elements.date;
  form?.reset();

  if (item && form) {
    form.elements.id.value = item.id;
    form.elements.title.value = item.title;
    form.elements.category.value = item.category;
    form.elements.amount.value = item.amount;
    form.elements.date.value = item.date;
    document.querySelector("[data-modal-heading]").textContent = "แก้ไขรายจ่าย";
    document.querySelector("[data-submit-label]").textContent = "บันทึกการแก้ไข";
  } else {
    document.querySelector("[data-modal-heading]").textContent = "เพิ่มรายจ่าย";
    document.querySelector("[data-submit-label]").textContent = "บันทึก";
    if (dateInput) dateInput.value = selectedMonthDate(new Date().getDate());
  }

  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  form?.elements.title.focus();
}

function closeModal() {
  const modal = document.querySelector("[data-entry-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

function openActions() {
  const modal = document.querySelector("[data-action-modal]");
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
}

function closeActions() {
  const modal = document.querySelector("[data-action-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

function openBudget() {
  const modal = document.querySelector("[data-budget-modal]");
  const form = document.querySelector("[data-budget-form]");
  if (form) {
    form.elements.total.value = state.budget.total || "";
    Object.keys(categories).forEach((key) => {
      if (form.elements[key]) form.elements[key].value = state.budget.categories?.[key] || "";
    });
  }
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  form?.elements.total.focus();
}

function closeBudget() {
  const modal = document.querySelector("[data-budget-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

function openRecurring() {
  const modal = document.querySelector("[data-recurring-modal]");
  const form = document.querySelector("[data-recurring-form]");
  form?.reset();
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  form?.elements.title.focus();
}

function closeRecurring() {
  const modal = document.querySelector("[data-recurring-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

function openAlerts() {
  renderAlerts();
  const modal = document.querySelector("[data-alert-modal]");
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
}

function closeAlerts() {
  const modal = document.querySelector("[data-alert-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

function openSync() {
  const modal = document.querySelector("[data-sync-modal]");
  const form = document.querySelector("[data-sync-form]");
  if (form) form.elements.endpoint.value = state.syncEndpoint || "";
  setSyncStatus(state.syncEndpoint ? "พร้อมซิงก์กับ Google Sheets" : "ยังไม่ได้เชื่อม Google Sheets", state.syncEndpoint ? "good" : "");
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  form?.elements.endpoint.focus();
}

function closeSync() {
  const modal = document.querySelector("[data-sync-modal]");
  modal?.classList.remove("open");
  modal?.setAttribute("aria-hidden", "true");
}

function closePanels() {
  closeModal();
  closeActions();
  closeBudget();
  closeRecurring();
  closeAlerts();
  closeSync();
}

function exportCsv() {
  const rows = filteredExpenses();
  const header = ["date", "title", "category", "amount"];
  const csvRows = rows.map((item) => [
    item.date,
    item.title,
    categories[item.category]?.label || "อื่นๆ",
    item.amount,
  ]);
  const csv = [header, ...csvRows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `porsche-expenses-${state.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  closeActions();
}

function clearAllData() {
  const confirmed = window.confirm("ต้องการล้างข้อมูลทั้งหมดใช่ไหม? รายจ่าย งบประมาณ และรายจ่ายประจำจะถูกลบออกจากเครื่องนี้");
  if (!confirmed) return;

  state.expenses = [];
  state.budget = { total: 0, categories: {} };
  state.recurring = [];
  saveLocalSnapshot();
  renderAll();
  closePanels();

  if (state.syncEndpoint) {
    syncToSheet({ silent: true });
  }
}

function setSyncStatus(message, tone = "") {
  const status = document.querySelector("[data-sync-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-good", tone === "good");
  status.classList.toggle("is-error", tone === "error");
}

function saveSyncEndpoint(value) {
  state.syncEndpoint = value.trim();
  if (state.syncEndpoint) {
    localStorage.setItem(syncEndpointStorageKey, state.syncEndpoint);
  } else {
    localStorage.removeItem(syncEndpointStorageKey);
  }
}

function syncPayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    expenses: state.expenses,
    budget: state.budget,
    recurring: state.recurring,
  };
}

function normalizeRemoteData(payload) {
  const data = payload?.data || payload || {};
  return {
    expenses: (Array.isArray(data.expenses) ? data.expenses : []).map((item) => ({
      ...item,
      date: toISODate(item.date),
    })),
    budget: data.budget && typeof data.budget === "object" ? data.budget : clone(defaultBudget),
    recurring: Array.isArray(data.recurring) ? data.recurring : [],
    updatedAt: data.updatedAt || payload?.updatedAt || "",
  };
}

function endpointWithParams(endpoint, params) {
  const joiner = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${joiner}${new URLSearchParams(params).toString()}`;
}

function requestSheetAction(endpoint, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `porscheSheetSync${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("เชื่อมต่อ Google Sheets ช้าเกินไป"));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      if (payload?.ok === false) {
        reject(new Error(payload.error || "ซิงก์ข้อมูลไม่สำเร็จ"));
        return;
      }
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("เชื่อมต่อ Apps Script ไม่ได้"));
    };
    script.src = endpointWithParams(endpoint, { ...params, callback: callbackName, t: Date.now() });
    document.body.appendChild(script);
  });
}

async function loadFromSheet(endpoint) {
  const payload = await requestSheetAction(endpoint, { action: "loadAll" });
  return normalizeRemoteData(payload);
}

async function syncFromSheet() {
  if (!state.syncEndpoint) {
    openSync();
    setSyncStatus("ใส่ลิงก์ Web App ก่อนโหลดข้อมูล", "error");
    return;
  }

  setSyncStatus("กำลังโหลดข้อมูลจาก Google Sheets...");
  try {
    const data = await loadFromSheet(state.syncEndpoint);
    // โหลดสำเร็จ → ใช้ข้อมูลจากชีตเป็นหลักเสมอ (แม้ว่างเปล่า) เพื่อให้การลบ/ล้างซิงก์ข้ามเครื่องได้
    state.expenses = Array.isArray(data.expenses) ? data.expenses : state.expenses;
    state.budget = data.budget || state.budget;
    state.recurring = Array.isArray(data.recurring) ? data.recurring : state.recurring;
    const newest = state.expenses.map((item) => item.date).sort().at(-1);
    if (newest) state.month = monthOf(newest);
    saveLocalSnapshot();
    renderAll();
    setSyncStatus(`โหลดข้อมูลสำเร็จ${data.updatedAt ? ` (${new Date(data.updatedAt).toLocaleString("th-TH")})` : ""}`, "good");
  } catch (error) {
    setSyncStatus(error.message || "โหลดข้อมูลไม่สำเร็จ", "error");
  }
}

async function syncToSheet({ silent = false } = {}) {
  if (!state.syncEndpoint) return;
  if (!silent) setSyncStatus("กำลังบันทึกขึ้น Google Sheets...");

  try {
    const response = await fetch(state.syncEndpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "saveAll", data: syncPayload() }),
    });
    const payload = await response.json();
    if (payload?.ok === false) {
      throw new Error(payload.error || "บันทึกขึ้น Google Sheets ไม่สำเร็จ");
    }
    if (!silent) {
      const updatedAt = payload?.updatedAt ? ` (${new Date(payload.updatedAt).toLocaleString("th-TH")})` : "";
      setSyncStatus(`ส่งข้อมูลไป Google Sheets แล้ว${updatedAt}`, "good");
    }
  } catch (error) {
    if (!silent) setSyncStatus(error.message || "บันทึกขึ้น Google Sheets ไม่สำเร็จ", "error");
  }
}

let autoSyncTimer = null;
let initialSyncDone = false;

function queueAutoSync() {
  if (!state?.syncEndpoint) return;
  // กันข้อมูลหาย: ยังไม่ให้ส่งขึ้นชีตอัตโนมัติ จนกว่าจะโหลดข้อมูลล่าสุดจากชีตเสร็จก่อน
  if (!initialSyncDone) return;
  window.clearTimeout(autoSyncTimer);
  autoSyncTimer = window.setTimeout(() => {
    syncToSheet({ silent: true });
  }, 900);
}

document.querySelectorAll(".add-expense-button, .add-expense-link").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });
});

document.querySelectorAll("[data-nav]").forEach((nav) => {
  nav.addEventListener("click", (event) => {
    event.preventDefault();
    setView(nav.dataset.nav);
    closeActions();
  });
});

document.querySelectorAll("[data-open-analysis]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView("analysis");
  });
});

document.querySelectorAll("[data-open-records]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setView("records");
  });
});

document.querySelectorAll("[data-open-actions]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openActions();
  });
});

document.querySelectorAll("[data-open-budget]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    closeActions();
    openBudget();
  });
});

document.querySelectorAll("[data-open-recurring]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    closeActions();
    openRecurring();
  });
});

document.querySelectorAll("[data-open-alerts]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    openAlerts();
  });
});

document.querySelectorAll("[data-open-sync]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    closeActions();
    openSync();
  });
});

document.querySelectorAll("[data-open-month]").forEach((button) => {
  button.addEventListener("click", () => setView("records"));
});

document.querySelectorAll("[data-month-filter]").forEach((input) => {
  input.value = state.month;
  input.addEventListener("change", () => {
    state.month = input.value || state.month;
    renderAll();
  });
});

document.querySelector("[data-category-filter]")?.addEventListener("change", (event) => {
  state.categoryFilter = event.target.value;
  renderTransactions();
});

document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => {
    state.period = button.dataset.period;
    document.querySelectorAll("[data-period]").forEach((item) => {
      item.classList.toggle("selected", item === button);
    });
    renderAll();
  });
});

document.querySelectorAll(".close-modal").forEach((button) => {
  button.addEventListener("click", () => {
    closePanels();
  });
});

document.querySelector("[data-entry-modal]")?.addEventListener("click", (event) => {
  if (event.target.matches("[data-entry-modal]")) closeModal();
});

document.querySelector("[data-action-modal]")?.addEventListener("click", (event) => {
  if (event.target.matches("[data-action-modal]")) closeActions();
});

document.querySelector("[data-budget-modal]")?.addEventListener("click", (event) => {
  if (event.target.matches("[data-budget-modal]")) closeBudget();
});

document.querySelector("[data-recurring-modal]")?.addEventListener("click", (event) => {
  if (event.target.matches("[data-recurring-modal]")) closeRecurring();
});

document.querySelector("[data-alert-modal]")?.addEventListener("click", (event) => {
  if (event.target.matches("[data-alert-modal]")) closeAlerts();
});

document.querySelector("[data-sync-modal]")?.addEventListener("click", (event) => {
  if (event.target.matches("[data-sync-modal]")) closeSync();
});

document.querySelector("[data-expense-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = data.get("id");
  const payload = {
    id: id ? Number(id) : Date.now(),
    title: data.get("title").toString().trim(),
    category: data.get("category"),
    amount: Number(data.get("amount")),
    date: data.get("date"),
  };

  if (id) {
    state.expenses = state.expenses.map((item) => (String(item.id) === String(id) ? payload : item));
  } else {
    state.expenses = [payload, ...state.expenses];
    state.month = monthOf(payload.date);
  }

  saveExpenses();
  closeModal();
  renderAll();
});

document.querySelector("[data-budget-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  state.budget = {
    total: Number(form.elements.total.value || 0),
    categories: {
      food: Number(form.elements.food.value || 0),
      travel: Number(form.elements.travel.value || 0),
      child: Number(form.elements.child.value || 0),
      home: Number(form.elements.home.value || 0),
    },
  };
  saveBudget();
  closeBudget();
  renderAll();
});

document.querySelector("[data-recurring-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  state.recurring = [
    ...state.recurring,
    {
      id: Date.now(),
      title: data.get("title").toString().trim(),
      category: data.get("category"),
      amount: Number(data.get("amount")),
      day: Number(data.get("day")),
    },
  ];
  saveRecurring();
  closeRecurring();
  setView("records");
  renderAll();
});

document.querySelector("[data-sync-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const endpoint = event.currentTarget.elements.endpoint.value;
  saveSyncEndpoint(endpoint);
  setSyncStatus(
    state.syncEndpoint ? "บันทึกลิงก์แล้ว กด “บันทึกขึ้นชีต” เพื่อส่งข้อมูลชุดแรก" : "ลบลิงก์ Google Sheets แล้ว",
    "good",
  );
});

document.querySelector("[data-sync-download]")?.addEventListener("click", () => {
  const form = document.querySelector("[data-sync-form]");
  if (form) saveSyncEndpoint(form.elements.endpoint.value);
  syncFromSheet();
});

document.querySelector("[data-sync-upload]")?.addEventListener("click", () => {
  const form = document.querySelector("[data-sync-form]");
  if (form) saveSyncEndpoint(form.elements.endpoint.value);
  if (!state.syncEndpoint) {
    setSyncStatus("ใส่ลิงก์ Web App ก่อนบันทึกขึ้นชีต", "error");
    return;
  }
  syncToSheet();
});

document.querySelectorAll("[data-clear-data]").forEach((button) => {
  button.addEventListener("click", clearAllData);
});

document.querySelectorAll("[data-export-csv]").forEach((button) => {
  button.addEventListener("click", exportCsv);
});

document.querySelectorAll("[data-close-panels]").forEach((button) => {
  button.addEventListener("click", closePanels);
});

document.body.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    state.expenses = state.expenses.filter((item) => String(item.id) !== deleteButton.dataset.deleteId);
    saveExpenses();
    renderAll();
    return;
  }

  const editButton = event.target.closest("[data-edit-id]");
  if (editButton) {
    const item = state.expenses.find((expense) => String(expense.id) === editButton.dataset.editId);
    if (item) openModal(item);
    return;
  }

  const postButton = event.target.closest("[data-post-recurring]");
  if (postButton) {
    const item = state.recurring.find((bill) => String(bill.id) === postButton.dataset.postRecurring);
    if (!item || recurringPosted(item)) return;
    state.expenses = [
      {
        id: Date.now(),
        recurringId: item.id,
        title: item.title,
        category: item.category,
        amount: Number(item.amount),
        date: selectedMonthDate(item.day),
      },
      ...state.expenses,
    ];
    saveExpenses();
    renderAll();
    return;
  }

  const recurringDeleteButton = event.target.closest("[data-delete-recurring]");
  if (recurringDeleteButton) {
    state.recurring = state.recurring.filter((item) => String(item.id) !== recurringDeleteButton.dataset.deleteRecurring);
    saveRecurring();
    renderAll();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePanels();
  }
});

document.querySelectorAll(".chart-label").forEach((label) => {
  const text = label.textContent;
  const match = Object.entries(categories).find(([, category]) => text.includes(category.label));
  if (match) label.dataset.category = match[0];
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js?v=25").catch(() => {});
}

setView(location.hash.replace("#", "") || "home");
renderAll();

// ซิงก์สองทาง: โหลดข้อมูลล่าสุดจาก Google Sheet อัตโนมัติทุกครั้งที่เปิดแอป (ถ้าตั้งลิงก์ไว้แล้ว)
// เปิด auto-save หลังโหลดเสร็จเท่านั้น เพื่อกันข้อมูลเก่าในเครื่องเขียนทับชีต
if (state.syncEndpoint) {
  Promise.resolve(syncFromSheet()).finally(() => {
    initialSyncDone = true;
  });
} else {
  initialSyncDone = true;
}

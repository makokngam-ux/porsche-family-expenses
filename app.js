const storageKey = "porsche-family-expenses";
const budgetStorageKey = "porsche-family-budget";
const recurringStorageKey = "porsche-family-recurring";
const syncEndpointStorageKey = "porsche-family-sheet-endpoint";
const syncKeyStorageKey = "porsche-family-sheet-key";
const pendingStorageKey = "porsche-family-pending";
const migrationStorageKey = "porsche-family-migrated";
const queueReadyStorageKey = "porsche-family-queue-ready";
const oldSyncBaseStorageKey = "porsche-family-sync-base"; // ของแอป v45: สำเนาข้อมูลชีตล่าสุดที่เครื่องนี้เคยโหลด
// ลิงก์ Google Apps Script Web App เริ่มต้น (ฝังไว้ให้ทุกเครื่องใช้ได้เลย ไม่ต้องกรอกเอง)
const DEFAULT_SYNC_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbyMfOvzJL56lBaO1qzLNGRgjPyN4O2ZqwkQt9eMGRISj_6nm35mklvDeLUQStwvF5OBQw/exec";

// วันผ่อนครบของรายการผ่อน (id ของรายจ่ายประจำ → เดือนที่ผ่อนครบ YYYY-MM) หลังจากนี้จะหยุดเตือน
const INSTALLMENT_END = {
  201: "2028-01", // ค่างวดรถยนต์ ผ่อนครบ ม.ค. 2571
  202: "2026-07", // ผ่อน iPhone ผ่อนครบ ก.ค. 2569
};

// รายจ่ายประจำปี (เตือนปีละครั้งตามวันครบกำหนด)
const YEARLY_BILLS = [
  { id: 301, title: "ประกันรถยนต์", category: "car", amount: 18000, month: 2, day: 21 },
  { id: 302, title: "ภาษีรถยนต์", category: "car", amount: 1650, month: 2, day: 21 },
  { id: 303, title: "ค่าเทอม น้องพอร์ช (เทอม 1)", category: "education", amount: 50000, month: 3, day: 1 },
  { id: 304, title: "ค่าเทอม น้องพอร์ช (เทอม 2)", category: "education", amount: 50000, month: 10, day: 1 },
  { id: 305, title: "Canva", category: "subscription", amount: 1850, month: 1, day: 1 },
];

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

// กันโค้ด HTML ที่ปนมากับชื่อรายการ (จากช่องกรอกหรือจาก Google Sheet) ไม่ให้ทำงานในหน้าแอป
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

// รหัสรายการ: เวลา (มิลลิวินาที) + เลขสุ่ม 3 หลัก กันชนกันเมื่อสองเครื่องบันทึกพร้อมกัน
function newId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

// รหัสตายตัว (เป็นตัวเลขเสมอ เพราะคอลัมน์ id ในชีตเป็นชนิดตัวเลข) ของ "บิลประจำ + งวด"
// สองเครื่องที่กดบันทึกบิลเดียวกันงวดเดียวกันจะได้รหัสเดียวกัน จึงเป็นรายการเดียว ไม่ซ้ำ
function billPostId(billId, period) {
  const text = `${billId}|${period}`;
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b + text.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return 4000000000000000 + (a % 1000000) * 1000000000 + (b % 1000000000); // 16 หลัก ขึ้นต้นด้วย 4
}

function sameId(a, b) {
  return a !== "" && a !== null && a !== undefined && String(a) === String(b);
}

function isValidDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  period: "all",
  view: "home",
};

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function validRecords(list) {
  return list.filter((item) => item && typeof item === "object" && item.id !== undefined && item.id !== null && item.id !== "");
}

function loadExpenses() {
  const saved = readStored(storageKey);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? validRecords(parsed) : [];
  } catch {
    return [];
  }
}

function loadBudget() {
  const saved = readStored(budgetStorageKey);
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
  const saved = readStored(recurringStorageKey);
  const fallback = clone(defaultRecurring);
  if (!saved) return fallback;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? validRecords(parsed) : fallback;
  } catch {
    return fallback;
  }
}

// รับเฉพาะลิงก์ Web App ของ Google Apps Script เท่านั้น — ลิงก์อื่นจะได้ทั้งข้อมูลครอบครัวและสิทธิ์รันโค้ดในหน้าแอป
// (localhost อนุญาตไว้สำหรับทดสอบในเครื่องตัวเอง)
function isAllowedEndpoint(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol === "https:" && url.hostname === "script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)) return true;
    return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

function loadSyncEndpoint() {
  const saved = readStored(syncEndpointStorageKey);
  return saved && isAllowedEndpoint(saved) ? saved : DEFAULT_SYNC_ENDPOINT;
}

// ===== คิวรายการที่ยังไม่ได้ส่งขึ้น Google Sheets =====
// ทุกการเพิ่ม/แก้/ลบ จะถูกจดไว้ที่นี่ (และใน localStorage) จนกว่าชีตจะยืนยันว่ารับแล้ว
// ข้อมูลที่โหลดมาจากชีตจะถูก "รวม" กับคิวนี้เสมอ ไม่ทับรายการที่ยังส่งไม่สำเร็จ
function emptyPending() {
  return {
    expenses: { upserts: {}, deletes: [] },
    recurring: { upserts: {}, deletes: [] },
    budget: null,
  };
}

function loadPending() {
  const base = emptyPending();
  try {
    const parsed = JSON.parse(readStored(pendingStorageKey) || "null");
    if (!parsed || typeof parsed !== "object") return base;
    ["expenses", "recurring"].forEach((kind) => {
      const group = parsed[kind] || {};
      if (group.upserts && typeof group.upserts === "object") base[kind].upserts = group.upserts;
      if (Array.isArray(group.deletes)) base[kind].deletes = group.deletes.map(String);
    });
    if (parsed.budget && typeof parsed.budget === "object") base.budget = parsed.budget;
  } catch {
    // คิวอ่านไม่ได้ → เริ่มคิวว่าง
  }
  return base;
}

let pending = loadPending();
let storageFailed = false;

// อัปเดตจากแอป v45: v45 ไม่มีคิว แต่จำ "ข้อมูลชีตล่าสุด" ไว้ สิ่งที่ต่างจากข้อมูลในเครื่อง = การแก้ไขที่ยังไม่ได้ส่ง
// → ย้ายส่วนต่างนั้นเข้าคิวครั้งเดียว จะได้ไม่หายตอนเปลี่ยนเวอร์ชัน
function importOldSyncBase() {
  const raw = readStored(oldSyncBaseStorageKey);
  if (!raw || readStored(queueReadyStorageKey) === "1") return;
  let base;
  try {
    base = JSON.parse(raw);
  } catch {
    return;
  }
  if (!base || !Array.isArray(base.expenses) || !Array.isArray(base.recurring)) return;
  const text = (value) => String(value ?? "");
  const shape = {
    expenses: (i) => [text(i.title), text(i.category), Number(i.amount || 0), toISODate(i.date), text(i.recurringId)].join("|"),
    recurring: (i) => [text(i.title), text(i.category), Number(i.amount || 0), Number(i.day || 1), i.freq || "monthly", Number(i.month || 0), text(i.end)].join("|"),
  };
  const budgetShape = (b) => JSON.stringify([Number(b?.total || 0), Object.entries(b?.categories || {}).map(([k, v]) => [k, Number(v || 0)]).sort()]);
  queueChange(() => {
    ["expenses", "recurring"].forEach((kind) => {
      const baseMap = new Map(validRecords(base[kind]).map((item) => [String(item.id), shape[kind](item)]));
      const localIds = new Set();
      state[kind].forEach((item) => {
        localIds.add(String(item.id));
        if (baseMap.get(String(item.id)) !== shape[kind](item) && item.title) markUpsert(kind, item);
      });
      baseMap.forEach((_, id) => {
        if (!localIds.has(id)) markDelete(kind, id);
      });
    });
    if (base.budget && budgetShape(base.budget) !== budgetShape(state.budget)) markBudget(state.budget);
  });
  writeStored(queueReadyStorageKey, "1");
  try {
    localStorage.removeItem(oldSyncBaseStorageKey);
  } catch {
    // ลบไม่ได้ก็ไม่เป็นไร เครื่องหมายด้านบนกันทำซ้ำแล้ว
  }
}

function savePending() {
  if (!writeStored(pendingStorageKey, JSON.stringify(pending))) storageFailed = true;
}

function pendingCount(p = pending) {
  return (
    Object.keys(p.expenses.upserts).length +
    p.expenses.deletes.length +
    Object.keys(p.recurring.upserts).length +
    p.recurring.deletes.length +
    (p.budget ? 1 : 0)
  );
}

// ทุกการแก้คิวต้องผ่านฟังก์ชันนี้: อ่านคิวล่าสุดจากเครื่องก่อน (อีกแท็บอาจเพิ่งเขียน) → แก้ → เขียนกลับทันที
function queueChange(change) {
  pending = loadPending();
  change();
  savePending();
}

function markBudget(budget) {
  pending.budget = clone(budget);
}

function markUpsert(kind, record) {
  const key = String(record.id);
  pending[kind].upserts[key] = clone(record);
  pending[kind].deletes = pending[kind].deletes.filter((id) => id !== key);
}

function markDelete(kind, id) {
  const key = String(id);
  delete pending[kind].upserts[key];
  if (!pending[kind].deletes.includes(key)) pending[kind].deletes.push(key);
}

// นำคิวไปทับลงบนรายการชุดหนึ่ง: ลบที่สั่งลบ, แทนที่ที่แก้, เติมรายการใหม่ไว้บนสุด
function applyOpGroup(list, group) {
  const deleted = new Set(group.deletes);
  const seen = new Set();
  const result = [];
  list.forEach((item) => {
    const key = String(item.id);
    if (deleted.has(key) || seen.has(key)) return;
    seen.add(key);
    result.push(Object.hasOwn(group.upserts, key) ? clone(group.upserts[key]) : item);
  });
  const added = Object.keys(group.upserts)
    .filter((key) => !seen.has(key) && !deleted.has(key))
    .map((key) => clone(group.upserts[key]));
  return [...added.reverse(), ...result];
}

// ชีตยืนยันรับแล้ว → เอาออกจากคิว เฉพาะรายการที่ไม่ได้ถูกแก้ซ้ำระหว่างรอ
function clearSentPending(sent) {
  pending = loadPending();
  ["expenses", "recurring"].forEach((kind) => {
    Object.keys(sent[kind].upserts).forEach((key) => {
      const now = pending[kind].upserts[key];
      if (now && JSON.stringify(now) === JSON.stringify(sent[kind].upserts[key])) delete pending[kind].upserts[key];
    });
    const sentDeletes = new Set(sent[kind].deletes);
    pending[kind].deletes = pending[kind].deletes.filter((id) => !sentDeletes.has(id));
  });
  if (sent.budget && pending.budget && JSON.stringify(sent.budget) === JSON.stringify(pending.budget)) pending.budget = null;
  savePending();
}

function persistLocal() {
  // (คิวถูกเขียนไปแล้วใน queueChange ก่อนถึงตรงนี้ — ถ้าเขียนข้อมูลแสดงผลไม่สำเร็จ รายการยังอยู่ในคิวและจะถูกส่งขึ้นชีต)
  const results = [
    writeStored(storageKey, JSON.stringify(state.expenses)),
    writeStored(budgetStorageKey, JSON.stringify(state.budget)),
    writeStored(recurringStorageKey, JSON.stringify(state.recurring)),
  ];
  storageFailed = results.includes(false);
  if (storageFailed) refreshSyncBadge();
  return !storageFailed;
}

// บันทึกลงเครื่อง แล้วส่งขึ้นชีตทันที (ต้องเรียก markUpsert/markDelete ก่อน)
function commitChange() {
  persistLocal();
  scheduleSync(150);
}

function saveLocalSnapshot() {
  persistLocal();
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

// นับเฉพาะรายการที่บันทึกจริงเท่านั้น (รายจ่ายประจำต้องกด "บันทึก" ก่อนถึงจะถูกนับ)
function monthlyExpenses() {
  return realForMonth(state.month);
}

function selectedExpenses() {
  if (state.period === "all") {
    return state.expenses;
  }

  if (state.period === "year") {
    return state.expenses.filter((item) => monthOf(item.date).slice(0, 4) === state.month.slice(0, 4));
  }

  if (state.period === "day") {
    // ดูเดือนปัจจุบัน → รายจ่ายของ "วันนี้" / ดูเดือนย้อนหลัง → วันล่าสุดที่มีรายการในเดือนนั้น
    const latestDate = state.month === currentMonthKey() ? todayKey() : sortedByDate(realForMonth(state.month))[0]?.date;
    return latestDate ? state.expenses.filter((item) => item.date === latestDate) : [];
  }

  return monthlyExpenses();
}

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function monthlyBills() {
  return (state.recurring || []).filter((r) => (r.freq || "monthly") !== "yearly");
}

function yearlyBills() {
  return (state.recurring || []).filter((r) => r.freq === "yearly");
}

// ผ่อนครบหรือยัง (เลยเดือนที่ผ่อนครบ) — ใช้ฟิลด์ end (YYYY-MM) ของรายการ
function installmentEnded(item) {
  const end = item && item.end;
  if (!end) return false;
  const today = new Date();
  const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return cur > end;
}

// เหลืออีกกี่งวด (นับรวมเดือนปัจจุบันถึงเดือนผ่อนครบ)
function monthsRemaining(item) {
  const end = item && item.end;
  if (!end) return null;
  const today = new Date();
  const [ey, em] = String(end).split("-").map(Number);
  if (!ey || !em) return null;
  return Math.max(0, (ey - today.getFullYear()) * 12 + (em - (today.getMonth() + 1)) + 1);
}

// รายจ่ายประจำเดือนที่ใกล้/เลยกำหนด และยังไม่ได้บันทึกเดือนนี้ → เด้งเตือนในรายจ่ายล่าสุด (ค้างจนกว่าจะกดบันทึก)
function dueSoonRecurring() {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const last = daysInMonth(monthKey);
  const todayMid = new Date(y, m, today.getDate());
  return monthlyBills()
    .filter((r) => {
      if (installmentEnded(r)) return false;
      const day = Math.min(Number(r.day) || 1, last);
      const diff = Math.round((new Date(y, m, day) - todayMid) / 86400000);
      const postedThisMonth = state.expenses.some((e) => sameId(e.recurringId, r.id) && monthOf(e.date) === monthKey);
      return diff <= 0 && !postedThisMonth;
    })
    .sort((a, b) => (Number(a.day) || 1) - (Number(b.day) || 1));
}

function yearlyPostedThisYear(id, year) {
  return state.expenses.some((e) => sameId(e.recurringId, id) && Number(String(e.date).slice(0, 4)) === year);
}

// รายจ่ายประจำปีที่ใกล้/เลยกำหนด และยังไม่ได้บันทึกในปีนี้
function yearlyDueSoon() {
  const today = new Date();
  const y = today.getFullYear();
  const todayMid = new Date(y, today.getMonth(), today.getDate());
  return yearlyBills().filter((b) => {
    if (!b.month) return false;
    const diff = Math.round((new Date(y, b.month - 1, b.day || 1) - todayMid) / 86400000);
    return diff <= 0 && !yearlyPostedThisYear(b.id, y);
  });
}

function reminderRow(item, whenText) {
  const category = categories[item.category] || categories.other;
  return `<li class="due-reminder">
    <span class="category-icon" style="--cat-color:${category.color}; --cat-bg:${softColor(category.color)}">${iconMarkup("i-repeat")}</span>
    <b>${esc(item.title)}<small>⏰ ${whenText}</small></b>
    <strong>฿ ${money.format(item.amount)}</strong>
    <button class="small-pill" type="button" data-post-recurring="${esc(item.id)}">บันทึก</button>
  </li>`;
}

function dueReminderMarkup(item) {
  const today = new Date();
  const last = daysInMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const day = Math.min(Number(item.day) || 1, last);
  const diff = Math.round((new Date(today.getFullYear(), today.getMonth(), day) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  const when = diff > 1 ? `ครบกำหนดในอีก ${diff} วัน (วันที่ ${day})` : diff === 1 ? `ครบกำหนดพรุ่งนี้ (วันที่ ${day})` : diff === 0 ? "ครบกำหนดวันนี้" : `เลยกำหนด ${Math.abs(diff)} วัน`;
  return reminderRow(item, when);
}

function yearlyReminderMarkup(item) {
  const today = new Date();
  const diff = Math.round((new Date(today.getFullYear(), item.month - 1, item.day) - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  const dlabel = `${item.day} ${THAI_MONTHS[item.month - 1]}`;
  const when = diff > 1 ? `รายปี · อีก ${diff} วัน (${dlabel})` : diff === 1 ? `รายปี · พรุ่งนี้ (${dlabel})` : diff === 0 ? "รายปี · ครบกำหนดวันนี้" : `รายปี · เลยกำหนด ${Math.abs(diff)} วัน`;
  return reminderRow(item, when);
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
    el.textContent =
      state.period === "all" ? "ทั้งหมด (ทุกเดือน)" : formatMonth(state.month);
  });
  document.querySelectorAll("[data-month-filter]").forEach((el) => {
    el.value = state.month;
  });
}

function renderTotals() {
  // หน้าหลัก = เดือนที่เลือกเสมอ
  const monthTotal = sum(monthlyExpenses());
  document.querySelectorAll("[data-total-amount]").forEach((el) => {
    el.textContent = `฿ ${money.format(monthTotal)}`;
  });
  document.querySelectorAll("[data-total-short]").forEach((el) => {
    el.textContent = `฿ ${shortMoney.format(monthTotal)}`;
  });
  // หน้าวิเคราะห์ = ตามแท็บ (ภาพรวม=ทั้งหมด / รายเดือน / รายวัน)
  const periodTotal = sum(selectedExpenses());
  document.querySelectorAll("[data-analysis-total]").forEach((el) => {
    el.textContent = `฿ ${shortMoney.format(periodTotal)}`;
  });
}

function renderQuickCards() {
  const items = monthlyExpenses();
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
  // ===== หน้าหลัก: โดนัท + legend = เฉพาะเดือนที่เลือกเสมอ =====
  const monthItems = categoryTotals(monthlyExpenses());
  const monthTotal = sum(monthlyExpenses());
  const monthVisible = monthItems.filter((item) => item.total > 0);
  document.querySelectorAll("[data-donut]").forEach((el) => {
    el.style.background = donutGradient(monthItems, monthTotal);
  });

  const legend = document.querySelector("[data-legend-list]");
  if (legend) {
    legend.innerHTML = monthVisible.length
      ? monthVisible
          .map(
            (item) =>
              `<li class="cat-row" data-cat-jump="${item.key}" role="button" tabindex="0">${iconBadge(item.key)}<b>${item.label}</b><em>${percent(item.total, monthTotal)}%</em></li>`,
          )
          .join("")
      : `<li><span class="category-icon">${iconMarkup("i-more")}</span><b>ยังไม่มีข้อมูล</b><em>0%</em></li>`;
  }

  // ===== หน้าวิเคราะห์: โดนัทใหญ่ + รายการหมวด = ตามแท็บ (ภาพรวม=ทั้งหมด / รายเดือน / รายวัน) =====
  const items = categoryTotals(selectedExpenses());
  const total = sum(selectedExpenses());
  const visibleItems = items.filter((item) => item.total > 0);
  document.querySelectorAll("[data-big-donut]").forEach((el) => {
    el.style.background = donutGradient(items, total);
  });

  const categoryList = document.querySelector("[data-category-list]");
  if (categoryList) {
    categoryList.innerHTML = visibleItems.length
      ? visibleItems
          .sort((a, b) => b.total - a.total)
          .map(
            (item) =>
              `<li class="cat-row" data-cat-jump="${item.key}" role="button" tabindex="0">${iconBadge(item.key)}<b>${item.label}</b><em>${percent(item.total, total)}%</em><strong>฿ ${money.format(item.total)}</strong><i>›</i></li>`,
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
      span.dataset.catJump = item.key;
      span.setAttribute("role", "button");
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
      sameId(item.recurringId, recurring.id) &&
      monthOf(item.date) === state.month,
  );
}

function renderRecurring() {
  const list = document.querySelector("[data-recurring-list]");
  if (!list) return;

  const bills = monthlyBills().slice().sort((a, b) => Number(a.day) - Number(b.day));
  list.innerHTML = bills.length
    ? bills
        .map((item) => {
          const category = categories[item.category] || categories.other;
          const remain = monthsRemaining(item);
          let note = `${category.label} · ทุกวันที่ ${item.day}`;
          if (remain !== null) {
            note += installmentEnded(item)
              ? " · ผ่อนครบแล้ว ✓"
              : ` · เหลือ ${remain} งวด (คงเหลือ ฿${shortMoney.format(remain * Number(item.amount || 0))})`;
          }
          return `<li>
    <span class="category-icon" style="--cat-color:${category.color}; --cat-bg:${softColor(category.color)}">${iconMarkup("i-repeat")}</span>
            <b>${esc(item.title)}<small>${esc(note)}</small></b>
            <strong>฿ ${money.format(item.amount)}</strong>
            <button class="edit-expense" type="button" data-edit-recurring="${esc(item.id)}" aria-label="แก้ไข ${esc(item.title)}">${iconMarkup("i-edit")}</button>
            <button class="delete-expense" type="button" data-delete-recurring="${esc(item.id)}" aria-label="ลบ ${esc(item.title)}">${iconMarkup("i-trash")}</button>
          </li>`;
        })
        .join("")
    : `<li class="empty-row"><b>ยังไม่มีรายจ่ายประจำ</b></li>`;

  const monthlyTotal = monthlyBills()
    .filter((r) => !installmentEnded(r))
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  document.querySelectorAll("[data-recurring-total]").forEach((el) => {
    el.textContent = bills.length ? `รวม ฿${shortMoney.format(monthlyTotal)}/เดือน` : "";
  });
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

  // รายเดือน + รายปี: เตือนเฉพาะเมื่อถึง/เลยกำหนด และยังไม่ได้บันทึก (ค้างจนกว่าจะกดบันทึก)
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const lastDay = daysInMonth(`${ty}-${String(tm + 1).padStart(2, "0")}`);
  const todayMid = new Date(ty, tm, today.getDate());
  dueSoonRecurring().forEach((item) => {
    const day = Math.min(Number(item.day) || 1, lastDay);
    const diff = Math.round((new Date(ty, tm, day) - todayMid) / 86400000);
    alerts.push({
      title: `บิลถึงกำหนด: ${item.title}`,
      detail: diff === 0 ? "ครบกำหนดวันนี้ ยังไม่ได้บันทึก" : `เลยกำหนด ${Math.abs(diff)} วัน ยังไม่ได้บันทึก`,
      tone: "danger",
    });
  });
  yearlyDueSoon().forEach((item) => {
    const diff = Math.round((new Date(ty, item.month - 1, item.day || 1) - todayMid) / 86400000);
    alerts.push({
      title: `บิลรายปีถึงกำหนด: ${item.title}`,
      detail: diff === 0 ? "ครบกำหนดวันนี้ ยังไม่ได้บันทึก" : `เลยกำหนด ${Math.abs(diff)} วัน ยังไม่ได้บันทึก`,
      tone: "danger",
    });
  });

  if (!monthlyExpenses().some((item) => item.date === todayKey())) {
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
            `<li class="${alert.tone}"><span>${iconMarkup(alert.tone === "info" ? "i-bell" : "i-budget")}</span><b>${esc(alert.title)}<small>${esc(alert.detail)}</small></b></li>`,
        )
        .join("")
    : `<li class="info"><span>${iconMarkup("i-bell")}</span><b>ไม่มีแจ้งเตือน<small>ทุกอย่างยังอยู่ในเกณฑ์ดี</small></b></li>`;
}

function transactionMarkup(item, editable = false) {
  const category = categories[item.category] || categories.other;
  return `<li>
    ${iconBadge(item.category)}
    <b>${esc(item.title)}<small>${category.label}</small></b>
    <strong>฿ ${money.format(item.amount)}</strong>
    <em>${esc(formatDate(item.date))}</em>
    <button class="edit-expense" type="button" data-edit-id="${esc(item.id)}" aria-label="แก้ไข ${esc(item.title)}">${iconMarkup("i-edit")}</button>
    <button class="delete-expense" type="button" data-delete-id="${esc(item.id)}" aria-label="ลบ ${esc(item.title)}">${iconMarkup("i-trash")}</button>
  </li>`;
}

function sortedByDate(items) {
  return items.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
  const recent = document.querySelector("[data-transaction-list]");
  if (recent) {
    const reminders = dueSoonRecurring().map(dueReminderMarkup).join("") + yearlyDueSoon().map(yearlyReminderMarkup).join("");
    const items = sortedByDate(realMonthlyExpenses()).slice(0, 7);
    const body = items.map((item) => transactionMarkup(item)).join("");
    recent.innerHTML = reminders + body || `<li class="empty-row"><b>ยังไม่มีรายการในเดือนนี้</b></li>`;
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
      total: sum(state.expenses.filter((item) => monthOf(item.date) === key)),
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
  renderYearly();
  renderAlerts();
  renderTrend();
  renderDailyChart();
}

// กราฟแท่งรายวัน — ยอดรวมที่บันทึกจริงของแต่ละวันในเดือนที่เลือก
function renderDailyChart() {
  document.querySelectorAll("[data-daily-month]").forEach((el) => {
    el.textContent = formatMonth(state.month);
  });
  const container = document.querySelector("[data-daily-chart]");
  if (!container) return;
  const days = daysInMonth(state.month);
  const totals = [];
  for (let d = 1; d <= days; d += 1) {
    const key = `${state.month}-${String(d).padStart(2, "0")}`;
    totals.push(sum(state.expenses.filter((e) => toISODate(e.date) === key)));
  }
  const monthTotal = totals.reduce((s, t) => s + t, 0);
  document.querySelectorAll("[data-daily-total]").forEach((el) => {
    el.textContent = monthTotal ? `รวม ฿${shortMoney.format(monthTotal)}` : "";
  });

  const max = Math.max(...totals, 1);
  const W = 320;
  const H = 158;
  const top = 24;
  const bottom = 132;
  const left = 8;
  const innerW = W - left * 2;
  const slot = innerW / days;
  const barW = Math.max(2, slot - 2);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  let bars = "";
  let amts = "";
  let labels = "";
  totals.forEach((t, i) => {
    const day = i + 1;
    const x = left + i * slot;
    const cx = x + barW / 2;
    const h = (t / max) * (bottom - top);
    const y = bottom - h;
    const key = `${state.month}-${String(day).padStart(2, "0")}`;
    const isToday = key === todayKey;
    const color = t > 0 ? (isToday ? "#f85b8b" : "#ff9bb2") : "#f3dbe3";
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${color}"><title>วันที่ ${day}: ฿${money.format(t)}</title></rect>`;
    if (t > 0) {
      amts += `<text x="${cx.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="6.5" font-weight="700" fill="#d6447a">${shortMoney.format(t)}</text>`;
      labels += `<text x="${cx.toFixed(1)}" y="148" text-anchor="middle" font-size="8" font-weight="700" fill="#5b4e53">${day}</text>`;
    } else if (day === 1 || day % 5 === 0 || day === days) {
      labels += `<text x="${cx.toFixed(1)}" y="148" text-anchor="middle" font-size="7.5" fill="#bcaeb4">${day}</text>`;
    }
  });

  container.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="กราฟแท่งยอดรวมรายวัน">${bars}${amts}${labels}</svg>`;
}

function renderYearly() {
  const list = document.querySelector("[data-yearly-list]");
  if (!list) return;
  const bills = yearlyBills()
    .slice()
    .sort((a, b) => (Number(a.month) || 0) - (Number(b.month) || 0) || (Number(a.day) || 0) - (Number(b.day) || 0));
  list.innerHTML = bills.length
    ? bills
        .map((item) => {
          const category = categories[item.category] || categories.other;
          const due = item.month ? `${item.day || 1} ${THAI_MONTHS[item.month - 1]}` : "-";
          return `<li>
      <span class="category-icon" style="--cat-color:${category.color}; --cat-bg:${softColor(category.color)}">${iconMarkup("i-repeat")}</span>
      <b>${esc(item.title)}<small>${category.label} · ครบกำหนด ${esc(due)} ทุกปี</small></b>
      <strong>฿ ${money.format(item.amount)}</strong>
      <button class="edit-expense" type="button" data-edit-recurring="${esc(item.id)}" aria-label="แก้ไข ${esc(item.title)}">${iconMarkup("i-edit")}</button>
      <button class="delete-expense" type="button" data-delete-recurring="${esc(item.id)}" aria-label="ลบ ${esc(item.title)}">${iconMarkup("i-trash")}</button>
    </li>`;
        })
        .join("")
    : `<li class="empty-row"><b>ยังไม่มีรายจ่ายประจำปี</b></li>`;
  const yearlyTotal = bills.reduce((s, b) => s + Number(b.amount || 0), 0);
  document.querySelectorAll("[data-yearly-total]").forEach((el) => {
    el.textContent = bills.length ? `รวม ฿${shortMoney.format(yearlyTotal)}/ปี` : "";
  });
}

function openModal(item = null) {
  const modal = document.querySelector("[data-entry-modal]");
  const form = document.querySelector("[data-expense-form]");
  const dateInput = form?.elements.date;
  form?.reset();
  // ช่องซ่อน id ไม่ถูกล้างด้วย form.reset() — ต้องล้างเองทุกครั้ง ไม่งั้น "เพิ่มรายการ" จะไปทับรายการที่เพิ่งแก้ไข
  if (form) form.elements.id.value = "";

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
    // ดูเดือนปัจจุบันอยู่ → วันนี้ / ดูเดือนย้อนหลังอยู่ → วันเดียวกันของเดือนนั้น (ไว้กรอกย้อนหลัง)
    if (dateInput) dateInput.value = state.month === currentMonthKey() ? todayKey() : selectedMonthDate(new Date().getDate());
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

function updateRecurringFormMode() {
  const form = document.querySelector("[data-recurring-form]");
  if (!form) return;
  const freq = form.elements.freq.value;
  const monthWrap = form.querySelector("[data-recur-month-wrap]");
  const endWrap = form.querySelector("[data-recur-end-wrap]");
  if (monthWrap) monthWrap.hidden = freq !== "yearly";
  if (endWrap) endWrap.hidden = freq === "yearly";
}

function openRecurring(opts = {}) {
  const modal = document.querySelector("[data-recurring-modal]");
  const form = document.querySelector("[data-recurring-form]");
  if (!form) return;
  form.reset();
  const item = opts.item || null;
  const freq = item ? (item.freq || "monthly") : (opts.freq || "monthly");
  form.elements.editId.value = item ? item.id : "";
  form.elements.freq.value = freq;
  if (item) {
    form.elements.title.value = item.title || "";
    form.elements.category.value = item.category || "other";
    form.elements.amount.value = item.amount || "";
    form.elements.day.value = item.day || "";
    if (item.month) form.elements.month.value = item.month;
    if (item.end) form.elements.end.value = item.end;
  }
  updateRecurringFormMode();
  const titleEl = document.getElementById("recurring-title");
  if (titleEl) titleEl.textContent = item ? "แก้ไขรายการประจำ" : freq === "yearly" ? "เพิ่มรายจ่ายประจำปี" : "เพิ่มรายจ่ายประจำเดือน";
  modal?.classList.add("open");
  modal?.setAttribute("aria-hidden", "false");
  form.elements.title.focus();
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
  if (form) {
    form.elements.endpoint.value = state.syncEndpoint || "";
    if (form.elements.syncKey) form.elements.syncKey.value = loadSyncKey();
  }
  // คงข้อความผิดพลาดล่าสุดไว้ให้เห็น ไม่รีเซ็ตเป็น "พร้อมซิงก์" ทับ
  if (!state.syncEndpoint) setSyncStatus("ยังไม่ได้เชื่อม Google Sheets");
  else if (lastSyncError) setSyncStatus(lastSyncError, "error");
  else if (pendingCount()) setSyncStatus(`มี ${pendingCount()} รายการรอส่งขึ้น Google Sheets`, "error");
  else setSyncStatus("ข้อมูลตรงกับ Google Sheets แล้ว", "good");
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

// ข้อความที่ขึ้นต้นด้วย = + - @ จะถูกโปรแกรมตารางตีเป็นสูตร → เติม ' นำหน้าให้เป็นข้อความ (ตัวเลขไม่แตะ)
function csvCell(cell) {
  let text = String(cell ?? "");
  if (typeof cell !== "number" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// all = true → สำรองรายจ่ายทุกเดือนทุกหมวด / false → เฉพาะเดือนและหมวดที่กรองอยู่
function exportCsv({ all = false } = {}) {
  const rows = sortedByDate(all ? state.expenses : filteredExpenses());
  const header = ["date", "title", "category", "amount"];
  const csvRows = rows.map((item) => [
    item.date,
    item.title,
    categories[item.category]?.label || "อื่นๆ",
    Number(item.amount || 0),
  ]);
  const csv = [header, ...csvRows].map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = all ? `porsche-expenses-all-${todayKey()}.csv` : `porsche-expenses-${state.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  closeActions();
}

async function clearAllData() {
  const count = state.expenses.length;
  const confirmed = window.confirm(
    `ต้องการล้างข้อมูลทั้งหมดใช่ไหม?\n\nรายจ่าย ${count} รายการ งบประมาณ และรายจ่ายประจำ จะถูกลบจาก "ทุกเครื่อง" และใน Google Sheets ด้วย ไม่ใช่แค่เครื่องนี้`,
  );
  if (!confirmed) return;
  if (count > 0 && !window.confirm(`ยืนยันอีกครั้ง: ลบรายจ่ายทั้ง ${count} รายการถาวร?`)) return;

  // โหลดข้อมูลล่าสุดก่อน เพื่อให้ลบครบถึงรายการที่เครื่องอื่นเพิ่งเพิ่ม (ถ้าโหลดไม่ได้ จะลบเท่าที่เครื่องนี้เห็น)
  if (state.syncEndpoint) await runSync();

  queueChange(() => {
    state.expenses.forEach((item) => markDelete("expenses", item.id));
    state.recurring.forEach((item) => markDelete("recurring", item.id));
    markBudget({ total: 0, categories: {} });
  });
  state.expenses = [];
  state.recurring = [];
  state.budget = { total: 0, categories: {} };
  remoteHold = null;
  // ไม่ต้องเติมรายจ่ายประจำปีตั้งต้นกลับมาอีก
  writeStored(migrationStorageKey, "1");
  commitChange();
  renderAll();
  closePanels();
}

function setSyncStatus(message, tone = "") {
  const status = document.querySelector("[data-sync-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-good", tone === "good");
  status.classList.toggle("is-error", tone === "error");
}

// ป้ายสถานะซิงก์ที่มุมจอ: บอกให้รู้ว่ารายการขึ้นชีตแล้วหรือยัง (แตะเพื่อลองส่งใหม่)
let syncBadgeTimer = null;
function showSyncBadge(message, tone = "", { autoHide = 0 } = {}) {
  let badge = document.querySelector("[data-sync-badge]");
  if (!badge) {
    badge = document.createElement("button");
    badge.type = "button";
    badge.className = "sync-badge";
    badge.dataset.syncBadge = "";
    badge.addEventListener("click", () => (remoteHold ? resolveRemoteHold() : runSync({ manual: true })));
    document.body.appendChild(badge);
  }
  window.clearTimeout(syncBadgeTimer);
  badge.textContent = message;
  badge.dataset.tone = tone;
  badge.hidden = !message;
  if (autoHide) {
    syncBadgeTimer = window.setTimeout(() => {
      badge.hidden = true;
    }, autoHide);
  }
}

function refreshSyncBadge() {
  if (!state.syncEndpoint) {
    showSyncBadge("");
    return;
  }
  const count = pendingCount();
  if (storageFailed) {
    showSyncBadge("พื้นที่เก็บข้อมูลในเครื่องเต็ม — อย่าปิดแอปจนกว่ารายการจะขึ้นชีต", "error");
    return;
  }
  if (remoteHold) {
    showSyncBadge(`Google Sheets ไม่มีรายการของเครื่องนี้ ${remoteHold.localCount} รายการ · แตะเพื่อเลือก`, "error");
    return;
  }
  if (syncing) {
    if (count) showSyncBadge(`กำลังส่งขึ้นชีต ${count} รายการ…`, "busy");
    return;
  }
  if (count) {
    showSyncBadge(`ยังไม่ได้ส่งขึ้นชีต ${count} รายการ · แตะเพื่อลองใหม่`, "error");
  } else if (lastSyncError) {
    showSyncBadge("โหลดข้อมูลล่าสุดจากชีตไม่ได้ · แตะเพื่อลองใหม่", "error");
  } else if (justPushed) {
    justPushed = false;
    showSyncBadge("บันทึกขึ้นชีตแล้ว ✓", "good", { autoHide: 2500 });
  } else {
    showSyncBadge("");
  }
}

function loadSyncKey() {
  return readStored(syncKeyStorageKey) || "";
}

function saveSyncKey(value) {
  const key = String(value || "").trim();
  try {
    if (key) localStorage.setItem(syncKeyStorageKey, key);
    else localStorage.removeItem(syncKeyStorageKey);
  } catch {
    // เก็บรหัสไม่ได้ก็ยังใช้ต่อในรอบนี้ได้
  }
}

function saveSyncEndpoint(value) {
  const next = value.trim();
  if (next && !isAllowedEndpoint(next)) return false;
  if (next !== state.syncEndpoint) backendMode = "unknown";
  state.syncEndpoint = next;
  try {
    if (state.syncEndpoint) localStorage.setItem(syncEndpointStorageKey, state.syncEndpoint);
    else localStorage.removeItem(syncEndpointStorageKey);
  } catch {
    // ใช้ค่าในหน่วยความจำต่อ
  }
  return true;
}

function normalizeRemoteData(payload) {
  const data = payload?.data;
  // ต้องเป็นคำตอบที่ครบจริงเท่านั้น — คำตอบว่าง/ผิดรูปแบบ ห้ามตีความว่าเป็น "ไม่มีข้อมูล"
  if (payload?.ok !== true || !data || !Array.isArray(data.expenses) || !Array.isArray(data.recurring)) {
    throw new Error("ข้อมูลจาก Google Sheets ไม่ครบ ยังไม่เปลี่ยนข้อมูลในเครื่อง");
  }
  return {
    expenses: validRecords(data.expenses).map((item) => ({ ...item, date: toISODate(item.date) })),
    budget: data.budget && typeof data.budget === "object" ? data.budget : clone(defaultBudget),
    recurring: validRecords(data.recurring),
    updatedAt: data.updatedAt || payload?.updatedAt || "",
  };
}

function syncErrorMessage(error) {
  const message = String(error?.message || error || "");
  if (message === "unauthorized") return "รหัสผ่านซิงก์ไม่ถูกต้อง — เปิด “ซิงก์ Google Sheets” แล้วใส่รหัสให้ตรงกับที่ตั้งไว้";
  if (error?.name === "AbortError") return "Google Sheets ตอบช้าเกินไป";
  if (error instanceof TypeError) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้";
  return message || "ซิงก์ข้อมูลไม่สำเร็จ";
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
    }, 35000);

    function cleanup() {
      window.clearTimeout(timer);
      // ปล่อยฟังก์ชันเปล่าไว้ เผื่อคำตอบมาถึงหลังหมดเวลา จะได้ไม่เกิด error
      window[callbackName] = () => {
        delete window[callbackName];
      };
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      delete window[callbackName];
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
  const params = { action: "loadAll" };
  const key = loadSyncKey();
  if (key) params.key = key;
  return normalizeRemoteData(await requestSheetAction(endpoint, params));
}

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

// สคริปต์เวอร์ชันเก่าอ่านชีตได้ระหว่างที่อีกเครื่องกำลังเขียน (ได้ข้อมูลว่างชั่วขณะ)
// ถ้าชีตว่างทั้งที่ในเครื่องมีรายการ ให้รออีกนิดแล้วอ่านซ้ำเพื่อยืนยัน
async function loadVerified(endpoint) {
  let remote = await loadFromSheet(endpoint);
  if (backendMode !== "ops" && remote.expenses.length === 0 && state.expenses.length > 0) {
    await wait(2500);
    remote = await loadFromSheet(endpoint);
  }
  return remote;
}

async function postToSheet(endpoint, body, { keepalive = false } = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 30000);
  try {
    const text = JSON.stringify({ ...body, key: loadSyncKey() || undefined });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: text,
      signal: controller.signal,
      // keepalive ให้คำขอไปต่อได้แม้ผู้ใช้สลับแอป/ปิดจอ (เบราว์เซอร์จำกัดขนาดไว้ราว 64KB)
      keepalive: keepalive && new Blob([text]).size < 60000,
    });
    if (!response.ok) throw new Error(`Google Sheets ตอบกลับผิดปกติ (${response.status})`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

// รูปแบบเดียวกับที่แอป v45 และสคริปต์ชีตใช้อยู่: รายการคำสั่งเรียงกัน
function opsPayload(sent) {
  const ops = [
    ...sent.expenses.deletes.map((id) => ({ type: "deleteExpense", id })),
    ...Object.values(sent.expenses.upserts).map((item) => ({ type: "upsertExpense", item })),
    ...sent.recurring.deletes.map((id) => ({ type: "deleteRecurring", id })),
    ...Object.values(sent.recurring.upserts).map((item) => ({ type: "upsertRecurring", item })),
  ];
  if (sent.budget) ops.push({ type: "setBudget", budget: sent.budget });
  return ops;
}

// "unknown" = ยังไม่รู้ว่าสคริปต์เป็นเวอร์ชันไหน, "ops" = เวอร์ชันใหม่ (รวมทีละรายการฝั่งชีต), "legacy" = เวอร์ชันเก่า
let backendMode = "unknown";

// ส่งรายการในคิวขึ้นชีต แล้วคืนข้อมูลล่าสุดของชีตหลังรวมแล้ว
async function pushPending(endpoint, sent) {
  // ลองแบบใหม่ก่อนทุกครั้ง (ไม่จำว่าเป็นสคริปต์เก่า) — พออัปเดตสคริปต์เมื่อไร แอปจะใช้แบบใหม่ทันทีโดยไม่ต้องเปิดใหม่
  const first = await postToSheet(endpoint, { action: "applyOps", ops: opsPayload(sent) }, { keepalive: true });
  if (first?.ok === true) {
    backendMode = "ops";
    return normalizeRemoteData(first);
  }
  if (first?.error !== "Unknown action") throw new Error(first?.error || "บันทึกขึ้น Google Sheets ไม่สำเร็จ");
  backendMode = "legacy";

  // สคริปต์เวอร์ชันเก่า: โหลดข้อมูลล่าสุดก่อน → รวมกับคิว → ค่อยส่งกลับทั้งชุด (ไม่ส่งข้อมูลเก่าในเครื่องขึ้นไปทับ)
  const remote = await loadVerified(endpoint);
  const merged = {
    expenses: applyOpGroup(remote.expenses, sent.expenses),
    recurring: applyOpGroup(remote.recurring, sent.recurring),
    budget: sent.budget || remote.budget,
  };
  const reply = await postToSheet(endpoint, {
    action: "saveAll",
    data: { version: 1, updatedAt: new Date().toISOString(), ...merged },
  });
  if (reply?.ok !== true) throw new Error(reply?.error || "บันทึกขึ้น Google Sheets ไม่สำเร็จ");
  return { ...merged, updatedAt: reply.updatedAt || "" };
}

// รับข้อมูลจากชีตมาเป็นหลัก แล้วทับด้วยคิวที่ยังไม่ได้ส่ง (รายการที่เพิ่งกรอกระหว่างรอจะไม่หาย)
// ครั้งแรกหลังอัปเดตเป็นระบบคิว: รายการในเครื่องที่จดไว้ไม่เกิน 7 วันและยังไม่อยู่ในชีต
// (ค้างจากเวอร์ชันเก่าที่ส่งไม่สำเร็จ) ให้ถือว่ารอส่ง แทนที่จะปล่อยให้ข้อมูลจากชีตทับทิ้ง
function rescueUnsyncedOnce(remote) {
  if (readStored(queueReadyStorageKey) === "1") return;
  const remoteIds = new Set(remote.expenses.map((item) => String(item.id)));
  const cutoff = Date.now() - 7 * 86400000;
  queueChange(() => {
    state.expenses.forEach((item) => {
      const created = Number(item.id); // รหัสของเวอร์ชันเก่าคือเวลาที่สร้าง (มิลลิวินาที)
      if (!remoteIds.has(String(item.id)) && created >= cutoff && created <= Date.now() && item.title && isValidDate(item.date)) {
        markUpsert("expenses", item);
      }
    });
  });
  // ทำเครื่องหมายว่าเสร็จ "หลัง" คิวถูกเขียนลงเครื่องแล้วเท่านั้น
  writeStored(queueReadyStorageKey, "1");
}

// รายการส่วนใหญ่ของเครื่องนี้หายไปจากชีตพร้อมกัน (เช่น ชีตถูกล้าง ถูกสลับไฟล์ หรือเพิ่งเชื่อมชีตใหม่)
// → ยังไม่ทับข้อมูลในเครื่อง ให้ผู้ใช้เลือกเองว่าจะส่งขึ้นไป หรือจะลบในเครื่องตามชีต
let remoteHold = null;
function looksWiped(remote, sent = pending) {
  // ไม่นับรายการที่ยังอยู่ในคิวหรือเพิ่งส่งไปในรอบนี้ (ชีตย่อมยังไม่มี หรือเพิ่งมีเพราะเราส่งเอง)
  const queued = { ...sent.expenses.upserts, ...pending.expenses.upserts };
  const settled = state.expenses.filter((item) => !Object.hasOwn(queued, String(item.id)));
  const remoteIds = new Set(remote.expenses.map((item) => String(item.id)));
  const missing = settled.filter((item) => !remoteIds.has(String(item.id))).length;
  // หายพร้อมกันตั้งแต่ 5 รายการและเกินครึ่งของที่เครื่องนี้มี = ผิดปกติ (การลบทีละรายการตามปกติไม่เข้าเงื่อนไขนี้)
  return missing >= 5 && missing > settled.length / 2 ? missing : 0;
}

function resolveRemoteHold() {
  const hold = remoteHold;
  if (!hold) return;
  const sendUp = window.confirm(
    `Google Sheets ไม่มีรายจ่าย ${hold.localCount} รายการที่อยู่ในเครื่องนี้\n\nกด "ตกลง" = ส่งรายการในเครื่องนี้ขึ้น Google Sheets\nกด "ยกเลิก" = ไปขั้นถัดไป (ลบในเครื่องตามชีต)`,
  );
  if (sendUp) {
    queueChange(() => {
      state.expenses.filter((item) => item.title && isValidDate(item.date)).forEach((item) => markUpsert("expenses", item));
      state.recurring.filter((item) => item.title).forEach((item) => markUpsert("recurring", item));
      markBudget(state.budget);
    });
    remoteHold = null;
    runSync({ manual: true });
    return;
  }
  if (!window.confirm(`ลบรายจ่าย ${hold.localCount} รายการออกจากเครื่องนี้ ให้ตรงกับ Google Sheets ใช่ไหม? (กู้คืนไม่ได้)`)) return;
  remoteHold = null;
  adoptRemote(hold.remote, { force: true });
  refreshSyncBadge();
}

function adoptRemote(remote, { force = false, sent } = {}) {
  if (!force) {
    const localCount = looksWiped(remote, sent);
    if (localCount) {
      remoteHold = { remote, localCount };
      return;
    }
    remoteHold = null;
  }
  rescueUnsyncedOnce(remote);
  state.expenses = applyOpGroup(remote.expenses, pending.expenses);
  state.recurring = applyOpGroup(remote.recurring, pending.recurring);
  state.budget = pending.budget ? clone(pending.budget) : remote.budget;
  if (migrateRecurring()) scheduleSync(150);
  persistLocal();
  renderAll();
}

let syncing = false;
let syncQueued = false;
let syncTimer = null;
let retryTimer = null;
let retryDelay = 5000;
let lastSyncError = "";
let justPushed = false;
let lastPullAt = 0;

function scheduleSync(delay = 150) {
  if (!state.syncEndpoint) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => runSync(), delay);
  refreshSyncBadge();
}

// ซิงก์ทีละรอบเท่านั้น (ไม่มีคำขอซ้อนกัน): ส่งคิวขึ้นชีต หรือถ้าคิวว่างก็โหลดข้อมูลล่าสุดลงมา
// ถ้าเปิดแอปไว้หลายแท็บ ให้ซิงก์ได้ทีละแท็บ (Web Locks) คำตอบจากชีตจึงมาถึงตามลำดับเสมอ
function runSync(options) {
  if (!state.syncEndpoint) return Promise.resolve();
  if (syncing) {
    syncQueued = true;
    return Promise.resolve();
  }
  syncing = true;
  const run = () => syncOnce(options);
  if (!navigator.locks?.request) return run();
  // รอคิวจากแท็บอื่นไม่เกิน 10 วินาที — ถ้าแท็บนั้นค้าง (เช่น ถูกพักอยู่เบื้องหลัง) ก็ซิงก์ต่อเองได้เลย
  return navigator.locks
    .request("porsche-family-sync", { signal: AbortSignal.timeout(10000) }, run)
    .catch((error) => (error?.name === "TimeoutError" || error?.name === "AbortError" ? run() : Promise.reject(error)));
}

async function syncOnce({ manual = false } = {}) {
  window.clearTimeout(syncTimer);
  window.clearTimeout(retryTimer);
  const endpoint = state.syncEndpoint;
  pending = loadPending();
  const sent = clone(pending);
  const pushing = pendingCount(sent) > 0;
  if (manual) setSyncStatus(pushing ? "กำลังบันทึกขึ้น Google Sheets..." : "กำลังโหลดข้อมูลจาก Google Sheets...");
  refreshSyncBadge();

  try {
    const remote = pushing ? await pushPending(endpoint, sent) : await loadVerified(endpoint);
    if (endpoint !== state.syncEndpoint) return; // เปลี่ยนลิงก์ระหว่างรอ → ทิ้งผลลัพธ์นี้
    if (pushing) {
      clearSentPending(sent);
      justPushed = true;
    }
    lastPullAt = Date.now();
    lastSyncError = "";
    retryDelay = 5000;
    adoptRemote(remote, { sent });
    const when = remote.updatedAt ? ` (${new Date(remote.updatedAt).toLocaleString("th-TH")})` : "";
    if (remoteHold) setSyncStatus("Google Sheets ไม่มีรายการของเครื่องนี้ — แตะป้ายสีแดงด้านบนเพื่อเลือกว่าจะทำอย่างไร", "error");
    else if (backendMode === "legacy") setSyncStatus(`ซิงก์แล้ว${when} — สคริปต์ใน Google Sheets ยังเป็นเวอร์ชันเก่า ควรอัปเดตตาม README`, "good");
    else setSyncStatus(`ข้อมูลตรงกับ Google Sheets แล้ว${when}`, "good");
  } catch (error) {
    lastSyncError = syncErrorMessage(error);
    setSyncStatus(lastSyncError, "error");
    // ลองใหม่เองเป็นระยะ (5 วิ → สูงสุด 2 นาที) และเมื่อกลับมาออนไลน์/เปิดแอป
    retryTimer = window.setTimeout(() => runSync(), retryDelay);
    retryDelay = Math.min(retryDelay * 2, 120000);
  } finally {
    syncing = false;
    refreshSyncBadge();
    if (syncQueued || (!lastSyncError && pendingCount() > 0)) {
      syncQueued = false;
      scheduleSync(150);
    }
  }
}

// ผู้ใช้กำลังจะออกจากแอป: ถ้ายังมีคิวรอส่ง ให้ส่งทันทีไม่ต้องรอ
function flushOnHide() {
  if (!state.syncEndpoint || pendingCount() === 0 || syncing) return;
  runSync();
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
    openRecurring({ freq: "monthly" });
  });
});

document.querySelectorAll("[data-open-recurring-yearly]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    closeActions();
    openRecurring({ freq: "yearly" });
  });
});

document.querySelector("[data-recurring-form] [name='freq']")?.addEventListener("change", updateRecurringFormMode);

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

// ปุ่มปฏิทินตอนนี้เป็น <input type="month"> ซ้อนอยู่ (data-month-filter) — เลือกเดือนแล้วดูข้อมูลได้เลย ไม่เด้งไปหน้าอื่น
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

// drill-down: แตะหมวด (โดนัท/รายการหมวด) → ไปหน้าบันทึกรายจ่าย พร้อมกรองเฉพาะหมวดนั้น
function jumpToCategory(key) {
  if (!key) return;
  state.categoryFilter = key;
  const sel = document.querySelector("[data-category-filter]");
  if (sel) sel.value = key;
  setView("records");
  renderAll();
}

document.body.addEventListener("click", (event) => {
  const catEl = event.target.closest("[data-cat-jump]");
  if (catEl) jumpToCategory(catEl.dataset.catJump);
});

document.body.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const catEl = event.target.closest("[data-cat-jump]");
  if (catEl) {
    event.preventDefault();
    jumpToCategory(catEl.dataset.catJump);
  }
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
  const title = data.get("title").toString().trim();
  const amount = Number(data.get("amount"));
  const date = String(data.get("date") || "");
  if (!title) {
    form.elements.title.value = "";
    form.elements.title.reportValidity();
    return;
  }
  if (!Number.isFinite(amount) || amount < 0 || !isValidDate(date)) {
    window.alert("กรุณาตรวจจำนวนเงินและวันที่อีกครั้ง");
    return;
  }

  const fields = { title, category: data.get("category"), amount, date };
  const existing = id ? state.expenses.find((item) => String(item.id) === String(id)) : null;
  let record;
  if (existing) {
    // เก็บข้อมูลเดิมที่ฟอร์มไม่มี (เช่น ตัวเชื่อมกับรายจ่ายประจำ) ไว้ด้วย
    record = { ...existing, ...fields };
    state.expenses = state.expenses.map((item) => (item === existing ? record : item));
  } else {
    // รายการใหม่ หรือรายการที่กำลังแก้ถูกลบจากเครื่องอื่นไปแล้ว → บันทึกเป็นรายการใหม่ ไม่ทิ้ง
    record = { id: newId(), ...fields };
    state.expenses = [record, ...state.expenses];
  }
  state.month = monthOf(record.date);

  queueChange(() => markUpsert("expenses", record));
  commitChange();
  closeModal();
  renderAll();
});

document.querySelector("[data-budget-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  state.budget = {
    total: Number(form.elements.total.value || 0),
    categories: {
      ...(state.budget.categories || {}),
      food: Number(form.elements.food.value || 0),
      travel: Number(form.elements.travel.value || 0),
      child: Number(form.elements.child.value || 0),
      home: Number(form.elements.home.value || 0),
    },
  };
  queueChange(() => markBudget(state.budget));
  commitChange();
  closeBudget();
  renderAll();
});

document.querySelector("[data-recurring-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const freq = data.get("freq") || "monthly";
  const editId = data.get("editId");
  const item = {
    id: editId ? Number(editId) || editId : newId(),
    title: data.get("title").toString().trim(),
    category: data.get("category"),
    amount: Number(data.get("amount")),
    day: Math.min(31, Math.max(1, Math.round(Number(data.get("day")) || 1))),
    freq,
    month: freq === "yearly" ? Number(data.get("month")) || 1 : null,
    end: freq === "yearly" ? "" : (data.get("end") || "").toString(),
  };
  if (!item.title) {
    form.elements.title.value = "";
    form.elements.title.reportValidity();
    return;
  }
  // บิลรายปี: วันที่ต้องมีจริงในเดือนนั้น (เช่น 31 ก.พ. → 28 ก.พ.)
  if (freq === "yearly") item.day = Math.min(item.day, daysInMonth(`2000-${String(item.month).padStart(2, "0")}`));
  if (editId && (state.recurring || []).some((r) => String(r.id) === String(editId))) {
    state.recurring = state.recurring.map((r) => (String(r.id) === String(editId) ? item : r));
  } else {
    state.recurring = [...(state.recurring || []), item];
  }
  queueChange(() => markUpsert("recurring", item));
  commitChange();
  closeRecurring();
  renderAll();
});

function readSyncForm() {
  const form = document.querySelector("[data-sync-form]");
  if (!form) return;
  if (!saveSyncEndpoint(form.elements.endpoint.value)) {
    setSyncStatus("ลิงก์ไม่ถูกต้อง ต้องเป็นลิงก์ Web App ของ Google Apps Script (https://script.google.com/macros/s/.../exec)", "error");
    return false;
  }
  if (form.elements.syncKey) saveSyncKey(form.elements.syncKey.value);
  return true;
}

document.querySelector("[data-sync-form]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!readSyncForm()) return;
  if (!state.syncEndpoint) {
    setSyncStatus("ลบลิงก์ Google Sheets แล้ว", "good");
    refreshSyncBadge();
    return;
  }
  runSync({ manual: true });
});

// โหลดจากชีต: ดึงข้อมูลล่าสุดลงมา (รายการในเครื่องที่ยังไม่ได้ส่งจะถูกส่งขึ้นไปด้วย ไม่ถูกทับทิ้ง)
document.querySelector("[data-sync-download]")?.addEventListener("click", () => {
  if (!readSyncForm()) return;
  if (!state.syncEndpoint) {
    setSyncStatus("ใส่ลิงก์ Web App ก่อนโหลดข้อมูล", "error");
    return;
  }
  runSync({ manual: true });
});

// บันทึกขึ้นชีต: ส่งรายการที่ยังค้างในคิว (ถ้าชีตว่างและเครื่องนี้มีข้อมูล จะถามก่อนว่าจะส่งทั้งหมดขึ้นไปไหม)
document.querySelector("[data-sync-upload]")?.addEventListener("click", () => {
  if (!readSyncForm()) return;
  if (!state.syncEndpoint) {
    setSyncStatus("ใส่ลิงก์ Web App ก่อนบันทึกขึ้นชีต", "error");
    return;
  }
  if (remoteHold) resolveRemoteHold();
  else runSync({ manual: true });
});

document.querySelectorAll("[data-clear-data]").forEach((button) => {
  button.addEventListener("click", clearAllData);
});

document.querySelectorAll("[data-export-csv]").forEach((button) => {
  button.addEventListener("click", () => exportCsv({ all: button.dataset.exportCsv === "all" }));
});

document.querySelectorAll("[data-close-panels]").forEach((button) => {
  button.addEventListener("click", closePanels);
});

document.body.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");
  if (deleteButton) {
    const exp = state.expenses.find((item) => String(item.id) === deleteButton.dataset.deleteId);
    if (!window.confirm(`ต้องการลบรายการ "${exp ? exp.title : ""}" ใช่ไหม?`)) return;
    state.expenses = state.expenses.filter((item) => String(item.id) !== deleteButton.dataset.deleteId);
    queueChange(() => markDelete("expenses", deleteButton.dataset.deleteId));
    commitChange();
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
    const id = postButton.dataset.postRecurring;
    const today = new Date();
    const bill = (state.recurring || []).find((b) => String(b.id) === id);
    if (!bill) return;
    let posted;

    if (bill.freq === "yearly") {
      const yr = today.getFullYear();
      if (!bill.month || yearlyPostedThisYear(bill.id, yr)) return;
      const yearMonth = `${yr}-${String(bill.month).padStart(2, "0")}`;
      const date = `${yearMonth}-${String(Math.min(Number(bill.day) || 1, daysInMonth(yearMonth))).padStart(2, "0")}`;
      // รหัสตายตัวต่อบิลต่อปี: สองเครื่องกด "บันทึก" บิลเดียวกันจะได้รายการเดียว ไม่ซ้ำ
      posted = { id: billPostId(bill.id, yr), recurringId: bill.id, title: bill.title, category: bill.category, amount: Number(bill.amount), date };
    } else {
      const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      if (state.expenses.some((e) => sameId(e.recurringId, bill.id) && monthOf(e.date) === monthKey)) return;
      const last = daysInMonth(monthKey);
      const day = String(Math.min(Number(bill.day) || 1, last)).padStart(2, "0");
      posted = { id: billPostId(bill.id, monthKey), recurringId: bill.id, title: bill.title, category: bill.category, amount: Number(bill.amount), date: `${monthKey}-${day}` };
    }
    state.expenses = [posted, ...state.expenses.filter((item) => String(item.id) !== String(posted.id))];
    queueChange(() => markUpsert("expenses", posted));

    state.month = currentMonthKey();
    commitChange();
    renderAll();
    return;
  }

  const editRecurringButton = event.target.closest("[data-edit-recurring]");
  if (editRecurringButton) {
    const r = (state.recurring || []).find((x) => String(x.id) === editRecurringButton.dataset.editRecurring);
    if (r) openRecurring({ item: r });
    return;
  }

  const recurringDeleteButton = event.target.closest("[data-delete-recurring]");
  if (recurringDeleteButton) {
    const id = recurringDeleteButton.dataset.deleteRecurring;
    const bill = (state.recurring || []).find((item) => String(item.id) === id);
    if (!window.confirm(`ต้องการลบรายจ่ายประจำ "${bill ? bill.title : ""}" ใช่ไหม?`)) return;
    state.recurring = state.recurring.filter((item) => String(item.id) !== id);
    queueChange(() => markDelete("recurring", id));
    commitChange();
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
  navigator.serviceWorker.register("service-worker.js?v=46").catch(() => {});
  // อัปเดตตัวเองอัตโนมัติ: พอมี service worker เวอร์ชันใหม่เข้ามาคุม ให้รีโหลดหน้าทันที (กันค้างเวอร์ชันเก่าในไอคอนโฮม)
  let swReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swReloaded) return;
    swReloaded = true;
    window.location.reload();
  });
}

setView(location.hash.replace("#", "") || "home");
renderAll();

// ย้ายข้อมูลเข้าระบบใหม่ "ครั้งเดียวต่อเครื่อง": ใส่ freq ให้รายการเดิม, ใส่วันผ่อนครบรถ/iPhone,
// และเพิ่มรายจ่ายรายปีตั้งต้นถ้ายังไม่มี (ทำหลังโหลดจากชีตสำเร็จเท่านั้น และไม่เติมซ้ำหลังผู้ใช้ลบเอง)
function migrateRecurring() {
  if (readStored(migrationStorageKey) === "1") return false;
  let changed = false;
  pending = loadPending();
  (state.recurring || []).forEach((r) => {
    let touched = false;
    if (!r.freq) {
      r.freq = "monthly";
      touched = true;
    }
    if (INSTALLMENT_END[r.id] && !r.end) {
      r.end = INSTALLMENT_END[r.id];
      touched = true;
    }
    if (touched) {
      markUpsert("recurring", r);
      changed = true;
    }
  });
  if (!(state.recurring || []).some((r) => r.freq === "yearly")) {
    YEARLY_BILLS.forEach((b) => {
      const item = { ...b, freq: "yearly" };
      state.recurring.push(item);
      markUpsert("recurring", item);
    });
    changed = true;
  }
  savePending();
  writeStored(migrationStorageKey, "1");
  return changed;
}

importOldSyncBase();

// เปิดแอป: ส่งคิวที่ค้างจากรอบก่อน (ถ้ามี) แล้วโหลดข้อมูลล่าสุดจาก Google Sheet
// ระหว่างรอ ผู้ใช้เพิ่มรายการได้ตามปกติ — รายการใหม่จะเข้าคิวและไม่ถูกข้อมูลจากชีตทับ
if (state.syncEndpoint) {
  runSync();
} else if (migrateRecurring()) {
  persistLocal();
  renderAll();
}

// เปิดแอปค้างข้ามเดือน → เลื่อนเดือนที่ดูอยู่ตามให้อัตโนมัติ (ไม่งั้นรายการวันนี้จะถูกลงเป็นเดือนก่อน)
let knownCurrentMonth = currentMonthKey();
function followMonthRollover() {
  const now = currentMonthKey();
  if (now === knownCurrentMonth) return;
  if (state.month === knownCurrentMonth) state.month = now;
  knownCurrentMonth = now;
  renderAll();
}

// โหลดข้อมูลล่าสุดใหม่ทุกครั้งที่เปิด/สลับกลับมาที่แอป (สำคัญสำหรับไอคอนโฮม/PWA ที่ไม่รีเฟรชหน้าเอง)
function refreshOnResume() {
  followMonthRollover();
  if (!state.syncEndpoint) return;
  if (pendingCount() === 0 && !lastSyncError && Date.now() - lastPullAt < 8000) return; // กันยิงซ้ำ
  runSync();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshOnResume();
  else flushOnHide();
});
window.addEventListener("pagehide", flushOnHide);
window.addEventListener("focus", refreshOnResume);
window.addEventListener("online", () => runSync());
window.addEventListener("pageshow", (e) => {
  if (e.persisted) refreshOnResume();
});

// อีกแท็บ/หน้าต่างของแอปเดียวกันบันทึกข้อมูล → อ่านค่าล่าสุดมาใช้ ไม่ให้แท็บนี้เขียนข้อมูลเก่าทับ
window.addEventListener("storage", (event) => {
  if (![storageKey, budgetStorageKey, recurringStorageKey, pendingStorageKey].includes(event.key)) return;
  state.expenses = loadExpenses();
  state.budget = loadBudget();
  state.recurring = loadRecurring();
  pending = loadPending();
  renderAll();
  refreshSyncBadge();
});

const SHEET_NAMES = {
  expenses: "expenses",
  budget: "budget",
  recurring: "recurring",
  meta: "meta",
};

const HEADERS = {
  expenses: ["id", "title", "category", "amount", "date", "recurringId"],
  budget: ["key", "amount"],
  recurring: ["id", "title", "category", "amount", "day", "freq", "month", "end"],
  meta: ["key", "value"],
};

// คอลัมน์ที่ต้องเก็บเป็นข้อความ (ถ้าเป็นตัวเลข/วันที่ Sheets จะแปลงเอง เช่น "2028-01" → วันที่ 1 ม.ค.)
const TEXT_COLUMNS = {
  expenses: ["id", "date", "recurringId"],
  recurring: ["id", "end"],
};

function doGet(event) {
  const action = event.parameter.action || "loadAll";
  if (action === "loadAll") {
    return output_(event, { ok: true, data: loadAll_() });
  }

  if (action === "saveAll") {
    try {
      const data = JSON.parse(event.parameter.payload || "{}");
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) {
        return output_(event, { ok: false, busy: true, error: "ระบบกำลังบันทึกอยู่ ลองใหม่อีกครั้ง" });
      }
      try {
        saveAll_(data);
      } finally {
        lock.releaseLock();
      }

      return output_(event, { ok: true, updatedAt: new Date().toISOString() });
    } catch (error) {
      return output_(event, { ok: false, error: error.message });
    }
  }

  return output_(event, { ok: false, error: "Unknown action" });
}

function doPost(event) {
  try {
    const body = JSON.parse(event.postData.contents || "{}");
    if (body.action !== "saveAll" && body.action !== "applyOps") {
      return output_(event, { ok: false, error: "Unknown action" });
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      return output_(event, { ok: false, busy: true, error: "ระบบกำลังบันทึกอยู่ ลองใหม่อีกครั้ง" });
    }
    let data;
    const updatedAt = new Date().toISOString();
    try {
      if (body.action === "applyOps") {
        // วิธีใหม่: ส่งมาเฉพาะรายการที่เปลี่ยน แล้วรวมกับข้อมูลล่าสุดในชีต → ไม่ทับรายการที่เครื่องอื่นเพิ่ม
        data = applyOps_(Array.isArray(body.ops) ? body.ops : [], updatedAt);
      } else {
        // วิธีเดิม (แอปเวอร์ชันเก่าที่ยังค้างในเครื่อง): เขียนทับทั้งก้อน
        saveAll_({ ...(body.data || {}), updatedAt });
      }
    } finally {
      lock.releaseLock();
    }

    return output_(event, { ok: true, updatedAt, data });
  } catch (error) {
    return output_(event, { ok: false, error: error.message });
  }
}

// ops: [{ type: "upsertExpense", item }, { type: "deleteExpense", id }, { type: "upsertRecurring", item },
//        { type: "deleteRecurring", id }, { type: "setBudget", budget }]
function applyOps_(ops, updatedAt) {
  const data = loadAll_();
  const sameId = (a, b) => String(a) === String(b);
  const upsert = (list, item) => {
    if (!item || item.id === undefined || item.id === null || item.id === "") return list;
    const index = list.findIndex((x) => sameId(x.id, item.id));
    if (index >= 0) list[index] = item;
    else list.unshift(item);
    return list;
  };

  ops.forEach((op) => {
    if (!op) return;
    if (op.type === "upsertExpense") upsert(data.expenses, op.item);
    else if (op.type === "deleteExpense") data.expenses = data.expenses.filter((x) => !sameId(x.id, op.id));
    else if (op.type === "upsertRecurring") upsert(data.recurring, op.item);
    else if (op.type === "deleteRecurring") data.recurring = data.recurring.filter((x) => !sameId(x.id, op.id));
    else if (op.type === "setBudget" && op.budget && typeof op.budget === "object") data.budget = op.budget;
  });

  data.updatedAt = updatedAt;
  saveAll_(data);
  return loadAll_();
}

function saveAll_(data) {
  const updatedAt = data.updatedAt || new Date().toISOString();
  const expenses = Array.isArray(data.expenses) ? data.expenses : [];
  const recurring = Array.isArray(data.recurring) ? data.recurring : [];
  const budget = data.budget || {};
  const categoryBudget = budget.categories || {};

  writeRows_("expenses", expenses.map((item) => [
    item.id || "",
    item.title || "",
    item.category || "other",
    Number(item.amount || 0),
    item.date || "",
    item.recurringId || "",
  ]));

  const budgetRows = [["total", Number(budget.total || 0)]].concat(
    Object.keys(categoryBudget).map((key) => [key, Number(categoryBudget[key] || 0)]),
  );
  writeRows_("budget", budgetRows);

  writeRows_("recurring", recurring.map((item) => [
    item.id || "",
    item.title || "",
    item.category || "other",
    Number(item.amount || 0),
    Number(item.day || 1),
    item.freq || "monthly",
    item.month || "",
    item.end || "",
  ]));

  writeRows_("meta", [["updatedAt", updatedAt]]);
}

function loadAll_() {
  ensureSheets_();
  const budgetRows = readRows_("budget");
  const budget = { total: 0, categories: {} };
  budgetRows.forEach((row) => {
    const key = String(row[0] || "");
    const amount = Number(row[1] || 0);
    if (!key) return;
    if (key === "total") {
      budget.total = amount;
    } else {
      budget.categories[key] = amount;
    }
  });

  const metaRows = readRows_("meta");
  const meta = {};
  metaRows.forEach((row) => {
    if (row[0]) meta[row[0]] = row[1];
  });

  return {
    updatedAt: meta.updatedAt || "",
    expenses: readRows_("expenses").map((row) => ({
      id: Number(row[0]) || row[0],
      title: row[1] || "",
      category: row[2] || "other",
      amount: Number(row[3] || 0),
      date: cellText_(row[4], "yyyy-MM-dd"),
      recurringId: Number(row[5]) || row[5] || "",
    })).filter((item) => item.title && item.date),
    budget,
    recurring: readRows_("recurring").map((row) => ({
      id: Number(row[0]) || row[0],
      title: row[1] || "",
      category: row[2] || "other",
      amount: Number(row[3] || 0),
      day: Number(row[4] || 1),
      freq: row[5] || "monthly",
      month: row[6] ? Number(row[6]) : null,
      end: cellText_(row[7], "yyyy-MM"),
    })).filter((item) => item.title),
  };
}

function cellText_(value, pattern) {
  // ข้อมูลเก่าบางแถวถูกบันทึกเป็นเวลา UTC เช่น "2027-12-31T17:00:00.000Z" (= ม.ค. 2028 เวลาไทย) → แปลงกลับ
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) value = parsed;
  }
  if (value instanceof Date) {
    return Utilities.formatDate(value, spreadsheet_().getSpreadsheetTimeZone(), pattern);
  }
  return value === null || value === undefined ? "" : String(value);
}

function writeRows_(kind, rows) {
  const sheet = sheet_(kind);
  const width = HEADERS[kind].length;
  const values = [HEADERS[kind]].concat(rows);

  // ตั้งคอลัมน์เป็นข้อความ (ถ้า sheet เป็น "ตาราง" ที่กำหนดชนิดคอลัมน์ไว้ Sheets จะไม่ยอม → ข้ามไป)
  (TEXT_COLUMNS[kind] || []).forEach((name) => {
    const col = HEADERS[kind].indexOf(name) + 1;
    if (col > 0 && rows.length) {
      try {
        sheet.getRange(2, col, rows.length, 1).setNumberFormat("@");
      } catch (error) {}
    }
  });

  // เขียนทับก่อน แล้วค่อยล้างแถวที่เหลือ — ถ้าเขียนไม่สำเร็จ ข้อมูลเดิมจะไม่หาย (เดิมล้างก่อนเขียน)
  sheet.getRange(1, 1, values.length, width).setValues(values);
  const lastRow = sheet.getLastRow();
  if (lastRow > values.length) {
    sheet.getRange(values.length + 1, 1, lastRow - values.length, width).clearContent();
  }
  try {
    sheet.autoResizeColumns(1, width);
  } catch (error) {}
}

function readRows_(kind) {
  const sheet = sheet_(kind);
  const lastRow = sheet.getLastRow();
  const lastColumn = HEADERS[kind].length;
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
}

function sheet_(kind) {
  ensureSheets_();
  return spreadsheet_().getSheetByName(SHEET_NAMES[kind]);
}

function ensureSheets_() {
  const book = spreadsheet_();
  Object.keys(SHEET_NAMES).forEach((kind) => {
    let sheet = book.getSheetByName(SHEET_NAMES[kind]);
    if (!sheet) sheet = book.insertSheet(SHEET_NAMES[kind]);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS[kind].length).setValues([HEADERS[kind]]);
    }
  });
}

function spreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("SPREADSHEET_ID");

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (error) {
      properties.deleteProperty("SPREADSHEET_ID");
    }
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    properties.setProperty("SPREADSHEET_ID", active.getId());
    return active;
  }

  const book = SpreadsheetApp.create("Porsche Family Expenses Data");
  properties.setProperty("SPREADSHEET_ID", book.getId());
  return book;
}

function output_(event, payload) {
  const callback = event.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

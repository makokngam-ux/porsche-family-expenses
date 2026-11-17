// ครอบครัวน้องพอร์ช — Google Apps Script backend (เวอร์ชัน 2)
//
// สิ่งที่เปลี่ยนจากเวอร์ชันแรก
// - เพิ่ม action "applyOps": แอปส่งเฉพาะรายการที่เพิ่ม/แก้/ลบ แล้วสคริปต์รวมเข้ากับข้อมูลในชีตภายใต้ล็อกเดียว
//   (เครื่องที่ข้อมูลเก่าจะไม่ทับรายการของเครื่องอื่นอีก)
// - การอ่าน (loadAll) รอคิวเดียวกับการเขียน จึงไม่มีทางอ่านเจอชีตที่กำลังเขียนค้างอยู่
// - เขียนทับโดยไม่ล้างชีตก่อน เขียนเฉพาะแท็บที่เปลี่ยน และแถวที่ไม่ได้แก้ถูกเขียนกลับด้วยค่าดิบเดิม
// - เปิดไฟล์ชีตครั้งเดียวต่อคำขอ (รุ่นก่อนเปิดใหม่ทุกแถว ทำให้อ่านครั้งละ 15 วินาที บันทึกเกือบนาที)
// - ชื่อรายการเขียนเป็นข้อความล้วน (กันสูตร) และวันที่อ่านกลับตามเขตเวลาของชีต
// - ไม่ตั้งรูปแบบเซลล์ (setNumberFormat) เพราะแท็บ expenses เป็น "ตาราง" ที่กำหนดชนิดคอลัมน์ไว้ ซึ่ง Sheets ไม่ยอม
// - ยกเลิกการบันทึกผ่าน GET และยกเลิกการ "เขียนทับทั้งชุด" (saveAll) ของแอปเวอร์ชันเก่า
// - รหัสผ่านซิงก์ (ไม่บังคับ): ตั้ง Script property ชื่อ ACCESS_KEY แล้วใส่รหัสเดียวกันในแอป
//   (Project Settings > Script properties > Add script property)

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

const LOCK_WAIT_MS = 20000;

function doGet(event) {
  try {
    const params = (event && event.parameter) || {};
    const action = params.action || "loadAll";
    if (action !== "loadAll") {
      return output_(event, { ok: false, error: "Unknown action" });
    }
    checkKey_(params.key);
    const data = withLock_(function () {
      return loadAll_();
    });
    return output_(event, { ok: true, data: data });
  } catch (error) {
    return output_(event, { ok: false, error: error.message });
  }
}

function doPost(event) {
  try {
    const body = JSON.parse((event.postData && event.postData.contents) || "{}");
    checkKey_(body.key);

    if (body.action === "applyOps") {
      const ops = validateOps_(body.ops);
      const data = withLock_(function () {
        return applyOps_(ops);
      });
      return output_(event, { ok: true, updatedAt: data.updatedAt, skipped: ops.skipped, data: data });
    }

    if (body.action === "saveAll") {
      // แอปเวอร์ชันเก่าส่งข้อมูลทั้งชุดมาทับ ซึ่งลบรายการของเครื่องอื่นได้ → ไม่รับอีกต่อไป
      return output_(event, { ok: false, error: "App is out of date: close and reopen the app to update" });
    }

    return output_(event, { ok: false, error: "Unknown action" });
  } catch (error) {
    return output_(event, { ok: false, error: error.message });
  }
}

function withLock_(work) {
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    const result = work();
    SpreadsheetApp.flush();
    return result;
  } finally {
    lock.releaseLock();
  }
}

function checkKey_(key) {
  const expected = PropertiesService.getScriptProperties().getProperty("ACCESS_KEY");
  if (expected && String(key || "") !== expected) {
    throw new Error("unauthorized");
  }
}

// ---------- ตรวจข้อมูลขาเข้า (ต้องผ่านทั้งหมดก่อนแตะชีต) ----------

// ops: [{ type: "upsertExpense", item }, { type: "deleteExpense", id }, { type: "upsertRecurring", item },
//        { type: "deleteRecurring", id }, { type: "setBudget", budget }]  (รูปแบบเดียวกับแอป v45 เป็นต้นมา)
// คำสั่งทำตามลำดับ: คำสั่งหลังของรหัสเดียวกันชนะคำสั่งก่อน
function validateOps_(ops) {
  if (!Array.isArray(ops)) throw new Error("Invalid ops: nothing was changed");
  const result = {
    expenses: { upserts: [], deletes: [] },
    recurring: { upserts: [], deletes: [] },
    budget: null,
    skipped: 0,
  };
  const put = function (group, clean, item) {
    let record;
    try {
      record = clean(item);
    } catch (error) {
      // ข้ามได้กรณีเดียวคือไม่มีรหัสรายการ (ไม่มีทางอ้างถึงได้) — นับไว้และรายงานกลับ
      result.skipped += 1;
      return;
    }
    const key = String(record.id);
    group.deletes = group.deletes.filter(function (id) {
      return id !== key;
    });
    group.upserts = group.upserts.filter(function (existing) {
      return String(existing.id) !== key;
    });
    group.upserts.push(record);
  };
  const remove = function (group, id) {
    if (id === null || id === undefined || id === "") return;
    const key = String(id);
    group.upserts = group.upserts.filter(function (existing) {
      return String(existing.id) !== key;
    });
    if (group.deletes.indexOf(key) < 0) group.deletes.push(key);
  };
  ops.forEach(function (op) {
    if (!op || typeof op !== "object") return;
    if (op.type === "upsertExpense") put(result.expenses, cleanExpense_, op.item);
    else if (op.type === "deleteExpense") remove(result.expenses, op.id);
    else if (op.type === "upsertRecurring") put(result.recurring, cleanRecurring_, op.item);
    else if (op.type === "deleteRecurring") remove(result.recurring, op.id);
    else if (op.type === "setBudget" && op.budget && typeof op.budget === "object") result.budget = cleanBudget_(op.budget);
  });
  return result;
}

// แปลงเป็นตัวเลขเฉพาะเมื่อเขียนกลับได้เหมือนเดิมทุกตัวอักษร ("001" ต้องคงเป็นข้อความ)
function normalId_(value) {
  const asNumber = Number(value);
  return isFinite(asNumber) && String(asNumber) === String(value) ? asNumber : String(value).slice(0, 80);
}

function cleanId_(value) {
  if (value === null || value === undefined || value === "") throw new Error("Missing id");
  return normalId_(value);
}

function validDate_(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]);
}

function cleanAmount_(value) {
  const amount = Number(value);
  return isFinite(amount) ? amount : 0;
}

function cleanText_(value, maxLength) {
  return String(value === null || value === undefined ? "" : value).slice(0, maxLength);
}

function cleanExpense_(item) {
  if (!item || typeof item !== "object") throw new Error("Invalid expense");
  // ไม่ปฏิเสธรายการเพราะข้อมูลไม่สมบูรณ์ (แอปตรวจก่อนส่งแล้ว) — รายการเก่าที่วันที่/ชื่อแปลกต้องไม่หายเงียบ ๆ
  const date = cleanText_(item.date, 10);
  const title = cleanText_(item.title, 200).trim() || "(ไม่มีชื่อ)";
  return {
    id: cleanId_(item.id),
    title: title,
    category: cleanText_(item.category || "other", 40),
    amount: cleanAmount_(item.amount),
    date: date,
    recurringId: item.recurringId === null || item.recurringId === undefined || item.recurringId === "" ? "" : normalId_(item.recurringId),
  };
}

function cleanRecurring_(item) {
  if (!item || typeof item !== "object") throw new Error("Invalid recurring item");
  const title = cleanText_(item.title, 200).trim() || "(ไม่มีชื่อ)";
  const end = cleanText_(item.end, 7);
  return {
    id: cleanId_(item.id),
    title: title,
    category: cleanText_(item.category || "other", 40),
    amount: cleanAmount_(item.amount),
    day: Math.min(31, Math.max(1, Math.round(Number(item.day) || 1))),
    freq: item.freq === "yearly" ? "yearly" : "monthly",
    month: item.month ? Math.min(12, Math.max(1, Math.round(Number(item.month) || 1))) : "",
    end: /^\d{4}-\d{2}$/.test(end) ? end : "",
  };
}

function cleanBudget_(budget) {
  if (typeof budget !== "object") throw new Error("Invalid budget");
  const categories = {};
  const source = budget.categories && typeof budget.categories === "object" ? budget.categories : {};
  Object.keys(source).forEach(function (key) {
    categories[cleanText_(key, 40)] = cleanAmount_(source[key]);
  });
  return { total: cleanAmount_(budget.total), categories: categories };
}

// ---------- รวมรายการที่เปลี่ยนเข้ากับข้อมูลในชีต ----------

// หลักการเขียน: แถวที่ไม่ได้ถูกแก้ จะถูกเขียนกลับด้วย "ค่าดิบ" ตามที่อ่านมาจากชีตทุกประการ (ชนิดข้อมูลเดิม)
// เฉพาะแถวที่เพิ่ม/แก้เท่านั้นที่สร้างค่าใหม่ และแท็บที่ไม่มีการเปลี่ยนแปลงจะไม่ถูกเขียนเลย
function applyOps_(ops) {
  ensureSheets_();
  const touchedExpenses = ops.expenses.upserts.length + ops.expenses.deletes.length > 0;
  const touchedRecurring = ops.recurring.upserts.length + ops.recurring.deletes.length > 0;

  if (touchedExpenses) {
    writeRows_("expenses", mergeRawRows_(readRows_("expenses"), ops.expenses, expenseRow_, "expenses"));
  }
  if (touchedRecurring) {
    writeRows_("recurring", mergeRawRows_(readRows_("recurring"), ops.recurring, recurringRow_, "recurring"));
  }
  if (ops.budget) {
    const categoryBudget = ops.budget.categories || {};
    writeRows_("budget", [["total", Number(ops.budget.total || 0)]].concat(
      Object.keys(categoryBudget).map(function (key) {
        return [lit_(key), Number(categoryBudget[key] || 0)];
      }),
    ));
  }
  if (touchedExpenses || touchedRecurring || ops.budget) {
    writeRows_("meta", [["updatedAt", new Date().toISOString()]]);
  }
  SpreadsheetApp.flush();
  return loadAll_();
}

function expenseRow_(item) {
  return [item.id, litTitle_(item.title), lit_(item.category || "other"), Number(item.amount || 0), item.date, item.recurringId];
}

function recurringRow_(item) {
  return [
    item.id,
    litTitle_(item.title),
    lit_(item.category || "other"),
    Number(item.amount || 0),
    Number(item.day || 1),
    item.freq || "monthly",
    item.month || "",
    item.end || "",
  ];
}

// rawRows: แถวดิบจากชีต (ไม่รวมหัวตาราง) → คืนแถวดิบชุดใหม่หลังลบ/แก้/เพิ่ม
function mergeRawRows_(rawRows, group, toRow, kind) {
  // Object.create(null): รหัสอย่าง "constructor" ต้องไม่ไปชนกับของที่ติดมากับ object ปกติ
  const deleted = Object.create(null);
  group.deletes.forEach(function (id) {
    deleted[id] = true;
  });
  const upserts = Object.create(null);
  group.upserts.forEach(function (item) {
    upserts[String(item.id)] = item;
  });

  const placed = Object.create(null);
  const result = [];
  let position = 0; // นับเฉพาะแถวที่ไม่ว่าง ให้ตรงกับรหัสสำรองที่ loadAll_ ตั้งให้แถวที่ไม่มีรหัส
  rawRows.forEach(function (row) {
    if (!notBlankRow_(row)) return;
    const key = String(rowId_(row[0], (kind === "expenses" ? "row" : "rrow") + (position + 2)));
    position += 1;
    if (deleted[key]) return;
    if (upserts[key]) {
      // แถวที่ถูกแก้: แทนที่ ณ ตำแหน่งเดิม (ถ้ารหัสนี้ซ้ำหลายแถว เก็บแถวที่แก้แล้วแถวเดียว)
      if (!placed[key]) result.push(toRow(upserts[key]));
      placed[key] = true;
      return;
    }
    // แถวที่ไม่ได้แตะ: ค่าดิบเดิมทุกช่อง (วันที่ยังเป็นวันที่ ตัวเลขยังเป็นตัวเลข)
    // ยกเว้นข้อความที่ขึ้นต้นด้วย = + - @ ต้องเติม ' ไม่งั้นชีตจะตีความเป็นสูตรตอนเขียนกลับ
    result.push(row.map(lit_));
  });
  // รายการใหม่ไว้บนสุด
  const added = [];
  group.upserts.forEach(function (item) {
    const key = String(item.id);
    if (!placed[key] && !deleted[key]) {
      placed[key] = true;
      added.push(toRow(upserts[key]));
    }
  });
  return added.concat(result);
}

function loadAll_() {
  ensureSheets_();
  const zone = spreadsheet_().getSpreadsheetTimeZone();

  const budget = { total: 0, categories: {} };
  readRows_("budget").forEach(function (row) {
    const key = String(row[0] || "");
    if (!key) return;
    if (key === "total") {
      budget.total = Number(row[1] || 0);
    } else {
      budget.categories[key] = Number(row[1] || 0);
    }
  });

  const meta = {};
  readRows_("meta").forEach(function (row) {
    if (row[0]) meta[row[0]] = cellText_(row[1], zone, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  });

  return {
    updatedAt: meta.updatedAt || "",
    expenses: readRows_("expenses")
      // ตัดเฉพาะแถวที่ว่างทุกช่อง ไม่ตัดแถวที่ข้อมูลไม่ครบ (เดิมแถวที่ไม่มีชื่อ/วันที่ถูกทิ้งแล้วหายถาวร)
      .filter(notBlankRow_)
      .map(function (row, index) {
        return {
          id: rowId_(row[0], "row" + (index + 2)),
          title: unlitTitle_(cellText_(row[1], zone, "yyyy-MM-dd")) || "(ไม่มีชื่อ)",
          category: unlit_(String(row[2] || "other")),
          amount: Number(row[3] || 0),
          date: cellText_(row[4], zone, "yyyy-MM-dd"),
          recurringId: row[5] === "" ? "" : rowId_(row[5], ""),
        };
      }),
    budget: budget,
    recurring: readRows_("recurring")
      .filter(notBlankRow_)
      .map(function (row, index) {
        return {
          id: rowId_(row[0], "rrow" + (index + 2)),
          title: unlitTitle_(cellText_(row[1], zone, "yyyy-MM-dd")) || "(ไม่มีชื่อ)",
          category: unlit_(String(row[2] || "other")),
          amount: Number(row[3] || 0),
          day: Number(row[4] || 1),
          freq: row[5] === "yearly" ? "yearly" : "monthly",
          month: row[6] ? Number(row[6]) : null,
          end: cellText_(row[7], zone, "yyyy-MM"),
        };
      }),
  };
}

function rowId_(value, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  return typeof value === "number" ? value : normalId_(unlit_(String(value)));
}

function notBlankRow_(row) {
  return row.some(function (cell) {
    return cell !== "" && cell !== null && cell !== undefined;
  });
}

// ข้อความที่ขึ้นต้นด้วย = + - @ ชีตจะตีเป็นสูตร → เขียนโดยเติม ' นำหน้า (วิธีบังคับให้เป็นข้อความของชีต)
// ตอนอ่านกลับ ถ้า ' ยังติดมาก็ตัดออก ค่าที่แอปเห็นจึงเหมือนเดิมเสมอ
function lit_(value) {
  return typeof value === "string" && /^[=+\-@]/.test(value) ? "'" + value : value;
}

function unlit_(value) {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

// ชื่อรายการ: เติม ' ทุกครั้ง เพื่อไม่ให้ชีตแปลงชื่ออย่าง "7-11" เป็นวันที่ หรือ "=..." เป็นสูตร
function litTitle_(value) {
  return "'" + String(value === null || value === undefined ? "" : value);
}

function unlitTitle_(value) {
  return value.charAt(0) === "'" ? value.slice(1) : value;
}

// เซลล์เก่าที่ชีตแปลงเป็น "วันที่" ไปแล้ว ให้อ่านกลับตามเขตเวลาของชีต ไม่ใช่ของเครื่องผู้ใช้
function cellText_(value, zone, pattern) {
  // ข้อมูลเก่าบางแถวถูกบันทึกเป็นเวลา UTC เช่น "2027-12-31T17:00:00.000Z" (= ม.ค. 2028 เวลาไทย) → แปลงกลับ
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) value = parsed;
  }
  if (value instanceof Date) return Utilities.formatDate(value, zone, pattern);
  return String(value === null || value === undefined ? "" : value);
}

function writeRows_(kind, rows) {
  const sheet = sheet_(kind);
  const width = HEADERS[kind].length;
  const previousLastRow = sheet.getLastRow();

  // ชีตต้องมีแถวพอก่อนเขียน (ถ้าเพิ่มแถวเองไม่ได้ ปล่อยให้ setValues จัดการตามเดิม)
  try {
    const neededRows = rows.length + 2;
    if (sheet.getMaxRows() < neededRows) {
      sheet.insertRowsAfter(sheet.getMaxRows(), neededRows - sheet.getMaxRows());
    }
  } catch (error) {}

  // เขียนหัวตารางและข้อมูลในคำสั่งเดียว (แบบเดียวกับสคริปต์รุ่นก่อนที่ใช้กับชีตนี้อยู่)
  const values = [HEADERS[kind]].concat(rows);
  sheet.getRange(1, 1, values.length, width).setValues(values);
  // ลบเฉพาะแถวส่วนเกินด้านล่าง หลังจากเขียนข้อมูลใหม่เสร็จแล้ว และเฉพาะคอลัมน์ของแอป
  if (previousLastRow > values.length) {
    sheet.getRange(values.length + 1, 1, previousLastRow - values.length, width).clearContent();
  }
}

function readRows_(kind) {
  const sheet = sheet_(kind);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, HEADERS[kind].length).getValues();
}

function sheet_(kind) {
  return spreadsheet_().getSheetByName(SHEET_NAMES[kind]);
}

function ensureSheets_() {
  const book = spreadsheet_();
  Object.keys(SHEET_NAMES).forEach(function (kind) {
    let sheet = book.getSheetByName(SHEET_NAMES[kind]);
    if (!sheet) sheet = book.insertSheet(SHEET_NAMES[kind]);
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS[kind].length).setValues([HEADERS[kind]]);
    }
  });
}

let cachedBook_ = null;

function spreadsheet_() {
  if (cachedBook_) return cachedBook_;
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty("SPREADSHEET_ID");

  if (savedId) {
    // เปิดไม่ได้ให้หยุดและแจ้งข้อผิดพลาด ห้ามสลับไปใช้ชีตอื่นหรือสร้างชีตเปล่าเอง
    cachedBook_ = SpreadsheetApp.openById(savedId);
    return cachedBook_;
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    properties.setProperty("SPREADSHEET_ID", active.getId());
    cachedBook_ = active;
    return cachedBook_;
  }

  const book = SpreadsheetApp.create("Porsche Family Expenses Data");
  properties.setProperty("SPREADSHEET_ID", book.getId());
  cachedBook_ = book;
  return cachedBook_;
}

function output_(event, payload) {
  const callback = event && event.parameter ? event.parameter.callback : "";
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]{0,80}$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + "(" + JSON.stringify(payload) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

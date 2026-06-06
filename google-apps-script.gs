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

function doGet(event) {
  const action = event.parameter.action || "loadAll";
  if (action === "loadAll") {
    return output_(event, { ok: true, data: loadAll_() });
  }

  if (action === "saveAll") {
    try {
      const data = JSON.parse(event.parameter.payload || "{}");
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
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
    if (body.action !== "saveAll") {
      return output_(event, { ok: false, error: "Unknown action" });
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      saveAll_(body.data || {});
    } finally {
      lock.releaseLock();
    }

    return output_(event, { ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    return output_(event, { ok: false, error: error.message });
  }
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
      date: row[4] || "",
      recurringId: row[5] || "",
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
      end: row[7] || "",
    })).filter((item) => item.title),
  };
}

function writeRows_(kind, rows) {
  const sheet = sheet_(kind);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS[kind].length).setValues([HEADERS[kind]]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, HEADERS[kind].length).setValues(rows);
  }
  sheet.autoResizeColumns(1, HEADERS[kind].length);
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

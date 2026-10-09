import { DEFAULT_SETTINGS, validateSettings } from "./engine/settings.js";
import { validateEntry, shiftBounds } from "./engine/timeCalculator.js";
import { parseDate } from "./engine/payPeriodCalculator.js";
export const STORAGE_KEY = "japan-salary-calculator:v1";
export const emptyData = () => ({
  version: 1,
  onboarded: false,
  settings: { ...DEFAULT_SETTINGS },
  entries: [],
  allowances: [],
  deductions: [],
  comparisons: {},
});
export function validateData(data) {
  if (
    !data ||
    data.version !== 1 ||
    !Array.isArray(data.entries) ||
    !Array.isArray(data.allowances) ||
    !Array.isArray(data.deductions)
  )
    throw Error("Backup version/format invalid");
  const result = {
    ...emptyData(),
    ...data,
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
  };
  validateSettings(result.settings);
  if (typeof result.onboarded !== "boolean")
    throw Error("Invalid onboarding state");
  if (result.entries.length > 15000) throw Error("Too many entries");
  const dates = new Set(),
    ids = new Set();
  const bounds = [];
  for (const e of result.entries) {
    validateEntry(e);
    if (dates.has(e.date) || ids.has(e.id))
      throw Error("Duplicate date / Tanggal duplikat");
    dates.add(e.date);
    ids.add(e.id);
    if (!["paidLeave", "absence", "specialLeave"].includes(e.dayType)) {
      const b = shiftBounds(e),
        day = +parseDate(e.date) / 60000;
      bounds.push([day + b.start, day + b.end]);
    }
  }
  bounds.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < bounds.length; i++)
    if (bounds[i][0] < bounds[i - 1][1])
      throw Error("Shift bertumpuk / 勤務時間が重複");
  for (const list of [result.allowances, result.deductions]) {
    if (list.length > 1000) throw Error("Too many items");
    for (const a of list) {
      if (
        typeof a.name !== "string" ||
        typeof a.id !== "string" ||
        !Number.isFinite(a.amount) ||
        a.amount < 0 ||
        !Number.isInteger(a.amount) ||
        (a.month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(a.month))
      )
        throw Error("Invalid allowance/deduction");
    }
  }
  for (const a of result.allowances)
    if (
      !["month", "day", "hour", "once"].includes(a.frequency) ||
      (a.frequency === "once" && !a.month)
    )
      throw Error("Invalid allowance frequency");
  if (
    !result.comparisons ||
    typeof result.comparisons !== "object" ||
    Array.isArray(result.comparisons)
  )
    throw Error("Invalid comparisons");
  for (const [k, v] of Object.entries(result.comparisons))
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(k) || !Number.isFinite(v) || v < 0)
      throw Error("Invalid comparison");
  return result;
}
export function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? validateData(JSON.parse(raw)) : emptyData();
}
export function saveData(data) {
  const valid = validateData(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  return valid;
}
export function csvCell(value) {
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

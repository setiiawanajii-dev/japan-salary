import { DAY_TYPES, isLeave } from "./settings.js";
import { validDate, addDays, parseDate } from "./payPeriodCalculator.js";
export function timeMinutes(s) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
    throw Error("Invalid time / Waktu tidak valid");
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}
export function shiftBounds(e) {
  const start = timeMinutes(e.clockIn);
  let end = timeMinutes(e.clockOut);
  if (e.clockOutNextDay || end < start) end += 1440;
  if (end <= start || end - start > 1440)
    throw Error("Shift harus 1–1440 menit / 勤務時間は1〜1440分");
  return { start, end };
}
export function breakRanges(e) {
  const { start, end } = shiftBounds(e);
  if (e.breakMode === "simple") {
    const n = Number(e.totalBreakMinutes || 0);
    if (!Number.isInteger(n) || n < 0 || n >= end - start)
      throw Error("Durasi istirahat tidak valid / 休憩時間が無効");
    const a = start + Math.floor((end - start - n) / 2);
    return n ? [[a, a + n]] : [];
  }
  const ranges = (e.breaks || [])
    .map((b) => {
      let a = timeMinutes(b.start),
        z = timeMinutes(b.end);
      if (a < start) a += 1440;
      if (z <= a % 1440) z += 1440;
      if (z < a) z += 1440;
      if (a < start || z > end || z <= a)
        throw Error(
          "Istirahat harus berada dalam shift / 休憩は勤務時間内に入力",
        );
      return [a, z];
    })
    .sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++)
    if (ranges[i][0] < ranges[i - 1][1])
      throw Error("Istirahat bertumpuk / 休憩時間が重複");
  if (ranges.reduce((n, [a, b]) => n + b - a, 0) >= end - start)
    throw Error("Tidak ada waktu kerja / 勤務時間がありません");
  return ranges;
}
export function validateEntry(e) {
  if (
    e &&
    e.notes !== undefined &&
    (typeof e.notes !== "string" || e.notes.length > 2000)
  )
    throw Error("Invalid notes");
  if (
    e &&
    e.breakMode !== undefined &&
    !["ranges", "simple"].includes(e.breakMode)
  )
    throw Error("Invalid break mode");

  if (
    !e ||
    !validDate(e.date) ||
    !DAY_TYPES.includes(e.dayType) ||
    typeof e.id !== "string" ||
    !e.id
  )
    throw Error("Invalid work entry");
  if (e.nextDayType && !DAY_TYPES.includes(e.nextDayType))
    throw Error("Invalid next-day type");
  if (
    e.scheduledMinutes !== undefined &&
    (!Number.isInteger(e.scheduledMinutes) ||
      e.scheduledMinutes < 0 ||
      e.scheduledMinutes > 1440)
  )
    throw Error("Invalid scheduled minutes");
  if (!isLeave(e.dayType)) breakRanges(e);
  return e;
}
export function workMinutes(e, s) {
  validateEntry(e);
  if (isLeave(e.dayType)) return [];
  const { start, end } = shiftBounds(e),
    breaks = breakRanges(e),
    ns = timeMinutes(s.nightStart),
    ne = timeMinutes(s.nightEnd);
  const nextDate = addDays(e.date, 1);
  const result = [];
  for (let minute = start; minute < end; minute++) {
    if (breaks.some(([a, b]) => minute >= a && minute < b)) continue;
    const m = minute % 1440,
      date = minute < 1440 ? e.date : nextDate;
    const type =
      minute < 1440
        ? e.dayType
        : e.nextDayType ||
          (parseDate(date).getUTCDay() === s.holidayWeekday
            ? "statutoryHoliday"
            : "normal");
    result.push({
      minute,
      date,
      night: ns < ne ? m >= ns && m < ne : m >= ns || m < ne,
      holiday: type === "statutoryHoliday",
    });
  }
  return result;
}
export const calculateBreakMinutes = (e) =>
  isLeave(e.dayType) ? 0 : breakRanges(e).reduce((n, [a, b]) => n + b - a, 0);
export const calculateWorkedMinutes = (e, s) => workMinutes(e, s).length;
export const calculateNightMinutes = (e, s) =>
  workMinutes(e, s).filter((m) => m.night).length;
export const calculateHolidayWork = (e, s) =>
  workMinutes(e, s).filter((m) => m.holiday).length;

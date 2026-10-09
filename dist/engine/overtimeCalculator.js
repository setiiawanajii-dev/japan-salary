import { workMinutes } from "./timeCalculator.js";
import { weekKey, periodForDate } from "./payPeriodCalculator.js";
export const calculateScheduledWork = (worked, scheduled) =>
  Math.min(worked, scheduled);
export const calculateWithinStatutoryOvertime = (
  worked,
  scheduled,
  statutory,
) => Math.max(0, Math.min(worked, statutory) - scheduled);
export const calculateStatutoryOvertime = (worked, statutory) =>
  Math.max(0, worked - statutory);
export const calculateWeeklyOvertime = (regularMinutes, weeklyLimit) =>
  Math.max(0, regularMinutes - weeklyLimit);
export const calculateOver60HourOvertime = (minutes, threshold = 3600) => ({
  standard: Math.min(minutes, threshold),
  over: Math.max(0, minutes - threshold),
});
/** Daily overtime is excluded from the weekly regular-time accumulator. Holiday minutes are excluded from both. */
export function classifyEntries(entries, s) {
  const weekly = new Map(),
    monthly = new Map();
  return [...entries]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.clockIn?.localeCompare(b.clockIn) ||
        0,
    )
    .map((e) => {
      const mins = workMinutes(e, s);
      const scheduled = e.scheduledMinutes ?? s.scheduledMinutesPerDay;
      let dayRegular = 0;
      const parts = mins.map((m, index) => {
        let type = "normal",
          weeklyOT = false,
          over60 = false;
        const inSchedule = index < scheduled;
        if (m.holiday) type = "holiday";
        else {
          const dailyOT = dayRegular >= s.statutoryMinutesPerDay;
          dayRegular++;
          const wk = weekKey(m.date, s.weekStartsOn),
            used = weekly.get(wk) || 0;
          if (!dailyOT) {
            weeklyOT = used >= s.statutoryMinutesPerWeek;
            weekly.set(wk, used + 1);
          }
          if (dailyOT || weeklyOT) {
            type = "statutory";
            const mk = periodForDate(e.date, s.over60ClosingDay),
              count = monthly.get(mk) || 0;
            over60 = count >= s.over60ThresholdMinutes;
            monthly.set(mk, count + 1);
          } else if (!inSchedule) type = "within";
        }
        return { ...m, type, weeklyOT, over60, inSchedule };
      });
      return {
        ...e,
        parts,
        scheduledMinutes: scheduled,
        workedMinutes: parts.length,
        normalMinutes: parts.filter((m) => m.type === "normal").length,
        withinStatutoryOvertimeMinutes: parts.filter((m) => m.type === "within")
          .length,
        statutoryOvertimeMinutes: parts.filter((m) => m.type === "statutory")
          .length,
        weeklyOvertimeMinutes: parts.filter((m) => m.weeklyOT).length,
        over60Minutes: parts.filter((m) => m.over60).length,
        nightMinutes: parts.filter((m) => m.night).length,
        statutoryHolidayMinutes: parts.filter((m) => m.holiday).length,
      };
    });
}

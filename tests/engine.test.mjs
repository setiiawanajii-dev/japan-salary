import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS as D } from "../dist/engine/settings.js";
import {
  calculateWorkedMinutes,
  calculateBreakMinutes,
  calculateNightMinutes,
  breakRanges,
} from "../dist/engine/timeCalculator.js";
import {
  classifyEntries,
  calculateWeeklyOvertime,
  calculateOver60HourOvertime,
} from "../dist/engine/overtimeCalculator.js";
import {
  calculateMonthlySalary,
  calculateHourlyBase,
} from "../dist/engine/salaryEngine.js";
import {
  calculatePayPeriod,
  periodForDate,
  addDays,
} from "../dist/engine/payPeriodCalculator.js";
import { emptyData, validateData, csvCell } from "../dist/storage.js";
const s = { ...D, closingDay: 31, over60ClosingDay: 31, holidayWeekday: 0 };
const entry = (v = {}) => ({
  id: "a",
  date: "2026-10-05",
  clockIn: "08:00",
  clockOut: "19:30",
  breakMode: "ranges",
  breaks: [{ start: "12:00", end: "13:00" }],
  dayType: "normal",
  nextDayType: "normal",
  ...v,
});
const calc = (es, overrides = {}) =>
  calculateMonthlySalary(es, { ...s, ...overrides }, "2026-10");
const approx = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 0.001, `${actual} != ${expected}`);
test("08:00–19:30: 630 minutes = 450 normal + 30 within + 150 statutory", () => {
  const r = calc([entry()]);
  assert.equal(r.workedMinutes, 630);
  assert.equal(r.normalMinutes, 450);
  assert.equal(r.withinStatutoryOvertimeMinutes, 30);
  assert.equal(r.statutoryOvertimeMinutes, 150);
  assert.equal(r.net, 14463);
});
test("company overtime is not automatically multiplied by 1.25", () => {
  const r = calc([entry({ clockOut: "17:00" })]);
  assert.equal(r.withinStatutoryOvertimeMinutes, 30);
  approx(r.within, 650);
  assert.equal(r.net, 10400);
});
test("continuous overnight shift and break inside deep night", () => {
  const e = entry({
    clockIn: "20:00",
    clockOut: "05:00",
    breaks: [{ start: "00:00", end: "01:00" }],
  });
  assert.equal(calculateWorkedMinutes(e, s), 480);
  assert.equal(calculateNightMinutes(e, s), 360);
  assert.equal(calculateBreakMinutes(e), 60);
});
test("night boundaries are inclusive 22:00, exclusive 05:00", () => {
  assert.equal(
    calculateNightMinutes(
      entry({ clockIn: "22:00", clockOut: "05:00", breaks: [] }),
      s,
    ),
    420,
  );
  assert.equal(
    calculateNightMinutes(
      entry({ clockIn: "05:00", clockOut: "22:00", breaks: [] }),
      s,
    ),
    0,
  );
});
test("statutory overtime + night is additive at 1.50", () => {
  const r = calc([entry({ clockIn: "14:00", clockOut: "23:00", breaks: [] })], {
    scheduledMinutesPerDay: 480,
  });
  assert.equal(r.statutoryOvertimeMinutes, 60);
  assert.equal(r.nightMinutes, 60);
  approx(r.overtime + r.night, 1950);
});
test("statutory holiday + night is 1.60, with no overtime", () => {
  const r = calc([
    entry({
      clockIn: "22:00",
      clockOut: "23:00",
      breaks: [],
      dayType: "statutoryHoliday",
    }),
  ]);
  approx(r.net, 2080);
  assert.equal(r.statutoryOvertimeMinutes, 0);
});
test("holiday crossing midnight uses next calendar day type", () => {
  const r = calc([
    entry({
      clockIn: "22:00",
      clockOut: "02:00",
      breaks: [],
      dayType: "statutoryHoliday",
      nextDayType: "normal",
    }),
  ]);
  assert.equal(r.statutoryHolidayMinutes, 120);
  assert.equal(r.normalMinutes, 120);
});
test("65 hours OT: 60 at 1.25, only 5 at 1.50", () => {
  const es = Array.from({ length: 13 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-10-01", i),
      clockIn: "06:00",
      clockOut: "19:00",
      breaks: [],
    }),
  );
  const r = calc(es, {
    statutoryMinutesPerWeek: 10080,
    scheduledMinutesPerDay: 480,
  });
  assert.equal(r.statutoryOvertimeMinutes, 3900);
  assert.equal(r.over60Minutes, 300);
  approx(r.overtime, 1300 * (60 * 1.25 + 5 * 1.5));
  assert.deepEqual(calculateOver60HourOvertime(3900), {
    standard: 3600,
    over: 300,
  });
});
test("weekly overtime without double counting: six 9h days = 6 daily + 8 weekly", () => {
  const es = Array.from({ length: 6 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-10-05", i),
      clockIn: "08:00",
      clockOut: "17:00",
      breaks: [],
    }),
  );
  const r = calc(es, { scheduledMinutesPerDay: 480 });
  assert.equal(r.statutoryOvertimeMinutes, 840);
  assert.equal(r.weeklyOvertimeMinutes, 480);
  assert.equal(r.normalMinutes, 2400);
  assert.equal(calculateWeeklyOvertime(2880, 2400), 480);
});
test("weekly context includes entries before payroll start", () => {
  const es = Array.from({ length: 6 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-09-28", i),
      clockIn: "08:00",
      clockOut: "16:00",
      breaks: [],
    }),
  );
  const r = calc(es, { scheduledMinutesPerDay: 480 });
  assert.equal(r.workDays, 3);
  assert.equal(r.weeklyOvertimeMinutes, 480);
});
test("holiday excluded from weekly overtime accumulation", () => {
  const es = Array.from({ length: 6 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-10-05", i),
      clockIn: "08:00",
      clockOut: "16:00",
      breaks: [],
      dayType: i === 0 ? "statutoryHoliday" : "normal",
    }),
  );
  const r = calc(es);
  assert.equal(r.statutoryOvertimeMinutes, 0);
});
test("paid leave excluded from statutory and attendance allowance", () => {
  const r = calculateMonthlySalary(
    [entry({ dayType: "paidLeave" })],
    s,
    "2026-10",
    [{ name: "Transport", amount: 500, frequency: "day" }],
  );
  assert.equal(r.workedMinutes, 0);
  assert.equal(r.allowanceTotal, 0);
  assert.equal(r.net, 9750);
});
test("breaks spanning midnight are deducted correctly", () => {
  const e = entry({
    clockIn: "20:00",
    clockOut: "05:00",
    breaks: [
      { start: "23:30", end: "00:30" },
      { start: "03:00", end: "03:15" },
    ],
  });
  assert.equal(calculateWorkedMinutes(e, s), 465);
  assert.equal(calculateNightMinutes(e, s), 345);
});
test("overlapping/out of shift breaks rejected", () => {
  assert.throws(() =>
    breakRanges(
      entry({
        breaks: [
          { start: "12:00", end: "13:00" },
          { start: "12:30", end: "13:30" },
        ],
      }),
    ),
  );
  assert.throws(() =>
    breakRanges(entry({ breaks: [{ start: "07:00", end: "08:00" }] })),
  );
});
test("simple break centered deterministically; negative and excessive rejected", () => {
  const e = entry({ breakMode: "simple", totalBreakMinutes: 60 });
  assert.equal(calculateWorkedMinutes(e, s), 630);
  assert.throws(() => breakRanges({ ...e, totalBreakMinutes: -1 }));
  assert.throws(() => breakRanges({ ...e, totalBreakMinutes: 690 }));
});
test("pay period 20 cutoff: Sep 21–Oct 20, paid Nov 10", () => {
  assert.deepEqual(calculatePayPeriod("2026-10", D), {
    start: "2026-09-21",
    end: "2026-10-20",
    paymentDate: "2026-11-10",
    month: "2026-10",
  });
  assert.equal(periodForDate("2026-10-21", 20), "2026-11");
});
test("year boundary, leap year and clamped month end", () => {
  assert.equal(calculatePayPeriod("2027-01", D).start, "2026-12-21");
  assert.equal(
    calculatePayPeriod("2028-02", { ...D, closingDay: 31 }).end,
    "2028-02-29",
  );
  assert.equal(
    calculatePayPeriod("2026-02", {
      ...D,
      closingDay: 31,
      salaryPaymentDay: 31,
      paymentMonthOffset: 0,
    }).paymentDate,
    "2026-02-28",
  );
});
test("15 cutoff paid 25 same month", () => {
  assert.equal(
    calculatePayPeriod("2026-10", {
      ...D,
      closingDay: 15,
      salaryPaymentDay: 25,
      paymentMonthOffset: 0,
    }).paymentDate,
    "2026-10-25",
  );
});
test("monthly salary derives hourly divisor and preserves fixed base", () => {
  const setting = {
    salaryType: "monthly",
    monthlySalary: 240000,
    monthlyScheduledMinutes: 9600,
    scheduledMinutesPerDay: 480,
  };
  assert.equal(calculateHourlyBase({ ...s, ...setting }), 1500);
  const r = calc(
    [entry({ clockIn: "08:00", clockOut: "17:00", breaks: [] })],
    setting,
  );
  assert.equal(r.base, 240000);
  approx(r.overtime, 1875);
  assert.equal(r.net, 241875);
});
test("monthly weekly overtime inside schedule adds only premium", () => {
  const es = Array.from({ length: 6 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-10-05", i),
      clockIn: "08:00",
      clockOut: "16:00",
      breaks: [],
    }),
  );
  const r = calc(es, {
    salaryType: "monthly",
    monthlySalary: 240000,
    monthlyScheduledMinutes: 9600,
    scheduledMinutesPerDay: 480,
  });
  approx(r.overtime, 3000);
  assert.equal(r.net, 243000);
});
test("daily salary: fixed day plus extra hours", () => {
  const r = calc([entry({ clockOut: "18:00" })], {
    salaryType: "daily",
    dailySalary: 10000,
    scheduledMinutesPerDay: 480,
  });
  assert.equal(r.base, 10000);
  approx(r.overtime, 1562.5);
  assert.equal(r.net, 11563);
});
test("company override used for stacked premiums", () => {
  const r = calc(
    [
      entry({
        clockIn: "22:00",
        clockOut: "23:00",
        breaks: [],
        dayType: "statutoryHoliday",
      }),
    ],
    { holidayPremium: 0.4, nightPremium: 0.3 },
  );
  assert.equal(r.net, 2210);
});
test("allowances, deductions, one-off periods and net", () => {
  const r = calculateMonthlySalary(
    [entry()],
    s,
    "2026-10",
    [
      { name: "Transport", amount: 500, frequency: "day" },
      { name: "Other", amount: 100, frequency: "hour" },
      { name: "Once", amount: 900, frequency: "once", month: "2026-11" },
    ],
    [{ name: "Rent", amount: 2000 }],
  );
  assert.equal(r.allowanceTotal, 1550);
  assert.equal(r.net, 14013);
});
test("more than 60 accumulation can use separate monthly cutoff", () => {
  const es = Array.from({ length: 13 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-09-21", i),
      clockIn: "06:00",
      clockOut: "19:00",
      breaks: [],
    }),
  );
  const r = calc(es, {
    closingDay: 20,
    over60ClosingDay: 20,
    statutoryMinutesPerWeek: 10080,
  });
  assert.equal(r.over60Minutes, 300);
});
test("schema rejects invalid dates, duplicates, overlaps and bad backup values", () => {
  const d = emptyData();
  d.entries = [entry({ date: "2026-02-30" })];
  assert.throws(() => validateData(d));
  d.entries = [entry(), entry({ id: "b" })];
  assert.throws(() => validateData(d));
  d.entries = [
    entry({ clockIn: "20:00", clockOut: "09:00", breaks: [] }),
    entry({ id: "b", date: "2026-10-06" }),
  ];
  assert.throws(() => validateData(d));
  d.entries = [];
  d.settings.hourlyRate = -1;
  assert.throws(() => validateData(d));
});
test("CSV neutralizes spreadsheet formula injection", () => {
  assert.equal(csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("safe"), '"safe"');
});
test("minute conservation and nested counters for a mixed workweek", () => {
  const es = Array.from({ length: 7 }, (_, i) =>
    entry({
      id: String(i),
      date: addDays("2026-10-04", i),
      clockIn: "14:00",
      clockOut: "01:00",
      breaks: [
        { start: "18:00", end: "18:45" },
        { start: "23:00", end: "23:15" },
      ],
      dayType: i === 0 ? "statutoryHoliday" : "normal",
    }),
  );
  for (const e of classifyEntries(es, s)) {
    assert.equal(
      e.normalMinutes +
        e.withinStatutoryOvertimeMinutes +
        e.statutoryOvertimeMinutes +
        e.statutoryHolidayMinutes,
      e.workedMinutes,
    );
    assert.ok(e.nightMinutes <= e.workedMinutes);
    assert.ok(e.over60Minutes <= e.statutoryOvertimeMinutes);
    assert.ok(e.weeklyOvertimeMinutes <= e.statutoryOvertimeMinutes);
  }
});
test("storage saves, reloads and refuses invalid writes without replacing valid data", async () => {
  const { saveData, loadData } = await import("../dist/storage.js");
  const map = new Map();
  globalThis.localStorage = {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
  const original = emptyData();
  original.onboarded = true;
  original.entries = [entry()];
  saveData(original);
  assert.deepEqual(loadData(), original);
  assert.throws(() => saveData({ ...original, version: 99 }));
  assert.deepEqual(loadData(), original);
  delete globalThis.localStorage;
});
test("backup JSON roundtrip preserves settings, allowances, deductions and comparisons", () => {
  const d = emptyData();
  d.entries = [entry()];
  d.allowances = [
    { id: "x", name: "交通費", amount: 500, frequency: "day", month: "" },
  ];
  d.deductions = [{ id: "y", name: "寮費", amount: 5000, month: "2026-10" }];
  d.comparisons = { "2026-10": 10000 };
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))), d);
});
test("backup rejects malformed text and out-of-range schedule settings", () => {
  const d = emptyData();
  d.settings.name = { bad: true };
  assert.throws(() => validateData(d));
  d.settings.name = "";
  d.settings.scheduledMinutesPerDay = 1441;
  assert.throws(() => validateData(d));
});

import { classifyEntries } from "./overtimeCalculator.js";
import { calculatePayPeriod } from "./payPeriodCalculator.js";
import { calculateAllowances } from "./allowanceCalculator.js";
import { calculateDeductions } from "./deductionCalculator.js";
export function calculateHourlyBase(s) {
  return s.salaryType === "hourly"
    ? s.hourlyRate
    : s.salaryType === "daily"
      ? s.dailySalary / (s.scheduledMinutesPerDay / 60)
      : s.monthlySalary / (s.monthlyScheduledMinutes / 60);
}
export function calculateDailySalary(e, s) {
  const rate = calculateHourlyBase(s) / 60;
  let base = 0,
    within = 0,
    overtime = 0,
    night = 0,
    holiday = 0;
  const fixed = s.salaryType !== "hourly";
  if (
    e.dayType === "paidLeave" ||
    (e.dayType === "specialLeave" && e.specialLeavePaid)
  ) {
    base =
      s.salaryType === "hourly"
        ? rate * e.scheduledMinutes
        : s.salaryType === "daily"
          ? s.dailySalary
          : 0;
  } else if (s.salaryType === "daily" && e.parts.some((p) => !p.holiday)) {
    base = s.dailySalary;
  }
  for (const p of e.parts) {
    if (p.type === "normal") {
      if (!fixed) base += rate;
    } else if (p.type === "within") {
      within += rate * (1 + s.withinPremium);
    } else if (p.type === "statutory") {
      overtime +=
        rate *
        ((fixed && p.inSchedule ? 0 : 1) +
          (p.over60 ? s.over60HoursPremium : s.overtimePremium));
    } else holiday += rate * (1 + s.holidayPremium);
    if (p.night) night += rate * s.nightPremium;
  }
  return {
    base,
    within,
    overtime,
    night,
    holiday,
    total: base + within + overtime + night + holiday,
  };
}
export const calculateGrossSalary = (
  base,
  within,
  overtime,
  night,
  holiday,
  allowances,
) => base + within + overtime + night + holiday + allowances;
export const calculateNetSalary = (gross, deductions) => gross - deductions;
export function calculateMonthlySalary(
  entries,
  s,
  month,
  allowances = [],
  deductions = [],
) {
  const period = calculatePayPeriod(month, s);
  const classified = classifyEntries(entries, s);
  const rows = classified
    .filter((e) => e.date >= period.start && e.date <= period.end)
    .map((e) => ({ ...e, pay: calculateDailySalary(e, s) }));
  const sum = (k) => rows.reduce((n, e) => n + e[k], 0);
  const workedMinutes = sum("workedMinutes"),
    workDays = rows.filter((e) => e.workedMinutes > 0).length;
  const a = calculateAllowances(allowances, { workDays, workedMinutes, month }),
    d = calculateDeductions(deductions, month);
  const paySum = (k) => rows.reduce((n, e) => n + e.pay[k], 0);
  const base = s.salaryType === "monthly" ? s.monthlySalary : paySum("base"),
    within = paySum("within"),
    overtime = paySum("overtime"),
    night = paySum("night"),
    holiday = paySum("holiday"),
    allowanceTotal = a.reduce((n, i) => n + i.total, 0),
    deductionTotal = d.reduce((n, i) => n + i.total, 0);
  const gross = Math.round(
    calculateGrossSalary(
      base,
      within,
      overtime,
      night,
      holiday,
      allowanceTotal,
    ),
  );
  return {
    period,
    entries: rows,
    workDays,
    workedMinutes,
    normalMinutes: sum("normalMinutes"),
    withinStatutoryOvertimeMinutes: sum("withinStatutoryOvertimeMinutes"),
    statutoryOvertimeMinutes: sum("statutoryOvertimeMinutes"),
    weeklyOvertimeMinutes: sum("weeklyOvertimeMinutes"),
    over60Minutes: sum("over60Minutes"),
    nightMinutes: sum("nightMinutes"),
    statutoryHolidayMinutes: sum("statutoryHolidayMinutes"),
    base,
    within,
    overtime,
    night,
    holiday,
    allowances: a,
    deductions: d,
    allowanceTotal,
    deductionTotal,
    gross,
    net: calculateNetSalary(gross, Math.round(deductionTotal)),
  };
}

import { emptyData } from "./storage.js";
import {
  calculatePayPeriod,
  addDays,
  parseDate,
} from "./engine/payPeriodCalculator.js";
export function demoData(month) {
  const d = emptyData();
  d.onboarded = true;
  d.settings.name = "Pengguna Demo";
  d.settings.company = "Sakura Manufacturing";
  const p = calculatePayPeriod(month, d.settings);
  for (let date = p.start; date <= p.end; date = addDays(date, 1)) {
    const wd = parseDate(date).getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const n = d.entries.length;
    d.entries.push({
      id: crypto.randomUUID(),
      date,
      clockIn: n % 6 === 0 ? "20:00" : "08:00",
      clockOut: n % 6 === 0 ? "05:00" : n % 3 === 0 ? "19:30" : "17:30",
      clockOutNextDay: n % 6 === 0,
      breakMode: "ranges",
      breaks:
        n % 6 === 0
          ? [{ start: "00:00", end: "01:00" }]
          : [{ start: "12:00", end: "13:00" }],
      dayType: "normal",
      nextDayType: "normal",
      notes: "DEMO",
      scheduledMinutes: 450,
    });
  }
  d.allowances = [
    {
      id: crypto.randomUUID(),
      name: "交通費 / Transport",
      amount: 500,
      frequency: "day",
      month: "",
    },
  ];
  d.deductions = [
    {
      id: crypto.randomUUID(),
      name: "寮費 / Asrama",
      amount: 20000,
      month: "",
    },
  ];
  return d;
}

export const iso = (d) => d.toISOString().slice(0, 10);
export const parseDate = (s) => new Date(s + "T00:00:00Z");
export function validDate(s) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    Number.isFinite(+parseDate(s)) &&
    iso(parseDate(s)) === s
  );
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
export function monthDate(year, month, day) {
  return iso(
    new Date(
      Date.UTC(
        year,
        month,
        Math.min(day, new Date(Date.UTC(year, month + 1, 0)).getUTCDate()),
      ),
    ),
  );
}
export function calculatePayPeriod(month, s) {
  const [y, m] = month.split("-").map(Number);
  const end = monthDate(y, m - 1, s.closingDay);
  return {
    start: addDays(monthDate(y, m - 2, s.closingDay), 1),
    end,
    paymentDate: monthDate(y, m - 1 + s.paymentMonthOffset, s.salaryPaymentDay),
    month,
  };
}
export function periodForDate(date, closingDay) {
  const d = parseDate(date),
    y = d.getUTCFullYear(),
    m = d.getUTCMonth();
  return (
    date <= monthDate(y, m, closingDay)
      ? monthDate(y, m, 1)
      : monthDate(y, m + 1, 1)
  ).slice(0, 7);
}
export function weekKey(date, start = 0) {
  const d = parseDate(date);
  return addDays(date, -((d.getUTCDay() - start + 7) % 7));
}
export const formatJPY = (n) =>
  new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(
    Math.round(n),
  );
export const formatMinutes = (n) =>
  `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;

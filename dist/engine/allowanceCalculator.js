export function calculateAllowances(items, { workDays, workedMinutes, month }) {
  return items
    .filter((i) => !i.month || i.month === month)
    .map((i) => ({
      ...i,
      total:
        i.amount *
        (i.frequency === "day"
          ? workDays
          : i.frequency === "hour"
            ? workedMinutes / 60
            : 1),
    }));
}

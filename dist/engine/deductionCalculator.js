export function calculateDeductions(items, month) {
  return items
    .filter((i) => !i.month || i.month === month)
    .map((i) => ({ ...i, total: i.amount }));
}

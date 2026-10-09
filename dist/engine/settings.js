export const JAPAN_STANDARD = {
  statutoryMinutesPerDay: 480,
  statutoryMinutesPerWeek: 2400,
  overtimePremium: 0.25,
  nightPremium: 0.25,
  holidayPremium: 0.35,
  over60HoursPremium: 0.5,
  nightStart: "22:00",
  nightEnd: "05:00",
  over60ThresholdMinutes: 3600,
};
export const DEFAULT_SETTINGS = {
  ...JAPAN_STANDARD,
  countryPreset: "JP",
  language: "id",
  currency: "JPY",
  theme: "system",
  mode: "advanced",
  name: "",
  company: "",
  employment: "contract",
  salaryType: "hourly",
  hourlyRate: 1300,
  monthlySalary: 250000,
  dailySalary: 10000,
  monthlyScheduledMinutes: 9600,
  scheduledMinutesPerDay: 450,
  defaultBreakMinutes: 60,
  workDaysPerWeek: 5,
  holidayWeekday: 0,
  weekStartsOn: 0,
  withinPremium: 0,
  closingDay: 20,
  salaryPaymentDay: 10,
  paymentMonthOffset: 1,
  over60ClosingDay: 20,
};
export const DAY_TYPES = [
  "normal",
  "saturday",
  "sunday",
  "companyHoliday",
  "statutoryHoliday",
  "paidLeave",
  "absence",
  "specialLeave",
];
export const isLeave = (t) =>
  ["paidLeave", "absence", "specialLeave"].includes(t);
export function validateSettings(s) {
  for (const k of ["name", "company", "employment"])
    if (typeof s[k] !== "string" || s[k].length > 200)
      throw Error("Invalid text setting: " + k);
  if (
    s.scheduledMinutesPerDay > 1440 ||
    s.statutoryMinutesPerDay > 1440 ||
    s.statutoryMinutesPerWeek > 10080 ||
    s.defaultBreakMinutes > 1439
  )
    throw Error("Invalid time limit");
  if (
    !Number.isInteger(s.workDaysPerWeek) ||
    s.workDaysPerWeek < 1 ||
    s.workDaysPerWeek > 7
  )
    throw Error("Invalid work days");

  for (const k of [
    "hourlyRate",
    "monthlySalary",
    "dailySalary",
    "monthlyScheduledMinutes",
    "scheduledMinutesPerDay",
    "statutoryMinutesPerDay",
    "statutoryMinutesPerWeek",
    "defaultBreakMinutes",
    "withinPremium",
    "overtimePremium",
    "nightPremium",
    "holidayPremium",
    "over60HoursPremium",
    "over60ThresholdMinutes",
  ])
    if (!Number.isFinite(s[k]) || s[k] < 0)
      throw Error("Invalid setting: " + k);
  for (const k of [
    "monthlyScheduledMinutes",
    "scheduledMinutesPerDay",
    "statutoryMinutesPerDay",
    "statutoryMinutesPerWeek",
  ])
    if (!s[k]) throw Error("Must be positive: " + k);
  for (const k of [
    "monthlyScheduledMinutes",
    "scheduledMinutesPerDay",
    "statutoryMinutesPerDay",
    "statutoryMinutesPerWeek",
    "defaultBreakMinutes",
    "over60ThresholdMinutes",
  ])
    if (!Number.isInteger(s[k])) throw Error("Minutes must be integers: " + k);
  for (const k of ["closingDay", "salaryPaymentDay", "over60ClosingDay"])
    if (!Number.isInteger(s[k]) || s[k] < 1 || s[k] > 31)
      throw Error("Invalid day: " + k);
  for (const k of ["weekStartsOn", "holidayWeekday"])
    if (!Number.isInteger(s[k]) || s[k] < 0 || s[k] > 6)
      throw Error("Invalid weekday");
  if (
    !Number.isInteger(s.paymentMonthOffset) ||
    s.paymentMonthOffset < 0 ||
    s.paymentMonthOffset > 2
  )
    throw Error("Invalid payment month");
  if (
    !["hourly", "monthly", "daily"].includes(s.salaryType) ||
    !["id", "ja"].includes(s.language) ||
    !["simple", "advanced"].includes(s.mode) ||
    !["light", "dark", "system"].includes(s.theme)
  )
    throw Error("Invalid setting option");
  for (const k of ["nightStart", "nightEnd"])
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k]))
      throw Error("Invalid night time");
  return s;
}

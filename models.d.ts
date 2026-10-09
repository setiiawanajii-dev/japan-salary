/** Persisted schema version 1. Times are local Japanese wall-clock times, never fractional hours. */
export type SalaryType = "hourly" | "monthly" | "daily";
export type DayType =
  | "normal"
  | "saturday"
  | "sunday"
  | "companyHoliday"
  | "statutoryHoliday"
  | "paidLeave"
  | "absence"
  | "specialLeave";
export interface WorkEntry {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string;
  clockOutNextDay: boolean;
  dayType: DayType;
  nextDayType?: DayType;
  breakMode: "ranges" | "simple";
  breaks: { start: string; end: string }[];
  totalBreakMinutes?: number;
  scheduledMinutes: number;
  specialLeavePaid?: boolean;
  notes: string;
}
export interface Settings {
  countryPreset: "JP";
  language: "id" | "ja";
  currency: "JPY";
  theme: "light" | "dark" | "system";
  mode: "simple" | "advanced";
  name: string;
  company: string;
  employment: string;
  salaryType: SalaryType;
  hourlyRate: number;
  monthlySalary: number;
  dailySalary: number;
  monthlyScheduledMinutes: number;
  scheduledMinutesPerDay: number;
  defaultBreakMinutes: number;
  statutoryMinutesPerDay: number;
  statutoryMinutesPerWeek: number;
  workDaysPerWeek: number;
  holidayWeekday: number;
  weekStartsOn: number;
  withinPremium: number;
  overtimePremium: number;
  nightPremium: number;
  holidayPremium: number;
  over60HoursPremium: number;
  over60ThresholdMinutes: number;
  nightStart: string;
  nightEnd: string;
  closingDay: number;
  salaryPaymentDay: number;
  paymentMonthOffset: number;
  over60ClosingDay: number;
}
export interface Allowance {
  id: string;
  name: string;
  amount: number;
  frequency: "month" | "day" | "hour" | "once";
  month: string;
}
export interface Deduction {
  id: string;
  name: string;
  amount: number;
  month: string;
}
export interface AppData {
  version: 1;
  onboarded: boolean;
  settings: Settings;
  entries: WorkEntry[];
  allowances: Allowance[];
  deductions: Deduction[];
  comparisons: Record<string, number>;
}
export interface CalculatedEntry extends WorkEntry {
  workedMinutes: number;
  normalMinutes: number;
  withinStatutoryOvertimeMinutes: number;
  statutoryOvertimeMinutes: number;
  weeklyOvertimeMinutes: number;
  over60Minutes: number;
  nightMinutes: number;
  statutoryHolidayMinutes: number;
}

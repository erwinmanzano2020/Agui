export type Employee = {
  id: string;
  code: string;
  full_name: string;
  rate_per_day: number;
};

export type DtrEntry = {
  employee_id: string;
  work_date: string; // YYYY-MM-DD
  time_in: string | null;
  time_out: string | null;
  minutes_regular: number | null;
  minutes_ot: number | null;
};

export type ShiftSegment = {
  employee_id: string;
  work_date: string; // YYYY-MM-DD
  start_at: string | null; // HH:MM or ISO
  end_at: string | null; // HH:MM or ISO
};

export type Deduction = {
  employee_id: string;
  effective_date: string; // YYYY-MM-DD
  type: string | null;
  amount: number | null;
};

export type PresentDay = {
  date: string; // YYYY-MM-DD
  minutes_regular: number;
  minutes_ot: number;
};

export type PayslipItem = {
  label: string;
  amount: number;
};

export type PayslipSummary = {
  employee: Employee;
  period_start: string; // YYYY-MM-DD
  period_end: string; // YYYY-MM-DD
  present_days: PresentDay[];
  earnings: PayslipItem[];
  deductions: PayslipItem[];
  net_pay: number;
};

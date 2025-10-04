export default function Home() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Agui Starter Town</h1>
      <ul className="list-disc ml-6 space-y-1">
        <li>
          <a className="text-green-700 underline" href="/employees">
            Employees
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/shifts">
            Shifts
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/dtr-today">
            DTR Today
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/settings">
            Payroll Settings
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/preview">
            Payroll Preview
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/dtr-bulk">
            Bulk DTR (per month)
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/deductions">
            Deductions
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/payslip">
            Payslip
          </a>
        </li>
        <li>
          <a className="text-green-700 underline" href="/payroll/bulk-payslip">
            Bulk Payslip
          </a>
        </li>
      </ul>
    </main>
  );
}

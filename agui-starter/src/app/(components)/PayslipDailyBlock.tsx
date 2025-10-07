// Server Component
import { getDailyPayslipForPeriod } from "@/lib/payroll/getDailyPayslipForPeriod";

export default async function PayslipDailyBlock(props: {
  employeeId: string; // employees.id UUID
  from: string; // 'YYYY-MM-DD'
  to: string; // 'YYYY-MM-DD'
  showTable?: boolean;
}) {
  const res = await getDailyPayslipForPeriod({
    employeeId: props.employeeId,
    from: props.from,
    to: props.to,
  });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <b>Basis</b>: Daily
        </div>
        <div>
          <b>Days Present</b>: {res.daysPresent}
        </div>
        <div className="col-span-2">
          <b>Basic Pay</b>: ₱
          {res.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      {(props.showTable ?? true) && (
        <div className="border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-2">Date</th>
                <th className="text-right p-2">As-of Rate</th>
                <th className="text-center p-2">Present?</th>
                <th className="text-right p-2">Pay</th>
              </tr>
            </thead>
            <tbody>
              {res.breakdown.map((r) => (
                <tr key={r.date} className="border-t">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2 text-right">
                    ₱
                    {r.rate.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="p-2 text-center">{r.isPresent ? "✓" : "—"}</td>
                  <td className="p-2 text-right">
                    ₱
                    {r.pay.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
              {res.breakdown.length === 0 && (
                <tr>
                  <td className="p-3 text-gray-500" colSpan={4}>
                    No DTR rows in range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

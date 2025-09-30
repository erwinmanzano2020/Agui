import { useState } from 'react';
import { minutesBetween } from '@/lib/payroll/time';
import { computeDailyPay } from '@/lib/payroll/compute';

type Row = { name: string; date: string; in: string; out: string; rateType:'daily'|'hourly'; rateValue:number; ruleMode:'store_630'|'dole_480' };

export default function DTRPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState<Row>({
    name:'Juan Dela Cruz', date:'2025-09-26', in:'07:00', out:'17:30',
    rateType:'daily', rateValue:500, ruleMode:'store_630'
  });

  const addRow = () => setRows(r => [...r, form]);

  return (
    <main style={{maxWidth:820, margin:'24px auto', padding:16}}>
      <h1>Agui · DTR (local demo)</h1>
      <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8, margin:'12px 0'}}>
        {(['name','date','in','out','rateType','rateValue','ruleMode'] as const).map((k)=>(
          <input key={k} value={String((form as any)[k])}
            onChange={e=>setForm({...form, [k]: k==='rateValue'? Number(e.target.value): e.target.value} as any)}
            placeholder={k} />
        ))}
      </div>
      <button onClick={addRow}>Add row</button>

      <table style={{width:'100%', marginTop:16}} border={1} cellPadding={6}>
        <thead>
          <tr><th>Name</th><th>Date</th><th>In</th><th>Out</th><th>Minutes</th><th>Gross (demo)</th></tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>{
            const mins = minutesBetween(r.in, r.out);
            const pay = computeDailyPay(mins, r.ruleMode, r.rateType, r.rateValue);
            return (
              <tr key={i}>
                <td>{r.name}</td><td>{r.date}</td><td>{r.in}</td><td>{r.out}</td>
                <td>{mins}</td><td>₱{pay.gross}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{marginTop:8, fontSize:12, opacity:.7}}>Note: demo only (no Supabase yet). OT multiplier 1 placeholder.</p>
    </main>
  );
}
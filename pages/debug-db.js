import { useState, useEffect } from 'react';
import { getAllData } from '../lib/local-db';

export default function DebugDB() {
  const [employees, setEmployees] = useState([]);
  const [dtrEntries, setDtrEntries] = useState([]);

  useEffect(() => {
    async function loadData() {
      const employeeList = await getAllData('employees');
      const dtrList = await getAllData('dtr_entries');
      
      setEmployees(employeeList);
      setDtrEntries(dtrList);
    }
    loadData();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Database Debug - Employee ID Matching</h1>
      
      <h2>Employees in Local DB ({employees.length})</h2>
      {employees.map(emp => (
        <div key={emp.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc' }}>
          <strong>ID:</strong> {emp.id} <br />
          <strong>Name:</strong> {emp.full_name} <br />
          <strong>Code:</strong> {emp.employee_code}
        </div>
      ))}
      
      <h2>DTR Entries in Local DB ({dtrEntries.length})</h2>
      {dtrEntries.map(entry => (
        <div key={entry.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc' }}>
          <strong>ID:</strong> {entry.id} <br />
          <strong>Employee ID:</strong> {entry.employee_id} <br />
          <strong>Date:</strong> {entry.date} <br />
          <strong>Time In 1:</strong> {entry.time_in_1} <br />
          <strong>Time Out 1:</strong> {entry.time_out_1}
        </div>
      ))}

      <h2>Matching Test</h2>
      {employees.map(emp => {
        const empDtr = dtrEntries.filter(entry => entry.employee_id === emp.id);
        return (
          <div key={emp.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc' }}>
            <strong>{emp.full_name}</strong> (ID: {emp.id}) <br />
            DTR Entries: {empDtr.length}
          </div>
        );
      })}
    </div>
  );
}
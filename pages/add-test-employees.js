import { useState } from 'react';
import { addData, getAllData } from '../lib/local-db';

export default function AddTestEmployees() {
  const [message, setMessage] = useState('');

  const addTestEmployees = async () => {
    try {
      const testEmployees = [
        {
          id: 'emp-001',
          employee_code: 'EMP-001',
          full_name: 'Juan Dela Cruz',
          position: 'Cashier',
          pay_rate: 500.00,
          pay_rate_type: 'daily',
          ot_start_time: '17:30',
          ot_threshold_minutes: 10
        },
        {
          id: 'emp-002', 
          employee_code: 'EMP-002',
          full_name: 'Maria Santos',
          position: 'Store Manager',
          pay_rate: 600.00,
          pay_rate_type: 'daily',
          ot_start_time: '18:30',
          ot_threshold_minutes: 10
        },
        {
          id: 'emp-003',
          employee_code: 'EMP-003',
          full_name: 'Pedro Reyes',
          position: 'Stock Clerk',
          pay_rate: 450.00,
          pay_rate_type: 'daily',
          ot_start_time: '17:30',
          ot_threshold_minutes: 10
        }
      ];

      for (const emp of testEmployees) {
        await addData('employees', emp);
      }

      setMessage('✅ Test employees added successfully!');
    } catch (error) {
      setMessage('❌ Error adding employees: ' + error.message);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Add Test Employees</h1>
      <button 
        onClick={addTestEmployees}
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#0070f3', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        Add Test Employees to Local Database
      </button>
      {message && <p>{message}</p>}
      <div>
        <p><strong>Employees to be added:</strong></p>
        <ul>
          <li>Juan Dela Cruz (Cashier) - OT after 17:30</li>
          <li>Maria Santos (Manager) - OT after 18:30</li>
          <li>Pedro Reyes (Stock Clerk) - OT after 17:30</li>
        </ul>
      </div>
    </div>
  );
}
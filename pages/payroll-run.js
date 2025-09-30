import { useState, useEffect } from 'react';
import { getAllData } from '../lib/local-db';
import { PayrollComputation } from '../lib/payroll-computation';

export default function PayrollRun() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [dtrData, setDtrData] = useState([]);
  const [payrollResult, setPayrollResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load employees from LOCAL database only - USE UUID EMPLOYEES
  useEffect(() => {
    async function loadEmployees() {
      try {
        setLoading(true);
        const localEmployees = await getAllData('employees');
        
        // Filter to use ONLY UUID employees (the ones that have DTR data)
        const uuidEmployees = localEmployees.filter(emp => 
          emp.id && emp.id.includes('-') && !emp.id.startsWith('emp-')
        );
        
        setEmployees(uuidEmployees);
        if (uuidEmployees.length > 0) {
          setSelectedEmployee(uuidEmployees[0].id);
        }
      } catch (error) {
        console.error('Error loading employees:', error);
      } finally {
        setLoading(false);
      }
    }
    loadEmployees();
  }, []);

  // Load DTR data when employee or month changes
  useEffect(() => {
    if (selectedEmployee && selectedMonth) {
      loadDtrData();
    }
  }, [selectedEmployee, selectedMonth]);

  const loadDtrData = async () => {
    try {
      const allDtr = await getAllData('dtr_entries');
      const employeeDtr = allDtr.filter(entry => 
        entry.employee_id === selectedEmployee && 
        entry.date.startsWith(selectedMonth)
      );
      setDtrData(employeeDtr);
      console.log('Loaded DTR data:', employeeDtr.length, 'entries for employee:', selectedEmployee);
    } catch (error) {
      console.error('Error loading DTR data:', error);
    }
  };

  const calculatePayroll = () => {
    if (dtrData.length === 0) {
      alert('No DTR data found for selected employee and month');
      return;
    }

    const computation = new PayrollComputation('test-franchisee');
    const selectedEmp = employees.find(emp => emp.id === selectedEmployee);
    
    if (!selectedEmp) return;

    // Use employee-specific OT rules
    const employeeOTRules = {
      ot_start_type: 'after_time',
      ot_start_time: selectedEmp.ot_start_time || '17:30',
      ot_threshold_minutes: selectedEmp.ot_threshold_minutes || 10,
      regular_day_multiplier: 1.00
    };

    const hoursWorked = computation.calculateHoursWorked(dtrData, employeeOTRules);
    const grossPay = computation.calculateGrossPay(
      hoursWorked, 
      selectedEmp.pay_rate, 
      selectedEmp.pay_rate_type, 
      employeeOTRules
    );

    setPayrollResult({
      hoursWorked,
      grossPay,
      employee: selectedEmp,
      otRules: employeeOTRules
    });
  };

  // Get current employee's OT start time
  const getCurrentEmployeeOTTime = () => {
    const employee = employees.find(emp => emp.id === selectedEmployee);
    return employee?.ot_start_time?.substring(0, 5) || '17:30'; // Format time
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1>Payroll Run</h1>
        <p>Loading employees...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Payroll Run</h1>
      
      {/* Employee Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label>Employee: </label>
        {employees.length > 0 ? (
          <select 
            value={selectedEmployee} 
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.position}) - OT after: {getCurrentEmployeeOTTime()}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ color: '#ff4444' }}>
            No employees found. Please add employees first.
          </span>
        )}
      </div>

      {/* Month Selector */}
      <div style={{ marginBottom: '20px' }}>
        <label>Month: </label>
        <input 
          type="month" 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {/* DTR Data Info */}
      {selectedEmployee && selectedMonth && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: dtrData.length > 0 ? '#f0fff0' : '#fff9e6',
          border: dtrData.length > 0 ? '1px solid #28a745' : '1px solid #ffcc00',
          borderRadius: '4px'
        }}>
          {dtrData.length > 0 ? (
            <span>✅ Found {dtrData.length} DTR entries for {selectedMonth}</span>
          ) : (
            <span>⚠️ No DTR entries found for {selectedMonth}</span>
          )}
        </div>
      )}

      {/* OT Info */}
      {selectedEmployee && employees.length > 0 && (
        <div style={{ 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: '#f0f8ff',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <strong>OT Settings:</strong> Starts after {getCurrentEmployeeOTTime()} (10 min threshold)
        </div>
      )}

      {/* Calculate Button */}
      {selectedMonth && dtrData.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={calculatePayroll}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#0070f3', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Calculate Payroll
          </button>
        </div>
      )}

      {/* Payroll Results */}
      {payrollResult && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          border: '1px solid #ccc',
          borderRadius: '5px',
          backgroundColor: '#f9f9f9'
        }}>
          <h3>Payroll Results for {payrollResult.employee?.full_name}</h3>
          <p><strong>OT Starts After:</strong> {payrollResult.otRules.ot_start_time}</p>
          <p><strong>Regular Hours:</strong> {payrollResult.hoursWorked.regularHours.toFixed(2)}</p>
          <p><strong>Overtime Hours:</strong> {payrollResult.hoursWorked.overtimeHours.toFixed(2)}</p>
          <p><strong>Regular Pay:</strong> ₱{payrollResult.grossPay.regularPay.toFixed(2)}</p>
          <p><strong>Overtime Pay:</strong> ₱{payrollResult.grossPay.overtimePay.toFixed(2)}</p>
          <p><strong>Gross Pay:</strong> ₱{payrollResult.grossPay.grossPay.toFixed(2)}</p>
          
          <button 
            style={{ 
              marginTop: '10px',
              padding: '8px 16px', 
              backgroundColor: '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Export to PDF
          </button>
        </div>
      )}

      {/* No Employees Message */}
      {employees.length === 0 && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          border: '1px solid #ff4444',
          borderRadius: '5px',
          backgroundColor: '#fff0f0'
        }}>
          <p>No employees found in the system.</p>
          <p>Please add employees to the database first.</p>
        </div>
      )}
    </div>
  );
}
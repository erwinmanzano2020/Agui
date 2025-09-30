// Core payroll computation engine - HANDLES INCOMPLETE DTR ENTRIES
export class PayrollComputation {
  constructor(franchiseeId) {
    this.franchiseeId = franchiseeId;
  }

  // Calculate hours worked with employee-specific OT rules
  calculateHoursWorked(dtrEntries, employeeOTRules) {
    let totalRegularMinutes = 0;
    let totalOvertimeMinutes = 0;

    console.log('Calculating hours for', dtrEntries.length, 'DTR entries');
    
    dtrEntries.forEach(entry => {
      console.log('Processing entry:', entry);
      
      // Skip if no time in or incomplete data
      if (!entry.time_in_1 || (!entry.time_out_1 && !entry.time_out_2)) {
        console.log('Skipping incomplete entry');
        return;
      }

      const dayResult = this.calculateDayHours(entry, employeeOTRules);
      console.log('Day result:', dayResult);
      
      totalRegularMinutes += dayResult.regularMinutes;
      totalOvertimeMinutes += dayResult.overtimeMinutes;
    });

    console.log('Total results:', { totalRegularMinutes, totalOvertimeMinutes });

    return {
      regularHours: totalRegularMinutes / 60,
      overtimeHours: totalOvertimeMinutes / 60,
      regularMinutes: totalRegularMinutes,
      overtimeMinutes: totalOvertimeMinutes
    };
  }

  // Calculate hours for a single day
  calculateDayHours(dtrEntry, employeeOTRules) {
    let dayRegularMinutes = 0;
    let dayOvertimeMinutes = 0;

    console.log('Calculating day hours for:', dtrEntry);

    // Process Time In 1 to Time Out 1 (if both exist)
    if (dtrEntry.time_in_1 && dtrEntry.time_out_1) {
      const period1 = this.calculatePeriodHours(
        dtrEntry.time_in_1, 
        dtrEntry.time_out_1, 
        employeeOTRules
      );
      dayRegularMinutes += period1.regularMinutes;
      dayOvertimeMinutes += period1.overtimeMinutes;
      console.log('Period 1 result:', period1);
    }

    // Process Time In 2 to Time Out 2 (if both exist)
    if (dtrEntry.time_in_2 && dtrEntry.time_out_2) {
      const period2 = this.calculatePeriodHours(
        dtrEntry.time_in_2, 
        dtrEntry.time_out_2, 
        employeeOTRules
      );
      dayRegularMinutes += period2.regularMinutes;
      dayOvertimeMinutes += period2.overtimeMinutes;
      console.log('Period 2 result:', period2);
    }

    console.log('Final day result:', { dayRegularMinutes, dayOvertimeMinutes });
    return {
      regularMinutes: dayRegularMinutes,
      overtimeMinutes: dayOvertimeMinutes
    };
  }

  // Calculate hours for a single time period
  calculatePeriodHours(timeIn, timeOut, employeeOTRules) {
    console.log('Calculating period:', timeIn, 'to', timeOut);
    
    // Use employee-specific OT rules
    if (employeeOTRules.ot_start_type === 'after_time' && employeeOTRules.ot_start_time) {
      return this.calculateTimeBasedOT(timeIn, timeOut, employeeOTRules);
    }
    
    // Fallback to hours-based OT
    const totalMinutes = this.minutesBetween(timeIn, timeOut);
    return this.calculateHoursBasedOT(totalMinutes, employeeOTRules);
  }

  // Calculate OT based on specific time (e.g., after 17:30 or 18:30)
  calculateTimeBasedOT(timeIn, timeOut, employeeOTRules) {
    const otStartTime = employeeOTRules.ot_start_time; // e.g., "17:30" or "18:30"
    
    let regularMinutes = 0;
    let overtimeMinutes = 0;

    console.log('Time-based OT calculation:', timeIn, 'to', timeOut, 'OT after:', otStartTime);

    // If work ended before OT start time, all is regular
    if (timeOut <= otStartTime) {
      regularMinutes = this.minutesBetween(timeIn, timeOut);
      console.log('All regular (ended before OT):', regularMinutes);
      return { regularMinutes, overtimeMinutes };
    }

    // If work started before OT time, split into regular and OT
    if (timeIn < otStartTime) {
      regularMinutes = this.minutesBetween(timeIn, otStartTime);
      overtimeMinutes = this.minutesBetween(otStartTime, timeOut);
      console.log('Split regular/OT:', regularMinutes, '/', overtimeMinutes);
    } else {
      // If work started after OT time, all is OT
      overtimeMinutes = this.minutesBetween(timeIn, timeOut);
      console.log('All OT (started after OT):', overtimeMinutes);
    }

    // Apply OT threshold
    if (overtimeMinutes < employeeOTRules.ot_threshold_minutes) {
      console.log('OT below threshold, converting to regular');
      regularMinutes += overtimeMinutes;
      overtimeMinutes = 0;
    }

    console.log('Final OT result:', { regularMinutes, overtimeMinutes });
    return { regularMinutes, overtimeMinutes };
  }

  // Calculate OT after working hours
  calculateHoursBasedOT(totalMinutes, employeeOTRules) {
    const regularMinutes = Math.min(totalMinutes, employeeOTRules.regular_hours_minutes || 630);
    let overtimeMinutes = totalMinutes - regularMinutes;

    // Apply OT threshold
    if (overtimeMinutes < employeeOTRules.ot_threshold_minutes) {
      overtimeMinutes = 0;
    }

    return { regularMinutes, overtimeMinutes };
  }

  // Calculate minutes between two times
  minutesBetween(time1, time2) {
    console.log('Calculating minutes between:', time1, 'and', time2);
    
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    
    const date1 = new Date(2000, 0, 1, h1, m1);
    const date2 = new Date(2000, 0, 1, h2, m2);
    
    if (date2 < date1) {
      date2.setDate(date2.getDate() + 1);
    }
    
    const minutes = (date2 - date1) / (1000 * 60);
    console.log('Minutes result:', minutes);
    return minutes;
  }

  // Calculate gross pay
  calculateGrossPay(hoursWorked, payRate, payRateType, employeeOTRules) {
    console.log('Calculating gross pay:', hoursWorked, payRate, payRateType);
    
    let regularPay = 0;
    let overtimePay = 0;

    // Calculate regular pay
    switch (payRateType) {
      case 'daily':
        regularPay = payRate * (hoursWorked.regularHours / 8);
        break;
      case 'hourly':
        regularPay = payRate * hoursWorked.regularHours;
        break;
      case 'monthly':
        regularPay = (payRate / 22) * (hoursWorked.regularHours / 8);
        break;
      default:
        regularPay = payRate * hoursWorked.regularHours;
    }

    // Calculate overtime pay
    overtimePay = payRate * hoursWorked.overtimeHours * (employeeOTRules.regular_day_multiplier || 1.00);

    console.log('Gross pay result:', { regularPay, overtimePay, grossPay: regularPay + overtimePay });

    return {
      regularPay,
      overtimePay,
      grossPay: regularPay + overtimePay
    };
  }
}

// Test function with debug logging
export async function testPayrollComputation() {
  try {
    const computation = new PayrollComputation('test-franchisee');
    
    // Sample DTR data with complete entries
    const sampleDtr = [
      {
        date: '2025-01-01',
        time_in_1: '07:00',
        time_out_1: '18:30', // Complete entry
        time_in_2: '',
        time_out_2: ''
      }
    ];

    // Employee OT rules
    const employeeOTRules = {
      ot_start_type: 'after_time',
      ot_start_time: '17:30',
      ot_threshold_minutes: 10,
      regular_day_multiplier: 1.00
    };

    console.log('=== Starting Payroll Computation Test ===');
    const hoursWorked = computation.calculateHoursWorked(sampleDtr, employeeOTRules);
    console.log('=== Test Completed ===');
    console.log('Final hours worked:', hoursWorked);

    return hoursWorked;
  } catch (error) {
    console.error('Payroll computation test failed:', error);
    return null;
  }
}
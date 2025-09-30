import { useState, useEffect, useRef } from "react";
import { openDB } from "idb";
import { initDB, addData, getAllData, updateData } from "../lib/local-db";

export default function DtrEntry() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [dtrData, setDtrData] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [rawInputs, setRawInputs] = useState({});
  const inputRefs = useRef({});
  const timeoutRefs = useRef({});

  // Load employees from local database
  useEffect(() => {
    async function loadEmployees() {
      const employeeList = await getAllData("employees");
      setEmployees(employeeList);

      if (employeeList.length === 0) {
        const testEmployee = {
          id: "test-1",
          employee_code: "001",
          full_name: "Test Employee",
          position: "Cashier",
          pay_rate: 500.0,
          ot_start_time: "17:30",
        };
        await addData("employees", testEmployee);
        setEmployees([testEmployee]);
        setSelectedEmployee("test-1");
      } else {
        setSelectedEmployee(employeeList[0].id);
      }
    }
    loadEmployees();
  }, []);

  // Initialize DTR data when employee or month changes
  useEffect(() => {
    if (selectedEmployee && selectedMonth) {
      initializeDtrData();
    }
  }, [selectedEmployee, selectedMonth]);

  const initializeDtrData = () => {
    const year = selectedMonth.split("-")[0];
    const month = selectedMonth.split("-")[1];
    const daysInMonth = new Date(year, month, 0).getDate();

    const newDtrData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      newDtrData.push({
        date: `${selectedMonth}-${day.toString().padStart(2, "0")}`,
        time_in_1: "",
        time_out_1: "",
        time_in_2: "",
        time_out_2: "",
      });
    }
    setDtrData(newDtrData);
    setFieldErrors({});
    setRawInputs({});
  };

  // SIMPLE AND RELIABLE time parsing - UPDATED VERSION
  const parseTimeInput = (input) => {
    if (!input) return { success: true, time: "" };

    let cleanInput = input.toString().toLowerCase().trim();

    // Handle already formatted times like "18:30"
    if (/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(cleanInput)) {
      const [hours, minutes] = cleanInput.split(":");
      const formattedTime = `${hours.padStart(2, "0")}:${minutes}`;
      return { success: true, time: formattedTime };
    }

    // Handle 3-4 digit times: "1020", "630", "1830"
    if (/^\d{3,4}$/.test(cleanInput)) {
      const timeStr = cleanInput.padStart(4, "0");
      const hours = parseInt(timeStr.slice(0, 2));
      const minutes = timeStr.slice(2, 4);
      const minutesNum = parseInt(minutes);

      // Validate
      if (hours < 0 || hours > 23)
        return { success: false, error: "Hours must be 0-23" };
      if (minutesNum < 0 || minutesNum > 59)
        return { success: false, error: "Minutes must be 0-59" };

      return {
        success: true,
        time: `${hours.toString().padStart(2, "0")}:${minutes}`,
      };
    }

    // Handle simple numbers: "8", "10", "6", etc.
    if (/^\d{1,2}$/.test(cleanInput)) {
      const hours = parseInt(cleanInput);

      // Validate
      if (hours < 0 || hours > 23)
        return { success: false, error: "Hours must be 0-23" };

      return {
        success: true,
        time: `${hours.toString().padStart(2, "0")}:00`,
      };
    }

    return { success: false, error: "Invalid time format. Use: 8, 1020, 1130" };
  };

  // Helper to check if a field has a valid time
  const hasValidTime = (dayIndex, field) => {
    const value = dtrData[dayIndex][field];
    if (!value) return false;

    const parseResult = parseTimeInput(value);
    return parseResult.success;
  };

  // Handle time input change
  const handleTimeChange = (dayIndex, field, value) => {
    const fieldKey = `${dayIndex}-${field}`;

    // Store what user is typing
    setRawInputs((prev) => ({
      ...prev,
      [fieldKey]: value,
    }));

    // Clear previous timeout
    if (timeoutRefs.current[fieldKey]) {
      clearTimeout(timeoutRefs.current[fieldKey]);
    }

    // Set new timeout - wait 800ms after user stops typing
    timeoutRefs.current[fieldKey] = setTimeout(() => {
      processTimeInput(dayIndex, field, value);
    }, 800);
  };

  // Process the time input after debounce
  const processTimeInput = (dayIndex, field, value) => {
    const newDtrData = [...dtrData];
    const fieldKey = `${dayIndex}-${field}`;

    // Clear previous error
    setFieldErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[fieldKey];
      return newErrors;
    });

    if (!value) {
      newDtrData[dayIndex][field] = "";
      setDtrData(newDtrData);
      setRawInputs((prev) => {
        const newRaw = { ...prev };
        delete newRaw[fieldKey];
        return newRaw;
      });
      return;
    }

    // Parse the input
    const parseResult = parseTimeInput(value);

    if (!parseResult.success) {
      setFieldErrors((prev) => ({
        ...prev,
        [fieldKey]: parseResult.error,
      }));
      return;
    }

    // All valid - update the data
    newDtrData[dayIndex][field] = parseResult.time;
    setDtrData(newDtrData);

    // Clear raw input after successful processing
    setRawInputs((prev) => {
      const newRaw = { ...prev };
      delete newRaw[fieldKey];
      return newRaw;
    });

    // Auto-save to local database
    saveToLocalDB(newDtrData[dayIndex]);
  };

  // Handle keyboard navigation - UPDATED VERSION
  const handleKeyDown = (dayIndex, field, e) => {
    const fields = ["time_in_1", "time_out_1", "time_in_2", "time_out_2"];
    const currentIndex = fields.indexOf(field);

    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();

      const currentInput = inputRefs.current[`${dayIndex}-${field}`];
      if (currentInput) {
        const value = currentInput.value;

        // Only process if there's a value and it's different from what's stored
        if (value && value !== dtrData[dayIndex][field]) {
          processTimeInput(dayIndex, field, value);
        } else if (value && value === dtrData[dayIndex][field]) {
          // If value matches stored data, just clear any error
          const fieldKey = `${dayIndex}-${field}`;
          setFieldErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[fieldKey];
            return newErrors;
          });
        }
      }

      let nextIndex, nextDayIndex;

      if (e.shiftKey) {
        if (currentIndex > 0) {
          nextIndex = currentIndex - 1;
          nextDayIndex = dayIndex;
        } else if (dayIndex > 0) {
          nextIndex = fields.length - 1;
          nextDayIndex = dayIndex - 1;
        } else {
          return;
        }
      } else {
        if (currentIndex < fields.length - 1) {
          nextIndex = currentIndex + 1;
          nextDayIndex = dayIndex;
        } else if (dayIndex < dtrData.length - 1) {
          nextIndex = 0;
          nextDayIndex = dayIndex + 1;
        } else {
          return;
        }
      }

      // Focus the next input
      const nextField = fields[nextIndex];
      const nextInput = inputRefs.current[`${nextDayIndex}-${nextField}`];
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }
  };

  // Save to local database - UPDATED TO HANDLE EXISTING ENTRIES
  const saveToLocalDB = async (dtrEntry) => {
    try {
      const entryWithId = {
        ...dtrEntry,
        id: `${selectedEmployee}-${dtrEntry.date}`,
        employee_id: selectedEmployee,
        franchisee_id: "test-franchisee",
      };

      console.log("🔄 Attempting to save/update DTR entry:", entryWithId);

      // Check if entry already exists
      const allEntries = await getAllData("dtr_entries");
      const existingEntry = allEntries.find(
        (entry) => entry.id === entryWithId.id,
      );

      if (existingEntry) {
        // Update existing entry
        console.log("📝 Updating existing entry");
        await updateData("dtr_entries", entryWithId);
      } else {
        // Create new entry
        console.log("🆕 Creating new entry");
        await addData("dtr_entries", entryWithId);
      }

      console.log("✅ Successfully saved to local DB:", entryWithId);
    } catch (error) {
      console.error("❌ Error saving to local DB:", error);
    }
  };

  // Get field value - show raw input while typing, parsed value when done
  const getFieldValue = (dayIndex, field) => {
    const fieldKey = `${dayIndex}-${field}`;
    return rawInputs[fieldKey] !== undefined
      ? rawInputs[fieldKey]
      : dtrData[dayIndex][field];
  };

  // Get field style based on errors - UPDATED VERSION
  const getFieldStyle = (dayIndex, field, value) => {
    const fieldKey = `${dayIndex}-${field}`;
    const hasError = fieldErrors[fieldKey];
    const isTyping = rawInputs[fieldKey] !== undefined;
    const hasStoredValue = dtrData[dayIndex][field] && !isTyping;

    const baseStyle = {
      width: "100%",
      border: "none",
      padding: "6px",
      fontSize: "14px",
    };

    if (hasError) {
      return {
        ...baseStyle,
        backgroundColor: "#fff0f0",
        border: "2px solid #ff4444",
      };
    }

    if (isTyping) {
      return {
        ...baseStyle,
        backgroundColor: "#ffffe0",
        border: "1px solid #ffcc00",
      };
    }

    if (hasStoredValue) {
      return {
        ...baseStyle,
        backgroundColor: "#f0fff0",
        border: "1px solid #00cc00",
      };
    }

    return baseStyle;
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>DTR Entry</h1>

      {/* Employee Selector */}
      <div style={{ marginBottom: "20px" }}>
        <label>Employee: </label>
        <select
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name} ({emp.position})
            </option>
          ))}
        </select>
      </div>

      {/* Month Selector */}
      <div style={{ marginBottom: "20px" }}>
        <label>Month: </label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {/* DTR Table */}
      {selectedMonth && dtrData.length > 0 && (
        <div>
          <h3>DTR for {selectedMonth}</h3>

          <table
            border="1"
            style={{ borderCollapse: "collapse", width: "100%" }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f0f0f0" }}>
                <th style={{ padding: "8px" }}>Date</th>
                <th style={{ padding: "8px" }}>Time In 1</th>
                <th style={{ padding: "8px" }}>Time Out 1</th>
                <th style={{ padding: "8px" }}>Time In 2</th>
                <th style={{ padding: "8px" }}>Time Out 2</th>
              </tr>
            </thead>
            <tbody>
              {dtrData.map((day, dayIndex) => (
                <tr key={day.date}>
                  <td style={{ padding: "8px", textAlign: "center" }}>
                    {new Date(day.date).getDate()}
                  </td>
                  {["time_in_1", "time_out_1", "time_in_2", "time_out_2"].map(
                    (field) => {
                      const fieldKey = `${dayIndex}-${field}`;
                      const error = fieldErrors[fieldKey];
                      const value = getFieldValue(dayIndex, field);

                      return (
                        <td
                          key={field}
                          style={{ padding: "2px", position: "relative" }}
                        >
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              handleTimeChange(dayIndex, field, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(dayIndex, field, e)}
                            ref={(el) => (inputRefs.current[fieldKey] = el)}
                            style={getFieldStyle(dayIndex, field, value)}
                            placeholder="8, 1020, 1130"
                          />
                          {error && (
                            <div
                              style={{
                                position: "absolute",
                                top: "100%",
                                left: 0,
                                fontSize: "10px",
                                color: "#ff4440",
                                backgroundColor: "#fff0f0",
                                padding: "2px 4px",
                                zIndex: 10,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {error}
                            </div>
                          )}
                        </td>
                      );
                    },
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: "10px", fontSize: "12px", color: "#666" }}>
            💡 <strong>HOW TO USE:</strong>
            <br />
            • Type "7" → 07:00, "1730" → 17:30
            <br />
            • Wait 1 second or press Tab to save
            <br />
            • Green fields = successfully saved
            <br />• Check console for save confirmation
          </div>
        </div>
      )}

      {/* Debug: Show saved DTR entries */}
      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          backgroundColor: "#f5f5f5",
          border: "1px solid #ccc",
        }}
      >
        <h4>Debug: DTR Entries</h4>
        <button
          onClick={async () => {
            const allDtr = await getAllData("dtr_entries");
            console.log("All DTR entries:", allDtr);

            // Show which entries are complete vs incomplete
            const completeEntries = allDtr.filter(
              (entry) => entry.time_out_1 || entry.time_out_2,
            );
            const incompleteEntries = allDtr.filter(
              (entry) => !entry.time_out_1 && !entry.time_out_2,
            );

            alert(
              `DTR Entries: ${allDtr.length} total\nComplete: ${completeEntries.length}\nIncomplete: ${incompleteEntries.length}`,
            );
          }}
          style={{
            marginBottom: "10px",
            padding: "5px 10px",
            marginRight: "10px",
          }}
        >
          Check DTR Database
        </button>
        <button
          onClick={async () => {
            // Manual clear by recreating the database
            const db = await initDB();
            db.close(); // Close current connection

            // Reopen with new version to clear data
            const newDB = await openDB("agui-payroll", 2, {
              upgrade(db) {
                // Recreate stores (this will clear data)
                if (db.objectStoreNames.contains("dtr_entries")) {
                  db.deleteObjectStore("dtr_entries");
                }
                db.createObjectStore("dtr_entries", { keyPath: "id" });

                // Keep other stores
                if (!db.objectStoreNames.contains("employees")) {
                  db.createObjectStore("employees", { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains("franchisees")) {
                  db.createObjectStore("franchisees", { keyPath: "id" });
                }
              },
            });

            alert("DTR database cleared! Please refresh the page.");
          }}
          style={{
            marginBottom: "10px",
            padding: "5px 10px",
            backgroundColor: "#ff4444",
            color: "white",
          }}
        >
          Clear DTR Data (Nuclear Option)
        </button>
        <div style={{ fontSize: "12px", marginTop: "10px" }}>
          <p>
            <strong>Note:</strong> Make sure to enter BOTH time_in and time_out
            fields for payroll calculation.
          </p>
        </div>
      </div>
    </div>
  );
}

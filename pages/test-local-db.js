import { useEffect, useState } from "react";
import { initDB, addData, getAllData } from "../lib/local-db";

export default function TestLocalDB() {
  const [result, setResult] = useState("Testing...");

  useEffect(() => {
    async function testDB() {
      try {
        // Initialize database
        const db = await initDB();

        // Test adding data
        await addData("employees", {
          id: "test-1",
          full_name: "Test Employee",
          pay_rate: 500,
        });

        // Test reading data
        const employees = await getAllData("employees");

        setResult(
          `✅ SUCCESS! Local database working. Employees: ${employees.length}`,
        );
      } catch (error) {
        setResult(`❌ ERROR: ${error.message}`);
      }
    }

    testDB();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Local Database Test</h1>
      <p>{result}</p>
    </div>
  );
}

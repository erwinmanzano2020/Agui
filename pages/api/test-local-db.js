import { initDB, addData, getAllData } from "../../lib/local-db";

export default async function handler(req, res) {
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

    res.status(200).json({
      success: true,
      message: "Local database working!",
      employees: employees,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Local database failed",
      error: error.message,
    });
  }
}

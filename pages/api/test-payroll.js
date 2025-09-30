import { testPayrollComputation } from "../../lib/payroll-computation";

export default async function handler(req, res) {
  try {
    const result = await testPayrollComputation();

    if (result) {
      res.status(200).json({
        success: true,
        message: "Payroll computation test successful!",
        result: result,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Payroll computation test failed",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error testing payroll computation",
      error: error.message,
    });
  }
}

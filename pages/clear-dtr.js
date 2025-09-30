import { useState } from "react";
import { getAllData, deleteData } from "../lib/local-db";

export default function ClearDTR() {
  const [message, setMessage] = useState("");

  const clearIncompleteDTR = async () => {
    try {
      const allDtr = await getAllData("dtr_entries");
      const incompleteEntries = allDtr.filter(
        (entry) => !entry.time_out_1 && !entry.time_out_2,
      );

      console.log("Found incomplete entries:", incompleteEntries);

      for (const entry of incompleteEntries) {
        await deleteData("dtr_entries", entry.id);
      }

      setMessage(
        `✅ Cleared ${incompleteEntries.length} incomplete DTR entries`,
      );
    } catch (error) {
      setMessage("❌ Error clearing DTR: " + error.message);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>Clear Incomplete DTR Entries</h1>
      <button
        onClick={clearIncompleteDTR}
        style={{
          padding: "10px 20px",
          backgroundColor: "#ff4444",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        Clear Incomplete DTR Data
      </button>
      {message && <p>{message}</p>}
      <p>This will remove all DTR entries that have no time_out values.</p>
    </div>
  );
}

import React, { useState } from "react";
import { uid } from "../storage";

export default function ImportCreditMutuel({ onImported }) {
  const [file, setFile] = useState(null);

  function handleImport() {
    if (!file || !window.XLSX) return alert("SheetJS non chargé");

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = window.XLSX.read(data, { type: "array" });

      const sheetName =
        wb.SheetNames.find((n) => n.startsWith("Cpt")) || wb.SheetNames[1];

      const ws = wb.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1 });

      const headerIndex = rows.findIndex((r) => r[0] === "Date");
      const headers = rows[headerIndex];
      const dataRows = rows.slice(headerIndex + 1);

      const ops = dataRows
        .filter((r) => r[0] && r[2])
        .map((r) => {
          const debit = Number(r[3] || 0);
          const credit = Number(r[4] || 0);
          const amount = debit ? -Math.abs(debit) : Math.abs(credit);

          return {
            id: uid(),
            date: new Date(r[0]).toISOString().slice(0, 10),
            amount,
            note: r[2],
            kind: amount < 0 ? "expense" : "income",
          };
        });

      onImported(ops);
      alert(`${ops.length} opérations importées`);
    };

    reader.readAsArrayBuffer(file);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <input type="file" accept=".xls,.xlsx,.xlsm" onChange={(e) => setFile(e.target.files[0])} />
      <button onClick={handleImport}>Importer Crédit Mutuel</button>
    </div>
  );


  <ImportCreditMutuel
  onImported={(ops) => ops.forEach(addOperation)}
/>

}

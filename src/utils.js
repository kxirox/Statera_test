export function formatEUR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0 €";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function toISODate(d) {
  // d: Date
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function currentMonthKey(dateISO) {
  // "YYYY-MM"
  return String(dateISO).slice(0, 7);
}

export function monthLabelFR(monthKey) {
  // monthKey: YYYY-MM
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function escapeCSV(value) {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(expenses) {
  // CSV "stable" + rétro-compatible :
  // - colonne "montant" est SIGNÉE (dépense = négatif)
  // - on ajoute "kind" + "linked_expense_id" pour gérer les remboursements
  const header = ["date", "montant", "kind", "linked_expense_id", "categorie", "banque", "type_compte", "note", "personne"];
  const lines = [header.join(",")];

  for (const e of expenses) {
    const amount = Number(e.amount || 0);
    const signed =
      (e.kind === "expense" || e.kind === "transfer_out")
        ? -Math.abs(amount)
        : Math.abs(amount); // income + reimbursement + transfer_in = positif

    lines.push([
      escapeCSV(e.date),
      escapeCSV(Math.round(signed * 100) / 100),
      escapeCSV(e.kind ?? ""),
      escapeCSV(e.linkedExpenseId ?? ""),
      escapeCSV(e.category),
      escapeCSV(e.bank ?? ""),
      escapeCSV(e.accountType ?? ""),
      escapeCSV(e.note ?? ""),
      escapeCSV(e.person ?? "")
    ].join(","));
  }

  return lines.join("\n");
}

//import * as XLSX from "xlsx";
import { uid } from "./storage";
import { toISODate } from "./utils";
const XLSX = window.XLSX;


function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function isEmptyRow(row) {
  return !row || row.every((c) => String(c ?? "").trim() === "");
}

function pickAccountSheetName(sheetNames) {
  // Prefer the "Cpt ..." sheet, else fallback to 2nd sheet if it exists.
  const byPrefix = sheetNames.find((n) => norm(n).startsWith("cpt "));
  if (byPrefix) return byPrefix;
  if (sheetNames.length >= 2) return sheetNames[1];
  return sheetNames[0] || null;
}

function findHeaderRowIndex(table) {
  // Look for the row that contains at least: Date + Libellé + Débit/Crédit (or variants)
  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (isEmptyRow(row)) continue;

    const cells = row.map((c) => norm(c));
    const hasDate = cells.some((c) => c === "date");
    const hasLabel = cells.some((c) => c.includes("libelle") || c.includes("intitule") || c.includes("operation"));
    const hasDebit = cells.some((c) => c.includes("debit"));
    const hasCredit = cells.some((c) => c.includes("credit"));

    if (hasDate && hasLabel && (hasDebit || hasCredit)) return i;
  }
  return -1;
}

function toJsDate(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

  // Some exports might store dates as numbers
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(d.y, d.m - 1, d.d);
  }

  // Or as strings (dd/mm/yyyy)
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    return new Date(yyyy, mm - 1, dd);
  }

  return null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Parse Crédit Mutuel account export (xls/xlsx/xlsm) into Budget PWA rows.
 *
 * Assumptions based on your file:
 * Columns: Date | Valeur | Libellé | Débit | Crédit | Solde | Dev
 */
export function parseCreditMutuelWorkbook(arrayBuffer, opts = {}) {
  const {
    defaultBank = "Crédit Mutuel",
    defaultAccountType = "Compte courant",
    defaultCategory = "Autres"
  } = opts;

  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  const sheetName = pickAccountSheetName(wb.SheetNames);
  if (!sheetName) return { rows: [], errors: ["Aucun onglet trouvé dans le fichier."] };

  const ws = wb.Sheets[sheetName];
  const table = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });

  const headerIdx = findHeaderRowIndex(table);
  if (headerIdx < 0) {
    return {
      rows: [],
      errors: [
        `Impossible de trouver la ligne d'en-tête (Date/Libellé/Débit/Crédit) dans l'onglet "${sheetName}".`
      ]
    };
  }

  const header = table[headerIdx].map((c) => norm(c));

  const colDate = header.findIndex((c) => c === "date");
  const colLabel = header.findIndex((c) => c.includes("libelle") || c.includes("intitule") || c.includes("operation"));
  const colDebit = header.findIndex((c) => c.includes("debit"));
  const colCredit = header.findIndex((c) => c.includes("credit"));
  const colDev = header.findIndex((c) => c === "dev" || c.includes("devise"));

  if (colDate < 0 || colLabel < 0 || (colDebit < 0 && colCredit < 0)) {
    return {
      rows: [],
      errors: [
        `Colonnes attendues introuvables dans l'onglet "${sheetName}". (date/libellé/débit/crédit)`
      ]
    };
  }

  const rows = [];
  const errors = [];

  for (let i = headerIdx + 1; i < table.length; i++) {
    const r = table[i];
    if (isEmptyRow(r)) continue;

    const d = toJsDate(r[colDate]);
    if (!d) continue; // stop/skip non transaction lines

    const note = String(r[colLabel] ?? "").trim();
    const debit = colDebit >= 0 ? Number(String(r[colDebit] ?? "").replace(",", ".")) : NaN;
    const credit = colCredit >= 0 ? Number(String(r[colCredit] ?? "").replace(",", ".")) : NaN;

    let kind = "";
    let amount = NaN;

    if (Number.isFinite(debit) && debit !== 0) {
      // In your file, debits were negative numbers already.
      kind = "expense";
      amount = Math.abs(debit);
    } else if (Number.isFinite(credit) && credit !== 0) {
      kind = "income";
      amount = Math.abs(credit);
    } else {
      // no amount -> ignore line
      continue;
    }

    const dateISO = toISODate(d);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      errors.push(`Ligne ${i + 1}: date invalide.`);
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const dev = colDev >= 0 ? String(r[colDev] ?? "").trim() : "";

    rows.push({
      id: uid(),
      date: dateISO,
      kind,
      amount: round2(amount),
      category: defaultCategory,
      bank: String(defaultBank || "").trim() || "Crédit Mutuel",
      accountType: String(defaultAccountType || "").trim() || "Compte courant",
      note,
      person: "",
      currency: dev || undefined
    });
  }

  return { rows, errors, meta: { sheetName } };
}

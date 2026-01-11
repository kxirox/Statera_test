import { uid, DEFAULT_BANKS, DEFAULT_ACCOUNT_TYPES } from "./storage";

/**
 * Parse CSV (simple) : séparateur virgule OU point-virgule.
 * Gère les valeurs entre guillemets.
 */
function splitLine(line, sep) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // double quote escape
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === sep) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function detectSeparator(text) {
  // heuristique : si la première ligne a plus de ; que de , => ;
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  return semis > commas ? ";" : ",";
}

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseAmount(v) {
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  // accepte "12,50" ou "12.50"
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  return n;
}

function pick(map, ...keys) {
  for (const k of keys) {
    if (k in map) return map[k];
  }
  return "";
}

export function parseExpensesCSV(text, { defaultBank, defaultAccountType } = {}) {
  const sep = detectSeparator(text);
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["CSV vide ou incomplet."] };

  const headers = splitLine(lines[0], sep).map(normalizeHeader);
  const rows = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep);
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = cols[idx] ?? ""));

    const date = pick(obj, "date", "jour");
    const amountRaw = pick(obj, "montant", "amount", "prix", "valeur");
    const category = pick(obj, "categorie", "category", "cat");
    const note = pick(obj, "note", "libelle", "description");
    const person = pick(obj, "personne", "person", "qui", "who");
    const bank = pick(obj, "banque", "bank") || defaultBank || "Physique";
    const accountType =
      pick(obj, "type_compte", "type_de_compte", "accounttype", "account_type") ||
      defaultAccountType ||
      "Compte courant";

    const kindRaw = String(pick(obj, "kind", "type", "operation_type", "type_operation") || "").trim().toLowerCase();
const linkedExpenseId = String(
  pick(obj, "linked_expense_id", "linkedexpenseid", "expense_id", "depense_id", "linked_to") || ""
).trim() || undefined;

const raw = parseAmount(amountRaw); // peut être négatif (rétro-compat)
let kind = "";
if (["expense", "income", "reimbursement", "transfer_in", "transfer_out"].includes(kindRaw)) {
  kind = kindRaw;
} else if (["depense", "dépense"].includes(kindRaw)) {
  kind = "expense";
} else if (["revenu", "income"].includes(kindRaw)) {
  kind = "income";
} else if (["remboursement", "remboursements", "refund"].includes(kindRaw)) {
  kind = "reimbursement";
} else if (["transfer", "virement", "transfert"].includes(kindRaw)) {
  kind = raw >= 0 ? "transfer_in" : "transfer_out";
} else {
  // rétro-compat : on ne peut pas deviner un virement sans le champ kind
  kind = raw >= 0 ? "income" : "expense";
}

const amount = Math.abs(raw);





    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Ligne ${i + 1}: date invalide "${date}" (attendu YYYY-MM-DD).`);
      continue;
    }
    if (!Number.isFinite(amount)) {
      errors.push(`Ligne ${i + 1}: montant invalide "${amountRaw}".`);
      continue;
    }

    // Montant = 0 -> on ignore la ligne (pas une erreur)
    if (amount === 0) {
      continue;
    }

    // on accepte les banques/types même si nouveaux, mais on garde des valeurs par défaut si vide
    const cleanBank = String(bank || "").trim() || "Physique";
    const cleanType = String(accountType || "").trim() || "Compte courant";
    const safeCategory = String(category || "Autres").trim() || "Autres";

    rows.push({
      id: uid(),
      date,
      kind,
      linkedExpenseId,
      amount: Math.round(amount * 100) / 100,
      category: safeCategory,
      bank: cleanBank,
      accountType: cleanType,
      note: String(note || "").trim(),
      person: String(person || "").trim()
    });

  }

  return { rows, errors };
}

import React, { useEffect, useMemo, useState } from "react";
import { toISODate } from "../utils";

export default function AddExpense({ categories, banks, accountTypes, people = [], expenses = [], onAdd }) {
  const today = useMemo(() => toISODate(new Date()), []);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Autres");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [bank, setBank] = useState(banks[0] ?? "Physique");
  const [accountType, setAccountType] = useState(accountTypes[0] ?? "Compte courant");
  const [toBank, setToBank] = useState(banks[0] ?? "Physique");
  const [toAccountType, setToAccountType] = useState(accountTypes[0] ?? "Compte courant");
  const [kind, setKind] = useState("expense");
  const [person, setPerson] = useState("");
  const [justAdded, setJustAdded] = useState(false);

const expenseOptions = useMemo(() => {
  return (Array.isArray(expenses) ? expenses : [])
    .filter(e => e.kind === "expense")
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 60);
}, [expenses]);

const [linkedExpenseId, setLinkedExpenseId] = useState(() => expenseOptions[0]?.id || "");

useEffect(() => {
  if (kind !== "reimbursement") return;
  if (!linkedExpenseId && expenseOptions[0]?.id) setLinkedExpenseId(expenseOptions[0].id);
  if (
    linkedExpenseId &&
    !expenseOptions.some(e => e.id === linkedExpenseId) &&
    expenseOptions[0]?.id
  ) {
    setLinkedExpenseId(expenseOptions[0].id);
  }
}, [kind, linkedExpenseId, expenseOptions]);

useEffect(() => {
  if (kind !== "reimbursement") return;
  const ex = expenseOptions.find(e => e.id === linkedExpenseId);
  const p = String(ex?.person ?? "").trim();
  if (p && !String(person).trim()) setPerson(p);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [kind, linkedExpenseId]);
 


  function submit(e) {
    e.preventDefault();
    const a = Number(String(amount).replace(",", "."));
    if (!Number.isFinite(a) || a <= 0) {
      alert("Entre un montant valide (> 0).");
      return;
    }
    if (kind === "reimbursement" && !linkedExpenseId) {
      alert("Choisis une dépense à rembourser (ou crée d’abord la dépense).");
      return;
    }
    
    // Virement interne : on envoie un payload spécifique, App.jsx créera 2 écritures
    if (kind === "transfer") {
      if (!bank || !accountType || !toBank || !toAccountType) {
        alert("Choisis un compte source et un compte destination.");
        return;
      }
      if (bank === toBank && accountType === toAccountType) {
        alert("Le compte source et destination sont identiques.");
        return;
      }

      onAdd({
        kind: "transfer",
        amount: Math.round(a * 100) / 100,
        date,
        note: note.trim(),
        fromBank: bank,
        fromAccountType: accountType,
        toBank,
        toAccountType
      });
    } else {
      onAdd({
        kind,
        linkedExpenseId: kind === "reimbursement" ? (linkedExpenseId || undefined) : undefined,
        amount: Math.round(a * 100) / 100,
        category,
        bank,
        accountType,
        date,
        note: note.trim(),
        person: person.trim()
      });
    }

  setAmount("");
  setNote("");
  setPerson("");

  setJustAdded(true);
  setTimeout(() => setJustAdded(false), 1500);

  }

  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>Ajouter une dépense</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label style={styles.label}>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={styles.input}>
            <option value="expense">Dépense</option>
            <option value="income">Revenu</option>
            <option value="reimbursement">Remboursement</option>
            <option value="transfer">Virement interne</option>
          </select>
        </label>

{kind === "reimbursement" && (() => {
  const expenseChoices = expenses
    .filter((x) => x.kind === "expense")
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 80);

  const linked =
    expenseChoices.find((x) => x.id === linkedExpenseId) ||
    expenses.find((x) => x.id === linkedExpenseId);

  return (
    <label style={{ ...styles.label, ...styles.wrapField }}>
      Dépense remboursée
      <select
        value={linkedExpenseId}
        onChange={(e) => setLinkedExpenseId(e.target.value)}
        style={{ ...styles.input, width: "100%", minWidth: 0 }}
      >
        <option value="">— Choisir —</option>

        {expenseChoices.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.date} • {ex.category} • {Number(ex.amount || 0).toFixed(2)}€
          </option>
        ))}
      </select>

      {linked && (
        <div style={{ ...styles.muted, ...styles.wrapText }}>
          {linked.note ? `Note : ${linked.note}` : "Note : (aucune)"}
        </div>
      )}
    </label>
  );
})()}

        <label style={styles.label}>
          Montant (€)
          <input
            inputMode="decimal"
            placeholder="ex: 12,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
          />
        </label>

        {kind !== "transfer" && (
          <label style={styles.label}>
            Catégorie
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}

        {kind !== "transfer" && (
          <label style={styles.label}>
            Personne (optionnel)
            <input
              list="people-list"
              placeholder="ex: Julie"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              style={styles.input}
            />
            <datalist id="people-list">
              {(Array.isArray(people) ? people : []).map(p => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </label>
        )}

        {/* Source / destination pour virement */}
        {kind === "transfer" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={styles.label}>
                Banque (source)
                <select value={bank} onChange={(e) => setBank(e.target.value)} style={styles.input}>
                  <option value="">—</option>
                  {(banks || []).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  {bank && !(banks || []).includes(bank) && <option value={bank}>{bank}</option>}
                </select>
              </label>

              <label style={styles.label}>
                Banque (destination)
                <select value={toBank} onChange={(e) => setToBank(e.target.value)} style={styles.input}>
                  <option value="">—</option>
                  {(banks || []).map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  {toBank && !(banks || []).includes(toBank) && <option value={toBank}>{toBank}</option>}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={styles.label}>
                Type de compte (source)
                <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={styles.input}>
                  <option value="">—</option>
                  {(accountTypes || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {accountType && !(accountTypes || []).includes(accountType) && <option value={accountType}>{accountType}</option>}
                </select>
              </label>

              <label style={styles.label}>
                Type de compte (destination)
                <select value={toAccountType} onChange={(e) => setToAccountType(e.target.value)} style={styles.input}>
                  <option value="">—</option>
                  {(accountTypes || []).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  {toAccountType && !(accountTypes || []).includes(toAccountType) && <option value={toAccountType}>{toAccountType}</option>}
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <label style={styles.label}>
              Banque
              <select value={bank} onChange={(e) => setBank(e.target.value)} style={styles.input}>
                <option value="">—</option>
                {(banks || []).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
                {bank && !(banks || []).includes(bank) && <option value={bank}>{bank}</option>}
              </select>
            </label>

            <label style={styles.label}>
              Type de compte
              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={styles.input}>
                <option value="">—</option>
                {(accountTypes || []).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
                {accountType && !(accountTypes || []).includes(accountType) && <option value={accountType}>{accountType}</option>}
              </select>
            </label>
          </>
        )}



        <label style={styles.label}>
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        </label>

        <label style={styles.label}>
          Note (optionnel)
          <input
            placeholder="ex: Carrefour"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={styles.input}
          />
        </label>

        <button type="submit" style={styles.btn}>Ajouter</button>
        <p style={styles.hint}>
          Astuce : une fois installée, l’app marche offline et garde tes données sur le téléphone.
        </p>

        {justAdded && (
          <div style={{ marginTop: 8, color: "#16a34a", fontWeight: 800 }}>
            Dépense bien ajoutée ✔
          </div>
        )}













      </form>
    </div>
  );
}

const styles = {
  card: {
    margin: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
    overflowX: "hidden",

  },


  wrapField: { minWidth: 0 },
  wrapText: { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" },
  noXScroll: { overflowX: "hidden" },


  h2: { margin: 0, marginBottom: 12, fontSize: 18 },
  label: { display: "grid", gap: 6, fontWeight: 600, fontSize: 13, color: "#111827" },
  input: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    fontSize: 16
  },
  btn: {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontSize: 16,
    fontWeight: 700
  },
  hint: { margin: 0, color: "#6b7280", fontSize: 12, lineHeight: 1.4 }
};

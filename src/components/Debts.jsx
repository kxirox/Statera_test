import React, { useMemo, useState } from "react";
import { formatEUR } from "../utils";

function normalizeName(name) {
  return String(name ?? "").trim();
}

function computeBalances(expenses) {
  const list = Array.isArray(expenses) ? expenses : [];
  const byId = new Map(list.map(e => [e.id, e]));

  // Sum reimbursements linked to each expense id
  const reimbByExpense = new Map();
  for (const e of list) {
    if (e?.kind !== "reimbursement") continue;
    const targetId = e.linkedExpenseId;
    if (!targetId) continue;
    const prev = reimbByExpense.get(targetId) || 0;
    reimbByExpense.set(targetId, prev + Number(e.amount || 0));
  }

  const balances = new Map(); // person -> number (positive = on te doit)

  // 1) Comptable: on rattache les remboursements aux dépenses d'origine
  for (const e of list) {
    if (e?.kind !== "expense") continue;
    const person = normalizeName(e.person);
    if (!person) continue;

    const amount = Number(e.amount || 0);
    const reimb = reimbByExpense.get(e.id) || 0;
    const outstanding = amount - reimb; // peut être négatif si trop remboursé

    const prev = balances.get(person) || 0;
    balances.set(person, prev + outstanding);
  }

  // 2) Remboursements non liés: on les applique sur la personne indiquée
  for (const e of list) {
    if (e?.kind !== "reimbursement") continue;
    if (e.linkedExpenseId) {
      // déjà rattaché si la dépense avait un champ person.
      // Si la dépense n'avait pas de person, on peut utiliser le person du remboursement.
      const target = byId.get(e.linkedExpenseId);
      const targetPerson = normalizeName(target?.person);
      if (targetPerson) continue;
    }

    const person = normalizeName(e.person);
    if (!person) continue;
    const prev = balances.get(person) || 0;
    balances.set(person, prev - Number(e.amount || 0));
  }

  return balances;
}

export default function Debts({ expenses, people, setPeople }) {
  const balances = useMemo(() => computeBalances(expenses), [expenses]);

  const knownPeople = useMemo(() => {
    const fromList = Array.isArray(people) ? people : [];
    const fromOps = Array.from(balances.keys());
    const merged = Array.from(new Set([...fromList, ...fromOps].map(normalizeName).filter(Boolean)));
    merged.sort((a, b) => a.localeCompare(b, "fr"));
    return merged;
  }, [people, balances]);

  const rows = useMemo(() => {
    const out = knownPeople.map(p => ({ person: p, balance: balances.get(p) || 0 }));
    out.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
    return out;
  }, [knownPeople, balances]);

  const toReceive = rows.filter(r => r.balance > 0.005);
  const toGive = rows.filter(r => r.balance < -0.005);

  const totalReceive = toReceive.reduce((s, r) => s + r.balance, 0);
  const totalGive = toGive.reduce((s, r) => s + r.balance, 0);

  const [newPerson, setNewPerson] = useState("");

  function addPerson() {
    const name = normalizeName(newPerson);
    if (!name) return;
    setPeople(prev => {
      const base = Array.isArray(prev) ? prev : [];
      return Array.from(new Set([...base, name]));
    });
    setNewPerson("");
  }

  function removePerson(name) {
    setPeople(prev => (Array.isArray(prev) ? prev.filter(p => normalizeName(p) !== name) : []));
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Dettes & créances</h2>
          <div style={{ color: "#6b7280", fontSize: 12 }}>Positif = on te doit • Négatif = tu dois</div>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div style={styles.kpiRow}>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>À recevoir</div>
              <div style={styles.kpiValue}>{formatEUR(totalReceive)}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>À rendre</div>
              <div style={styles.kpiValue}>{formatEUR(Math.abs(totalGive))}</div>
            </div>
            <div style={styles.kpi}>
              <div style={styles.kpiLabel}>Solde net</div>
              <div style={styles.kpiValue}>{formatEUR(totalReceive + totalGive)}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Balances par personne</h3>

        {rows.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Ajoute une personne sur une dépense ou un remboursement pour voir les balances.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map(r => (
              <div key={r.person} style={styles.personRow}>
                <div style={{ fontWeight: 800 }}>{r.person}</div>
                <div style={{ fontWeight: 800 }}>{formatEUR(r.balance)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Gérer les personnes</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              placeholder="ex: Julie"
              style={{ ...styles.input, flex: 1 }}
            />
            <button onClick={addPerson} style={styles.btn}>Ajouter</button>
          </div>

          {knownPeople.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {knownPeople.map(p => (
                <div key={p} style={styles.manageRow}>
                  <div>{p}</div>
                  <button onClick={() => removePerson(p)} style={styles.btnGhost}>Retirer</button>
                </div>
              ))}
              <div style={{ color: "#6b7280", fontSize: 12 }}>
                Retirer ici ne supprime pas l’historique : ça enlève juste la personne de la liste.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white"
  },
  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10
  },
  kpi: {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 12,
    background: "#f9fafb"
  },
  kpiLabel: { fontSize: 12, color: "#6b7280", fontWeight: 700 },
  kpiValue: { fontSize: 18, fontWeight: 900, marginTop: 4 },
  personRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#ffffff"
  },
  manageRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    background: "#ffffff"
  },
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
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer"
  },
  btnGhost: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 800,
    cursor: "pointer"
  }
};

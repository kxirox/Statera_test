import React, { useMemo, useState } from "react";
import { currentMonthKey, formatEUR, monthLabelFR, toCSV, toISODate } from "../utils";
import { parseExpensesCSV } from "../importCsv";
import { parseCreditMutuelWorkbook } from "../importCreditMutuel";

import ImportCreditMutuel from "./ImportCreditMutuel";


export default function ExpenseList({ expenses, categories, banks, accountTypes, people = [], onDelete, onUpdate, onImport, onCreateReimbursement, onOpenWipeModal }) {
  const [month, setMonth] = useState("ALL");
  const [cat, setCat] = useState("Toutes");
  const [bankFilter, setBankFilter] = useState("Toutes");
  const [accountTypeFilter, setAccountTypeFilter] = useState("Toutes");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("month"); // "month" | "range"
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Import Crédit Mutuel (Excel)
  const [cmBank, setCmBank] = useState(() => (banks?.includes("Crédit Mutuel") ? "Crédit Mutuel" : (banks?.[0] ?? "Crédit Mutuel")));
  const [cmAccountType, setCmAccountType] = useState(() => (accountTypes?.[0] ?? "Compte courant"));
  const [cmDefaultCategory, setCmDefaultCategory] = useState(() => (categories?.includes("Autres") ? "Autres" : (categories?.[0] ?? "Autres")));
  const [cmLastInfo, setCmLastInfo] = useState("");

  // Helper pour ajuster la taille de l'application a un mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  const months = useMemo(() => {
    const set = new Set(expenses.map(e => currentMonthKey(e.date)));
    const arr = Array.from(set);
    arr.sort((a, b) => b.localeCompare(a));
    if (arr.length === 0) return ["ALL"];
    return ["ALL", ...arr];
  }, [expenses]);



  const filtered = useMemo(() => {
    return expenses
      .filter(e => {
        const d = String(e.date || "").trim();

        if (mode === "range") {
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        }

        // mode month
        if (month === "ALL") return true;
        return currentMonthKey(d) === month;
      })
      .filter(e => (cat === "Toutes" ? true : e.category === cat))
      .filter(e => {
        if (bankFilter === "Toutes") return true;
        const b = String(e.bank ?? "Physique");
        return b === bankFilter;
      })
      .filter(e => {
        if (accountTypeFilter === "Toutes") return true;
        const a = String(e.accountType ?? "Compte courant");
        return a === accountTypeFilter;
      })
      .filter(e => {
        if (!q.trim()) return true;
        const s = q.trim().toLowerCase();
        return (
          String(e.note ?? "").toLowerCase().includes(s) ||
          String(e.category ?? "").toLowerCase().includes(s) ||
          String(e.bank ?? "").toLowerCase().includes(s) ||
          String(e.accountType ?? "").toLowerCase().includes(s)
        );
      })
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, month, mode, from, to, cat, bankFilter, accountTypeFilter, q]);

const reimburseByExpenseId = useMemo(() => {
  const map = new Map(); // expenseId -> sum
  for (const e of expenses) {
    if (e.kind !== "reimbursement") continue;
    const id = e.linkedExpenseId;
    if (!id) continue;
    map.set(id, (map.get(id) || 0) + Number(e.amount || 0));
  }
  return map;
}, [expenses]);




const totals = useMemo(() => {
  let income = 0;
  let reimbursements = 0;
  let transfersIn = 0;
  let transfersOut = 0;

  // ✅ "Comptable" : on rattache les remboursements à la dépense d'origine.
  // Donc les dépenses du filtre sont neutralisées même si le remboursement est hors période.
  for (const e of filtered) {
    const a = Number(e.amount || 0);
    if (e.kind === "income") income += a;
    if (e.kind === "reimbursement") reimbursements += a; // total cash dans la période
    if (e.kind === "transfer_in") transfersIn += a;
    if (e.kind === "transfer_out") transfersOut += a;
  }

  let expenseGross = 0;
  let expenseNet = 0;

  for (const e of filtered) {
    if (e.kind !== "expense") continue;
    const a = Number(e.amount || 0);
    expenseGross += a;
    const reimb = reimburseByExpenseId.get(e.id) || 0;
    const net = Math.max(0, a - reimb);
    expenseNet += net;
  }

  return {
    income,
    reimbursements,
    expenseGross,
    expenseNet,
    // Solde bancaire (cash) pour la période : revenus + remboursements + virements entrants - dépenses brutes - virements sortants
    net: income + reimbursements + transfersIn - expenseGross - transfersOut
  };
}, [filtered, reimburseByExpenseId]);

  function exportCSV() {
    const csv = toCSV(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `depenses_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importCSVFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const { rows, errors } = parseExpensesCSV(text);

      if (errors.length) {
        alert("Erreurs dans le CSV :\n\n" + errors.slice(0, 12).join("\n") + (errors.length > 12 ? "\n..." : ""));
        return;
      }
      if (rows.length === 0) {
        alert("Aucune dépense importée.");
        return;
      }

      const ok = confirm(`Importer ${rows.length} dépense(s) ? (elles seront ajoutées à l'historique)`);
      if (!ok) return;

    // Ajoute au début
    // IMPORTANT: onUpdate ne sert pas ici, on a besoin d’un setter => on passe par un callback onImport
    // => on va ajouter une prop onImport ci-dessous.
      onImport(rows);
      console.log("IMPORT pushed rows:", rows.length, rows[0]);
      alert("Import terminé ✅");
    };
    reader.readAsText(file, "utf-8");
  }

  function signatureFor(e) {
    const date = String(e.date || "").trim();
    const kind = String(e.kind || "").trim();
    const amount = Number(e.amount || 0);
    const note = String(e.note || "").trim().toLowerCase();
    return `${date}|${kind}|${amount}|${note}`;
  }

  function importCreditMutuelFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buf = reader.result;
        const { rows, errors, meta } = parseCreditMutuelWorkbook(buf, {
          defaultBank: cmBank,
          defaultAccountType: cmAccountType,
          defaultCategory: cmDefaultCategory
        });

        if (errors?.length) {
          alert(
            "Erreurs lors de la lecture Crédit Mutuel :\n\n" +
              errors.slice(0, 12).join("\n") +
              (errors.length > 12 ? "\n..." : "")
          );
          return;
        }
        if (!rows || rows.length === 0) {
          alert("Aucune transaction détectée dans ce fichier.");
          return;
        }

        // Anti-doublons : date + kind + amount + note
        const existing = new Set(expenses.map(signatureFor));
        const unique = [];
        let skipped = 0;
        for (const r of rows) {
          const sig = signatureFor(r);
          if (existing.has(sig)) {
            skipped++;
          } else {
            existing.add(sig);
            unique.push(r);
          }
        }

        setCmLastInfo(
          `Onglet détecté : ${meta?.sheetName || "?"} • ${rows.length} ligne(s) • ${unique.length} à importer • ${skipped} doublon(s)`
        );

        if (unique.length === 0) {
          alert("Toutes les transactions semblent déjà présentes (doublons). ✅");
          return;
        }

        const ok = confirm(
          `Crédit Mutuel : ${unique.length} transaction(s) à importer (doublons ignorés : ${skipped}).\n\nContinuer ?`
        );
        if (!ok) return;

        onImport(unique);
        alert("Import Crédit Mutuel terminé ✅");
      } catch (e) {
        console.error(e);
        alert("Erreur inattendue pendant l'import Crédit Mutuel.");
      }
    };
    reader.readAsArrayBuffer(file);
  }


  // ---- EDIT MODE ----
  const [editingId, setEditingId] = useState(null);
  const editing = useMemo(() => filtered.find(e => e.id === editingId) ?? null, [filtered, editingId]);
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState(categories[0] ?? "Autres");
  const [editKind, setEditKind] = useState("expense");
  const [editLinkedExpenseId, setEditLinkedExpenseId] = useState("");
  const [editBank, setEditBank] = useState(banks?.[0] ?? "Physique");
  
  // Pour gerer la modification des virements internes
  const [editOriginal, setEditOriginal] = useState(null);
  const [editDestBank, setEditDestBank] = useState(banks?.[0] ?? "Physique");
  const [editDestAccountType, setEditDestAccountType] = useState(accountTypes?.[0] ?? "Compte courant");
  

  const [editAccountType, setEditAccountType] = useState(accountTypes?.[0] ?? "Compte courant");
  const [editDate, setEditDate] = useState(new Date().toISOString().slice(0, 10));
  const [editNote, setEditNote] = useState("");
  const [editPerson, setEditPerson] = useState("");




  function openEdit(e) {
    setEditingId(e.id);
    setEditAmount(String(e.amount ?? ""));
    setEditCategory(e.category ?? (categories[0] ?? "Autres"));
    setEditBank(e.bank ?? (banks?.[0] ?? "Physique"));
    setEditAccountType(e.accountType ?? (accountTypes?.[0] ?? "Compte courant"));
    setEditDate(e.date ?? new Date().toISOString().slice(0, 10));
    setEditNote(e.note ?? "");
    setEditPerson(e.person ?? "");
    setEditKind(e.kind ?? "expense");
    setEditLinkedExpenseId(e.linkedExpenseId ?? "");
    setEditOriginal(e);

    // gestion de l'édition des virements internes
    // Destination par défaut : si possible différent du compte source
    setEditDestBank(
      (banks || []).find((b) => b !== (e.bank ?? banks?.[0])) ?? (banks?.[0] ?? "Physique")
    );
    setEditDestAccountType(
      (accountTypes || []).find((t) => t !== (e.accountType ?? accountTypes?.[0])) ?? (accountTypes?.[0] ?? "Compte courant")
    );


  }

  function closeEdit() {
    setEditingId(null);
  }

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveEdit() {
  const a = Number(String(editAmount).replace(",", "."));
  if (!Number.isFinite(a) || a <= 0) {
    alert("Montant invalide.");
    return;
  }

  const updated = {
    kind: editKind,
    linkedExpenseId: editKind === "reimbursement" ? (editLinkedExpenseId || undefined) : undefined,
    amount: Math.round(a * 100) / 100,
    category: editCategory,
    bank: editBank,
    accountType: editAccountType,
    date: editDate,
    note: editNote.trim(),
    person: String(editPerson || "").trim()
  };

  // ✅ V2: conversion en virement interne => création automatique de l'opération miroir
  const wasTransfer =
    editOriginal && (editOriginal.kind === "transfer_in" || editOriginal.kind === "transfer_out");
  const becomesTransferOut = editKind === "transfer_out";

  if (becomesTransferOut && !wasTransfer) {
    // Empêche "destination = source"
    if (editDestBank === editBank && editDestAccountType === editAccountType) {
      alert("Le compte destination doit être différent du compte source.");
      return;
    }

    const transferId = makeId();

    // 1) Update la ligne actuelle en transfer_out
    onUpdate(editingId, {
      ...updated,
      kind: "transfer_out",
      transferId
    });

    // 2) Crée la ligne miroir transfer_in sur le compte destination
    const mirror = {
      id: makeId(),
      kind: "transfer_in",
      transferId,
      amount: updated.amount,
      category: updated.category, // tu peux aussi mettre "Virement" si tu préfères
      bank: editDestBank,
      accountType: editDestAccountType,
      date: updated.date,
      note: updated.note ? `Virement interne: ${updated.note}` : "Virement interne",
      person: updated.person
    };

    // onImport accepte déjà un tableau de lignes dans ton composant (utilisé pour les imports CSV/CM)
    onImport([mirror]);

    closeEdit();
    return;
  }

  // Comportement normal (pas conversion en virement interne)
  onUpdate(editingId, updated);
  closeEdit();
}
  

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <div style={{ display: "grid", gap: 10 }}>
         <div
            style={{
              ...styles.row2,
              gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))"
            }}
          >
            <label style={styles.label}>
              Catégorie
              <select value={cat} onChange={(e) => setCat(e.target.value)} style={styles.input}>
                <option value="Toutes">Toutes</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={styles.label}>
              Banque
              <select value={bankFilter} onChange={(e) => setBankFilter(e.target.value)} style={styles.input}>
                <option value="Toutes">Toutes</option>
                {(banks || ["Physique"]).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Type de compte
              <select value={accountTypeFilter} onChange={(e) => setAccountTypeFilter(e.target.value)} style={styles.input}>
                <option value="Toutes">Toutes</option>
                {(accountTypes || ["Compte courant"]).map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>

            <label style={styles.label}>
              Filtre
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={styles.input}>
                <option value="month">Par mois</option>
                <option value="range">Par période</option>
              </select>
            </label>

            {mode === "month" ? (
              <label style={styles.label}>
                Mois
                <select value={month} onChange={(e) => setMonth(e.target.value)} style={styles.input}>
                  <option value="ALL">Tous les mois</option>
                  {months.filter(m => m !== "ALL").map(m => (
                    <option key={m} value={m}>{monthLabelFR(m)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label style={styles.label}>
                  Du
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={styles.input} />
                </label>

                <label style={styles.label}>
                  Au
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={styles.input} />
                </label>
              </>
            )}
          </div>

          <label style={styles.label}>
            Recherche (note / catégorie / banque / type)
            <input value={q} onChange={(e) => setQ(e.target.value)} style={styles.input} placeholder="ex: Uber, Revolut..." />
          </label>

          <div style={styles.summary}>
            <div>
              <div style={styles.muted}>Dépenses : {formatEUR(totals.expenseNet)} (brut {formatEUR(totals.expenseGross)})</div>
              <div style={styles.muted}>Revenus : {formatEUR(totals.income)}</div>
              <div style={styles.muted}>Remboursements : {formatEUR(totals.reimbursements)}</div>
              <div style={styles.total}>Solde : {formatEUR(totals.net)}</div>
            </div>

          
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>

            <button onClick={exportCSV} style={styles.btnSecondary}>Exporter CSV</button>

            <label style={styles.btnSecondary}>
                Importer CSV
                <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCSVFile(f);
                    e.target.value = "";
                }}
                />
            </label>

            <div style={{ width: "100%", height: 1, background: "rgba(0,0,0,0.06)", margin: "4px 0" }} />

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ ...styles.label, minWidth: 180 }}>
                Banque (import)
                <select value={cmBank} onChange={(e) => setCmBank(e.target.value)} style={styles.input}>
                  {(banks || ["Crédit Mutuel"]).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ ...styles.label, minWidth: 180 }}>
                Type de compte (import)
                <select value={cmAccountType} onChange={(e) => setCmAccountType(e.target.value)} style={styles.input}>
                  {(accountTypes || ["Compte courant"]).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ ...styles.label, minWidth: 180 }}>
                Catégorie par défaut
                <select value={cmDefaultCategory} onChange={(e) => setCmDefaultCategory(e.target.value)} style={styles.input}>
                  {(categories || ["Autres"]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.btnSecondary}>
                Importer Crédit Mutuel (Excel)
                <input
                  type="file"
                  accept=".xls,.xlsx,.xlsm,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importCreditMutuelFile(f);
                    e.target.value = "";
                  }}
                />
              </label>

              {cmLastInfo ? <div style={{ ...styles.muted, fontSize: 12 }}>{cmLastInfo}</div> : null}
            </div>
            </div>

          
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={styles.empty}>Aucune dépense pour ce filtre.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtered.map(e => (
            <div key={e.id} style={styles.item}>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {formatEUR(
                    (e.kind === "expense" || e.kind === "transfer_out")
                      ? -Number(e.amount || 0)
                      : Number(e.amount || 0)
                  )}
                </div>
{e.kind === "expense" && (() => {
  const reimb = reimburseByExpenseId.get(e.id) || 0;
  if (reimb <= 0) return null;
  const remaining = Math.max(0, Number(e.amount || 0) - reimb);
  return (
    <div style={{ color: "#6b7280", fontSize: 12 }}>
      Remboursé: {formatEUR(reimb)} • Reste: {formatEUR(remaining)}
    </div>
  );
})()}
                <div style={styles.muted}>
                   {e.date} • {e.kind === "income" ? "Revenu" : e.kind === "reimbursement" ? "Remboursement" : (e.kind === "transfer_in" || e.kind === "transfer_out") ? "Virement" : "Dépense"} • {e.category} • {e.bank ?? "Physique"} • {e.accountType ?? "Compte courant"}
                   {String(e.person || "").trim() ? ` • ${String(e.person).trim()}` : ""}
                   {e.note ? ` • ${e.note}` : ""}
                </div>
              </div>

			<div style={{ display: "flex", gap: 8 }}>
			{e.kind === "expense" && typeof onCreateReimbursement === "function" && (
  <button
    onClick={() => {
      const v = prompt("Montant remboursé (€) :", "");
      if (v == null) return;
      const a = Number(String(v).replace(",", "."));
      if (!Number.isFinite(a) || a <= 0) return alert("Montant invalide.");
      const today = toISODate(new Date());
      onCreateReimbursement({
        linkedExpenseId: e.id,
        amount: Math.round(a * 100) / 100,
        date: today,
        bank: e.bank,
        accountType: e.accountType,
        note: `Remboursement : ${e.note || e.category || ""}`.trim(),
        person: e.person
      });
    }}
    style={styles.btnSecondary}
  >
    Remb.
  </button>
)}
                <button onClick={() => openEdit(e)} style={styles.btnEdit}>Éditer</button>

                <button onClick={() => onDelete(e.id)} style={styles.btnDanger}>Suppr.</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal édition */}
      {editing && (
        <div style={styles.modalBackdrop} onClick={closeEdit}>
          <div style={styles.modal} onClick={(ev) => ev.stopPropagation()}>
 
          <label style={styles.label}>
            Type
            <select value={editKind} onChange={(e) => setEditKind(e.target.value)} style={styles.input}>
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
              <option value="reimbursement">Remboursement</option>
              <option value="transfer_out">Virement interne</option>
            </select>
          </label>

{editKind === "transfer_out" && (
  <>
    <label style={styles.label}>
      Compte destination (Banque)
      <select value={editDestBank} onChange={(e) => setEditDestBank(e.target.value)} style={styles.input}>
        {(banks || []).map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>
    </label>

    <label style={styles.label}>
      Compte destination (Type)
      <select value={editDestAccountType} onChange={(e) => setEditDestAccountType(e.target.value)} style={styles.input}>
        {(accountTypes || []).map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>

    <div style={{ fontSize: 12, opacity: 0.8, marginTop: -6 }}>
      L’opération miroir (entrée) sera créée automatiquement sur le compte destination.
    </div>
  </>
)}





{editKind === "reimbursement" && (() => {
  const expenseChoices = expenses
    .filter((x) => x.kind === "expense")
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 80);

  const linked = expenseChoices.find((x) => x.id === editLinkedExpenseId)
    || expenses.find((x) => x.id === editLinkedExpenseId);

  return (
    <label style={{ ...styles.label, ...styles.wrapField }}>
      Dépense remboursée
      <select
        value={editLinkedExpenseId}
        onChange={(e) => setEditLinkedExpenseId(e.target.value)}
        style={{ ...styles.input, width: "100%", minWidth: 0 }}
      >
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

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Modifier la dépense</h3>
              <button onClick={closeEdit} style={styles.btnX}>✕</button>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label style={styles.label}>
                Montant (€)
                <input
                  inputMode="decimal"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                Catégorie
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} style={styles.input}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Personne (optionnel)
                <input
                  list="people-list"
                  value={editPerson}
                  onChange={(e) => setEditPerson(e.target.value)}
                  placeholder="ex: Julie"
                  style={styles.input}
                />
                <datalist id="people-list">
                  {(Array.isArray(people) ? people : []).map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </label>

              <label style={styles.label}>
                Banque
                <select value={editBank} onChange={(e) => setEditBank(e.target.value)} style={styles.input}>
                  {(banks ?? ["Physique"]).map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Type de compte
                <select value={editAccountType} onChange={(e) => setEditAccountType(e.target.value)} style={styles.input}>
                  {(accountTypes ?? ["Compte courant"]).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Date
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={styles.input} />
              </label>

              <label style={styles.label}>
                Note
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)} style={styles.input} />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button onClick={closeEdit} style={styles.btnSecondary}>Annuler</button>
                <button onClick={saveEdit} style={styles.btnPrimary}>Enregistrer</button>
              </div>

              <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.4 }}>
                Astuce : tu peux corriger les anciennes dépenses en changeant Banque/Type ici.
              </div>
            </div>
          </div>
        </div>
      )}

        <div style={{ marginTop: 16 }}>
          <button
            type = "button"
            onClick={onOpenWipeModal}
            style={{
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 12,
              padding: "10px 12px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
            }}
          >
            Supprimer tout l’historique
          </button>
        </div>





    </div>
  );
}

const styles = {
  card: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 },
  label: { display: "grid", gap: 6, fontWeight: 700, fontSize: 12, color: "#111827" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15 },
  summary: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingTop: 4,
  },

  wrapField: { minWidth: 0 },
  wrapText: { whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" },


  total: { fontSize: 20, fontWeight: 900 },
  muted: { color: "#6b7280", fontSize: 12 },
  btnSecondary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "white",
    fontWeight: 800,
  },
  item: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  btnEdit: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ef4444",
    background: "#ef4444",
    color: "white",
    fontWeight: 900,
  },
  empty: { color: "#6b7280", textAlign: "center", padding: 24 },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    zIndex: 50,
    maxHeight: "90vh",       // 👈 ne dépasse jamais l’écran
    overflowY: "auto",    // 👈 scroll interne si trop grand
    overflowX: "hidden",

  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "white",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 14,
    maxHeight: "90vh",       // 👈 ne dépasse jamais l’écran
    overflowY: "auto",      // 👈 scroll interne si trop grand
    overflowX: "hidden",

  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900,
  },
  btnX: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 12,
    padding: "6px 10px",
    fontWeight: 900,
  },
};

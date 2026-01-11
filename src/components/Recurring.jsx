import React, { useMemo, useState } from "react";





function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function ensureNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function Recurring({
  recurring,
  setRecurring,
  categories,
  banks,
  accountTypes
}) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 700;

  // ---- Create form ----
  const [title, setTitle] = useState("Loyer");
  const [kind, setKind] = useState("expense"); // expense|income
  const [amount, setAmount] = useState("320");
  const [category, setCategory] = useState(categories?.[0] ?? "Autres");
  const [bank, setBank] = useState(banks?.[0] ?? "Physique");
  const [accountType, setAccountType] = useState(accountTypes?.[0] ?? "Compte courant");
  const [note, setNote] = useState("");

  const [schedType, setSchedType] = useState("monthly"); // monthly|interval
  const [dayOfMonth, setDayOfMonth] = useState("30");
  const [intervalMonths, setIntervalMonths] = useState("1");
  const [intervalDays, setIntervalDays] = useState("14");
  const [startDate, setStartDate] = useState(todayISO());

  // ---- Edit modal ----
  const [editingId, setEditingId] = useState(null);
  const editing = useMemo(
    () => (editingId ? recurring.find(r => r.id === editingId) ?? null : null),
    [editingId, recurring]
  );

  const [eTitle, setETitle] = useState("");
  const [eKind, setEKind] = useState("expense");
  const [eAmount, setEAmount] = useState("");
  const [eCategory, setECategory] = useState("Autres");
  const [eBank, setEBank] = useState("Physique");
  const [eAccountType, setEAccountType] = useState("Compte courant");
  const [eNote, setENote] = useState("");
  const [eSchedType, setESchedType] = useState("monthly");
  const [eDayOfMonth, setEDayOfMonth] = useState("30");
  const [eIntervalMonths, setEIntervalMonths] = useState("1");
  const [eIntervalDays, setEIntervalDays] = useState("14");
  const [eStartDate, setEStartDate] = useState(todayISO());
  const [eNextDate, setENextDate] = useState("");

  function openEdit(r) {
    setEditingId(r.id);
    setETitle(r.title || "");
    setEKind(r.kind || "expense");
    setEAmount(String(r.amount ?? ""));
    setECategory(r.category || "Autres");
    setEBank(r.bank || "Physique");
    setEAccountType(r.accountType || "Compte courant");
    setENote(r.note || "");
    setESchedType(r.schedule?.type || "monthly");
    setEDayOfMonth(String(r.schedule?.dayOfMonth ?? 30));
    setEIntervalMonths(String(r.schedule?.intervalMonths ?? 1));
    setEIntervalDays(String(r.schedule?.intervalDays ?? 14));
    setEStartDate(r.startDate || todayISO());
    setENextDate(r.nextDate || "");
  }

  function closeEdit() {
    setEditingId(null);
  }

  function createRule() {
    const a = ensureNumber(amount);
    if (!Number.isFinite(a) || a <= 0) return alert("Montant invalide (doit être > 0).");
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return alert("Date de début invalide.");
    if (!title.trim()) return alert("Titre requis.");

    const schedule =
      schedType === "monthly"
        ? {
            type: "monthly",
            dayOfMonth: Math.max(1, Math.min(31, Number(dayOfMonth || 1))),
            intervalMonths: Math.max(1, Number(intervalMonths || 1))
          }
        : {
            type: "interval",
            intervalDays: Math.max(1, Number(intervalDays || 14))
          };

    const id = "rec_" + Math.random().toString(36).slice(2, 10);

    const rule = {
      id,
      title: title.trim(),
      kind,
      amount: Math.round(a * 100) / 100,
      category: (category || "Autres").trim() || "Autres",
      bank: (bank || "Physique").trim() || "Physique",
      accountType: (accountType || "Compte courant").trim() || "Compte courant",
      note: note.trim(),
      schedule,
      startDate,
      nextDate: "", // calculé par applyRecurring au besoin
      active: true
    };

    setRecurring(prev => [rule, ...prev]);

    // reset light
    setTitle("Loyer");
    setAmount("320");
    setNote("");
    alert("Récurrence créée ✅");
  }

  function toggleActive(id) {
    setRecurring(prev => prev.map(r => (r.id === id ? { ...r, active: !r.active } : r)));
  }

  function removeRule(id) {
    if (!confirm("Supprimer cette récurrence ?")) return;
    setRecurring(prev => prev.filter(r => r.id !== id));
  }

  function saveEdit() {
    const a = ensureNumber(eAmount);
    if (!Number.isFinite(a) || a <= 0) return alert("Montant invalide (> 0).");
    if (!eStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(eStartDate)) return alert("Date de début invalide.");
    if (!eTitle.trim()) return alert("Titre requis.");

    const schedule =
      eSchedType === "monthly"
        ? {
            type: "monthly",
            dayOfMonth: Math.max(1, Math.min(31, Number(eDayOfMonth || 1))),
            intervalMonths: Math.max(1, Number(eIntervalMonths || 1))
          }
        : {
            type: "interval",
            intervalDays: Math.max(1, Number(eIntervalDays || 14))
          };

    setRecurring(prev =>
      prev.map(r => {
        if (r.id !== editingId) return r;
        return {
          ...r,
          title: eTitle.trim(),
          kind: eKind,
          amount: Math.round(a * 100) / 100,
          category: (eCategory || "Autres").trim() || "Autres",
          bank: (eBank || "Physique").trim() || "Physique",
          accountType: (eAccountType || "Compte courant").trim() || "Compte courant",
          note: eNote.trim(),
          schedule,
          startDate: eStartDate,
          // nextDate: si tu veux forcer recalcul, vide-le ; sinon on garde celui saisi
          nextDate: eNextDate?.trim() ? eNextDate.trim() : ""
        };
      })
    );

    closeEdit();
    alert("Récurrence modifiée ✅");
  }

  function ruleLabel(r) {
    if (r.schedule?.type === "monthly") {
      const d = r.schedule.dayOfMonth;
      const every = r.schedule.intervalMonths || 1;
      return `Mensuel • le ${d} • tous les ${every} mois`;
    }
    if (r.schedule?.type === "interval") {
      return `Intervalle • tous les ${r.schedule.intervalDays || 14} jours`;
    }
    return "—";
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Ajouter une récurrence</h3>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr"
          }}
        >
          <label style={styles.label}>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={styles.input}>
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </select>
          </label>

          <label style={styles.label}>
            Titre (ex: Loyer)
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} />
          </label>

          <label style={styles.label}>
            Montant
            <input value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} inputMode="decimal" />
          </label>

          <label style={styles.label}>
            Catégorie
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          <label style={styles.label}>
            Banque
            <select value={bank} onChange={(e) => setBank(e.target.value)} style={styles.input}>
              {banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>

          <label style={styles.label}>
            Type de compte
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={styles.input}>
              {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label style={styles.label}>
            Date de début
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={styles.input} />
          </label>

          <label style={styles.label}>
            Mode de récurrence
            <select value={schedType} onChange={(e) => setSchedType(e.target.value)} style={styles.input}>
              <option value="monthly">Mensuel (jour du mois)</option>
              <option value="interval">Toutes les X jours</option>
            </select>
          </label>

          {schedType === "monthly" ? (
            <>
              <label style={styles.label}>
                Jour du mois
                <input value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} style={styles.input} inputMode="numeric" />
              </label>
              <label style={styles.label}>
                Tous les (mois)
                <input value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} style={styles.input} inputMode="numeric" />
              </label>
            </>
          ) : (
            <label style={styles.label}>
              Tous les (jours)
              <input value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} style={styles.input} inputMode="numeric" />
            </label>
          )}
        </div>

        <label style={styles.label}>
          Note (optionnel)
          <input value={note} onChange={(e) => setNote(e.target.value)} style={styles.input} placeholder="ex: prélèvement auto" />
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={createRule} style={styles.btnPrimary}>Ajouter</button>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ margin: 0, marginBottom: 10 }}>Récurrences enregistrées</h3>

        {recurring.length === 0 ? (
          <div style={{ color: "#6b7280", textAlign: "center", padding: 18 }}>
            Aucune récurrence pour le moment.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {recurring.map(r => (
              <div key={r.id} style={styles.item}>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>
                    {r.title} • {r.kind === "income" ? "Revenu" : "Dépense"} • {r.amount}€
                  </div>
                  <div style={styles.muted}>
                    {ruleLabel(r)} • Début: {r.startDate || "—"} • Prochaine: {r.nextDate || "auto"}
                  </div>
                  <div style={styles.muted}>
                    {r.category} • {r.bank} • {r.accountType}{r.note ? ` • ${r.note}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={() => toggleActive(r.id)} style={styles.btnSecondary}>
                    {r.active ? "Actif" : "Inactif"}
                  </button>
                  <button onClick={() => openEdit(r)} style={styles.btnEdit}>Éditer</button>
                  <button onClick={() => removeRule(r.id)} style={styles.btnDanger}>Suppr.</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <div style={styles.modalBackdrop} onClick={closeEdit}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Éditer récurrence</div>
              <button onClick={closeEdit} style={styles.btnX}>✕</button>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 10,
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr"
              }}
            >
              <label style={styles.label}>
                Type
                <select value={eKind} onChange={(e) => setEKind(e.target.value)} style={styles.input}>
                  <option value="expense">Dépense</option>
                  <option value="income">Revenu</option>
                </select>
              </label>

              <label style={styles.label}>
                Titre
                <input value={eTitle} onChange={(e) => setETitle(e.target.value)} style={styles.input} />
              </label>

              <label style={styles.label}>
                Montant
                <input value={eAmount} onChange={(e) => setEAmount(e.target.value)} style={styles.input} inputMode="decimal" />
              </label>

              <label style={styles.label}>
                Catégorie
                <select value={eCategory} onChange={(e) => setECategory(e.target.value)} style={styles.input}>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Banque
                <select value={eBank} onChange={(e) => setEBank(e.target.value)} style={styles.input}>
                  {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Type de compte
                <select value={eAccountType} onChange={(e) => setEAccountType(e.target.value)} style={styles.input}>
                  {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>

              <label style={styles.label}>
                Date de début
                <input type="date" value={eStartDate} onChange={(e) => setEStartDate(e.target.value)} style={styles.input} />
              </label>

              <label style={styles.label}>
                Prochaine date (optionnel)
                <input type="date" value={eNextDate} onChange={(e) => setENextDate(e.target.value)} style={styles.input} />
              </label>

              <label style={styles.label}>
                Mode
                <select value={eSchedType} onChange={(e) => setESchedType(e.target.value)} style={styles.input}>
                  <option value="monthly">Mensuel</option>
                  <option value="interval">Intervalle</option>
                </select>
              </label>

              {eSchedType === "monthly" ? (
                <>
                  <label style={styles.label}>
                    Jour du mois
                    <input value={eDayOfMonth} onChange={(e) => setEDayOfMonth(e.target.value)} style={styles.input} inputMode="numeric" />
                  </label>
                  <label style={styles.label}>
                    Tous les (mois)
                    <input value={eIntervalMonths} onChange={(e) => setEIntervalMonths(e.target.value)} style={styles.input} inputMode="numeric" />
                  </label>
                </>
              ) : (
                <label style={styles.label}>
                  Tous les (jours)
                  <input value={eIntervalDays} onChange={(e) => setEIntervalDays(e.target.value)} style={styles.input} inputMode="numeric" />
                </label>
              )}
            </div>

            <label style={{ ...styles.label, marginTop: 10 }}>
              Note
              <input value={eNote} onChange={(e) => setENote(e.target.value)} style={styles.input} />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button onClick={closeEdit} style={styles.btnSecondary}>Annuler</button>
              <button onClick={saveEdit} style={styles.btnPrimary}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
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
  label: { display: "grid", gap: 6, fontWeight: 800, fontSize: 12, color: "#111827" },
  input: { padding: "12px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15 },
  muted: { color: "#6b7280", fontSize: 12 },
  item: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900
  },
  btnSecondary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "white",
    fontWeight: 900
  },
  btnEdit: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 900
  },
  btnDanger: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ef4444",
    background: "#ef4444",
    color: "white",
    fontWeight: 900
  },
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
    overflowY: "auto"      // 👈 scroll interne si trop grand

  },
  modal: {
    width: "100%",
    maxWidth: 620,
    background: "white",
    borderRadius: 18,
    border: "1px solid #e5e7eb",
    padding: 14,
    maxHeight: "90vh",       // 👈 ne dépasse jamais l’écran
    overflowY: "auto"      // 👈 scroll interne si trop grand
  },
  btnX: {
    border: "1px solid #e5e7eb",
    background: "white",
    borderRadius: 12,
    padding: "6px 10px",
    fontWeight: 900
  }
};

import React, { useMemo, useState, useEffect } from "react";
import { formatEUR, toISODate } from "../utils";
import { uid } from "../storage";
import { previewRecurring } from "../recurring";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartEndISO(baseISO) {
  const [y, m] = String(baseISO).slice(0, 7).split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0); // dernier jour du mois
  return { startISO: toISODate(start), endISO: toISODate(end) };
}

function ensureNumber(v) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

// ✅ Centralise la logique de signe (inclut virements)
function signed(kind, amount) {
  const a = Number(amount || 0);
  if (!Number.isFinite(a)) return 0;

  if (kind === "expense") return -a;

  // virements internes : sortie négative, entrée positive
  if (kind === "transfer_out") return -a;
  if (kind === "transfer_in") return a;

  // income, reimbursement, etc.
  return a;
}

function createStyles(isMobile) {
  return {
    card: {
      background: "white",
      borderRadius: 18,
      border: "1px solid #e5e7eb",
      padding: 14
    },
    cardTitle: { color: "#6b7280", fontSize: 13 },
    big: { fontSize: 22, fontWeight: 800, marginTop: 6 },
    label: { display: "grid", gap: 6, fontSize: 13, color: "#374151" },
    input: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      outline: "none",
      width: "100%",
      minWidth: 0,
      boxSizing: "border-box"
    },
    primary: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid #111827",
      background: "#111827",
      color: "white",
      cursor: "pointer"
    },
    danger: {
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #fecaca",
      background: "#fff1f2",
      color: "#991b1b",
      cursor: "pointer"
    },
    // lignes de liste responsive
    row: isMobile
      ? {
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 8,
          border: "1px solid #f3f4f6",
          borderRadius: 14,
          padding: 10
        }
      : {
          display: "grid",
          gridTemplateColumns: "92px 1fr 120px auto",
          gap: 10,
          alignItems: "center",
          border: "1px solid #f3f4f6",
          borderRadius: 14,
          padding: 10
        }
  };
}

export default function Forecast({
  expenses = [],
  setExpenses,
  recurring = [],
  categories = [],
  banks = [],
  accountTypes = [],
  forecastItems = [],
  setForecastItems,
  forecastSettings,
  setForecastSettings
}) {
  const nowISO = todayISO();
  const { startISO, endISO } = useMemo(() => monthStartEndISO(nowISO), [nowISO]);

  const isMobile = window.matchMedia("(max-width: 520px)").matches;
  const styles = useMemo(() => createStyles(isMobile), [isMobile]);

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("expense");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(nowISO);
  const [category, setCategory] = useState(categories?.[0] || "Autres");
  const [bank, setBank] = useState(banks?.[0] || "Physique");
  const [accountType, setAccountType] = useState(accountTypes?.[0] || "Compte courant");
  const [certainty, setCertainty] = useState("certain");
  const [includePastOnConvert, setIncludePastOnConvert] = useState(false);

  useEffect(() => {
    setCategory((c) => (categories.includes(c) ? c : (categories?.[0] || "Autres")));
  }, [categories]);

  useEffect(() => {
    setBank((b) => (banks.includes(b) ? b : (banks?.[0] || "Physique")));
  }, [banks]);

  useEffect(() => {
    setAccountType((a) => (accountTypes.includes(a) ? a : (accountTypes?.[0] || "Compte courant")));
  }, [accountTypes]);

  const includeCertainty = forecastSettings?.includeCertainty || ["certain", "probable", "optional"];
  const alertThreshold = Number(forecastSettings?.alertThreshold ?? 0);

  const monthItems = useMemo(() => {
    return (forecastItems || [])
      .filter((it) => it?.date >= startISO && it?.date <= endISO)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [forecastItems, startISO, endISO]);

  const monthItemsIncluded = useMemo(() => {
    return monthItems.filter((it) => includeCertainty.includes(it.certainty || "certain"));
  }, [monthItems, includeCertainty]);

  // ✅ FIX ICI : utiliser signed() donc transfer_out est bien négatif
  const balanceToday = useMemo(() => {
    return (expenses || []).reduce((sum, e) => {
      if (!e?.date) return sum;
      if (e.date > nowISO) return sum;
      return sum + signed(e.kind, e.amount);
    }, 0);
  }, [expenses, nowISO]);

  const existingRecurringKeys = useMemo(() => {
    const set = new Set();
    for (const e of expenses || []) {
      if (e?.recurringId && e?.date) set.add(`${e.recurringId}|${e.date}`);
    }
    return set;
  }, [expenses]);

  const recurringPreview = useMemo(() => {
    const prev = previewRecurring(recurring || [], nowISO, endISO) || [];
    return prev.filter((p) => !existingRecurringKeys.has(`${p.recurringId}|${p.date}`));
  }, [recurring, nowISO, endISO, existingRecurringKeys]);

  const projectedDelta = useMemo(() => {
    const itemsDelta = monthItemsIncluded.reduce((sum, it) => sum + signed(it.kind, it.amount), 0);
    const recDelta = recurringPreview.reduce((sum, it) => sum + signed(it.kind, it.amount), 0);
    return itemsDelta + recDelta;
  }, [monthItemsIncluded, recurringPreview]);

  const projectedEndBalance = balanceToday + projectedDelta;

  function addItem() {
    const a = ensureNumber(amount);
    if (!title.trim()) return alert("Titre obligatoire.");
    if (!Number.isFinite(a) || a <= 0) return alert("Montant invalide (> 0).");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return alert("Date invalide.");

    const item = {
      id: uid(),
      title: title.trim(),
      kind,
      amount: Math.round(a * 100) / 100,
      date,
      category: (category || "Autres").trim() || "Autres",
      bank: (bank || "Physique").trim() || "Physique",
      accountType: (accountType || "Compte courant").trim() || "Compte courant",
      certainty,
      note: ""
    };

    setForecastItems((prev) => [item, ...(prev || [])]);
    setTitle("");
    setAmount("");
    setDate(nowISO);
    setCertainty("certain");
  }

  function removeItem(id) {
    if (!confirm("Supprimer cette ligne prévisionnelle ?")) return;
    setForecastItems((prev) => (prev || []).filter((it) => it.id !== id));
  }

  function toggleCert(c) {
    const next = new Set(includeCertainty);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setForecastSettings((prev) => ({ ...(prev || {}), includeCertainty: Array.from(next) }));
  }

  function convertToReal() {
    if (typeof setExpenses !== "function") {
      alert("Erreur: setExpenses manquant.");
      return;
    }

    const candidates = monthItems
      .filter((it) => includeCertainty.includes(it.certainty || "certain"))
      .filter((it) => (includePastOnConvert ? true : it.date >= nowISO));

    if (candidates.length === 0) {
      alert("Aucune ligne à convertir (vérifie les filtres de certitude / dates).");
      return;
    }

    const msg =
      `Convertir ${candidates.length} ligne(s) prévisionnelle(s) en opérations réelles dans l’historique ?\n\n` +
      `Elles seront ajoutées dans l’onglet Historique et supprimées du prévisionnel.`;
    if (!confirm(msg)) return;

    const created = candidates.map((it) => ({
      id: uid(),
      kind: it.kind === "income" ? "income" : "expense",
      amount: Math.abs(Number(it.amount || 0)),
      category: (it.category || "Autres").trim() || "Autres",
      bank: (it.bank || "Physique").trim() || "Physique",
      accountType: (it.accountType || "Compte courant").trim() || "Compte courant",
      date: it.date,
      note: (it.note || "").trim(),
      person: ""
    }));

    setExpenses((prev) => [...created, ...(prev || [])]);
    const ids = new Set(candidates.map((c) => c.id));
    setForecastItems((prev) => (prev || []).filter((it) => !ids.has(it.id)));
  }

  return (
    <div style={{ padding: 14, display: "grid", gap: 12, overflowX: "hidden" }}>
      <h2 style={{ margin: "4px 0 0" }}>Budget prévisionnel</h2>
      <div style={{ color: "#6b7280", fontSize: 14 }}>
        Mois en cours : <b>{startISO} → {endISO}</b>
      </div>

      {/* ✅ 3 cartes : 1 colonne sur mobile */}
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)"
        }}
      >
        <div style={styles.card}>
          <div style={styles.cardTitle}>Solde (jusqu’à aujourd’hui)</div>
          <div style={styles.big}>{formatEUR(balanceToday)}</div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Projection fin de mois</div>
          <div style={styles.big}>{formatEUR(projectedEndBalance)}</div>
          <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>
            Prévisionnel + récurrents : {formatEUR(projectedDelta)}
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>Alerte seuil</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={String(alertThreshold)}
              onChange={(e) =>
                setForecastSettings((prev) => ({ ...(prev || {}), alertThreshold: e.target.value }))
              }
              onBlur={() => {
                const n = ensureNumber(alertThreshold);
                const clean = Number.isFinite(n) ? n : 0;
                setForecastSettings((prev) => ({ ...(prev || {}), alertThreshold: clean }));
              }}
              style={{ ...styles.input, maxWidth: 110 }}
              inputMode="decimal"
            />
            <span style={{ color: "#6b7280", fontSize: 13 }}>€ (solde fin de mois &lt; seuil)</span>
          </div>

          {projectedEndBalance < Number(alertThreshold || 0) && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b"
              }}
            >
              ⚠️ Alerte : projection sous le seuil ({formatEUR(alertThreshold)}).
            </div>
          )}
        </div>
      </div>

      <div style={styles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "baseline"
          }}
        >
          <h3 style={{ margin: 0 }}>Ajouter une ligne prévisionnelle</h3>
          <div style={{ color: "#6b7280", fontSize: 13 }}>Ces lignes n’impactent pas l’historique réel.</div>
        </div>

        {/* ✅ Form : 1 colonne sur mobile */}
        <div
          style={{
            display: "grid",
            gap: 10,
            marginTop: 10,
            gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.7fr 0.7fr"
          }}
        >
          <label style={styles.label}>
            Titre
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={styles.input}
              placeholder="Ex: Assurance"
            />
          </label>

          <label style={styles.label}>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={styles.input}>
              <option value="expense">Dépense</option>
              <option value="income">Revenu</option>
            </select>
          </label>

          <label style={styles.label}>
            Montant (€)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} style={styles.input} inputMode="decimal" />
          </label>

          <label style={styles.label}>
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
          </label>

          <label style={styles.label}>
            Certitude
            <select value={certainty} onChange={(e) => setCertainty(e.target.value)} style={styles.input}>
              <option value="certain">Certain</option>
              <option value="probable">Probable</option>
              <option value="optional">Optionnel</option>
            </select>
          </label>

          <label style={styles.label}>
            Catégorie
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
              {(categories || ["Autres"]).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Banque
            <select value={bank} onChange={(e) => setBank(e.target.value)} style={styles.input}>
              {(banks || ["Physique"]).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </label>

          <label style={styles.label}>
            Type de compte
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} style={styles.input}>
              {(accountTypes || ["Compte courant"]).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button onClick={addItem} style={styles.primary}>Ajouter</button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Filtres de certitude</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {["certain", "probable", "optional"].map((c) => (
            <label key={c} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={includeCertainty.includes(c)} onChange={() => toggleCert(c)} />
              <span style={{ textTransform: "capitalize" }}>{c}</span>
            </label>
          ))}
        </div>
      </div>

      <div style={styles.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "baseline"
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: 0 }}>Lignes prévisionnelles du mois</h3>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "#6b7280", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={includePastOnConvert}
                onChange={(e) => setIncludePastOnConvert(e.target.checked)}
              />
              Inclure les lignes passées
            </label>
            <button onClick={convertToReal} style={styles.primary}>
              Convertir en opérations réelles
            </button>
          </div>
        </div>

        {monthItems.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Aucune ligne pour ce mois.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {monthItems.map((it) => {
              const included = includeCertainty.includes(it.certainty || "certain");
              const s = signed(it.kind, it.amount);
              return (
                <div key={it.id} style={{ ...styles.row, opacity: included ? 1 : 0.5 }}>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{it.date}</div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{it.title}</div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {it.category} • {it.bank} • {it.accountType} • {it.certainty}
                    </div>
                  </div>

                  {!isMobile && (
                    <>
                      <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatEUR(s)}
                      </div>
                      <button onClick={() => removeItem(it.id)} style={styles.danger}>Supprimer</button>
                    </>
                  )}

                  {isMobile && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatEUR(s)}</div>
                      <button onClick={() => removeItem(it.id)} style={styles.danger}>Supprimer</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <h3 style={{ marginTop: 0 }}>Récurrents à venir (aperçu)</h3>
        {recurringPreview.length === 0 ? (
          <div style={{ color: "#6b7280" }}>Aucun récurrent à venir sur la fin du mois.</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {recurringPreview
              .slice()
              .sort((a, b) => String(a.date).localeCompare(String(b.date)))
              .map((it) => (
                <div key={it.id} style={styles.row}>
                  <div style={{ fontVariantNumeric: "tabular-nums" }}>{it.date}</div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{it.title}</div>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>
                      {it.category} • {it.bank} • {it.accountType}
                    </div>
                  </div>

                  {!isMobile && (
                    <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {formatEUR(signed(it.kind, it.amount))}
                    </div>
                  )}

                  {isMobile && (
                    <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                      {formatEUR(signed(it.kind, it.amount))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";

/**
 * Règles de recatégorisation :
 * { id, keyword, category, enabled, matchMode: "contains" | "word" }
 *
 * - contains : note contient le mot-clé (insensible à la casse)
 * - word     : match "mot entier" (frontières de mots)
 */

function normalizeText(s) {
  return String(s || "").toLowerCase();
}

function buildWordRegex(keyword) {
  // échappe les caractères spéciaux regex
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // frontières de mots "souples" : début/fin ou non-lettre/chiffre
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
}

function ruleMatches(rule, note) {
  const kw = String(rule?.keyword || "").trim();
  if (!kw) return false;
  const n = String(note || "");
  if (!n) return false;

  if (rule.matchMode === "word") {
    try {
      return buildWordRegex(kw).test(n);
    } catch {
      // fallback
      return normalizeText(n).includes(normalizeText(kw));
    }
  }
  return normalizeText(n).includes(normalizeText(kw));
}

function getTargetCategoryForExpense(exp, rules) {
  const note = exp?.note ?? "";
  for (const r of rules || []) {
    if (!r?.enabled) continue;
    if (ruleMatches(r, note)) return r.category;
  }
  return null;
}

export default function AutoCategorize({
  expenses,
  setExpenses,
  categories,
  rules,
  setRules
}) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState(categories?.[0] ?? "Autres");
  const [matchMode, setMatchMode] = useState("contains");
  const [includeIncome, setIncludeIncome] = useState(true);

  // keep selected category valid
  React.useEffect(() => {
    if (!categories?.includes(category)) {
      setCategory(categories?.[0] ?? "Autres");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  function addRule() {
    const kw = keyword.trim();
    if (!kw) return;
    if (!category) return;

    const exists = (rules || []).some(
      (r) => String(r.keyword || "").trim().toLowerCase() === kw.toLowerCase()
    );
    if (exists) {
      alert("Ce mot-clé existe déjà dans tes règles.");
      return;
    }

    const r = {
      id: String(Date.now()) + "_" + Math.random().toString(16).slice(2),
      keyword: kw,
      category,
      enabled: true,
      matchMode
    };
    setRules([r, ...(rules || [])]);
    setKeyword("");
  }

  function toggleRule(id) {
    setRules((prev) =>
      (prev || []).map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  }

  function deleteRule(id) {
    const ok = confirm("Supprimer cette règle ?");
    if (!ok) return;
    setRules((prev) => (prev || []).filter((r) => r.id !== id));
  }

  function updateRule(id, patch) {
    setRules((prev) => (prev || []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const eligibleExpenses = useMemo(() => {
    const list = Array.isArray(expenses) ? expenses : [];
    return list.filter((e) => {
      const k = String(e?.kind || "expense");
      if (k.startsWith("transfer")) return false;
      if (k === "reimbursement") return false;
      if (k === "income") return includeIncome;
      return k === "expense"; // par défaut
    });
  }, [expenses, includeIncome]);

  const preview = useMemo(() => {
    const enabledRules = (rules || []).filter((r) => r.enabled);
    const changes = [];

    for (const e of eligibleExpenses) {
      const target = getTargetCategoryForExpense(e, enabledRules);
      if (!target) continue;
      const current = String(e.category || "");
      if (current !== target) {
        changes.push({
          id: e.id,
          date: e.date,
          note: e.note,
          from: current,
          to: target,
          amount: e.amount,
          kind: e.kind
        });
      }
    }
    return { changes, enabledRulesCount: enabledRules.length };
  }, [eligibleExpenses, rules]);

  function apply() {
    if (preview.changes.length === 0) {
      alert("Aucun changement à appliquer.");
      return;
    }
    const ok = confirm(
      `Appliquer ${preview.changes.length} recatégorisation(s) ?\n\nConseil : fais une sauvegarde Drive/CSV avant si besoin.`
    );
    if (!ok) return;

    const enabledRules = (rules || []).filter((r) => r.enabled);

    setExpenses((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.map((e) => {
        // mêmes règles d'éligibilité que preview
        const k = String(e?.kind || "expense");
        if (k.startsWith("transfer")) return e;
        if (k === "reimbursement") return e;
        if (k === "income" && !includeIncome) return e;
        if (k !== "expense" && k !== "income") return e;

        const target = getTargetCategoryForExpense(e, enabledRules);
        if (!target) return e;
        if (String(e.category || "") === target) return e;
        return { ...e, category: target };
      });
    });
  }

  return (
    <div style={styles.card}>
      <div style={styles.h2}>Recatégorisation automatique (par mots-clés)</div>

      <div style={styles.muted}>
        Ajoute des règles du type <b>"carrefour" → Alimentation</b>. Ensuite, tu peux prévisualiser
        les changements et appliquer en 1 clic.
      </div>

      <div style={{ height: 10 }} />

      <div style={styles.row}>
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={styles.input}
          placeholder='Mot-clé (ex: carrefour, sncf, pharmacie...)'
        />

        <select value={category} onChange={(e) => setCategory(e.target.value)} style={styles.input}>
          {(categories || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select value={matchMode} onChange={(e) => setMatchMode(e.target.value)} style={styles.input}>
          <option value="contains">Contient</option>
          <option value="word">Mot entier</option>
        </select>

        <button type="button" style={styles.btn} onClick={addRule}>
          Ajouter règle
        </button>
      </div>

      <div style={{ height: 10 }} />

      <div style={styles.row}>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={includeIncome}
            onChange={(e) => setIncludeIncome(e.target.checked)}
          />
          <span>Appliquer aussi aux revenus</span>
        </label>
      </div>

      <div style={{ height: 14 }} />

      <div style={styles.h3}>Règles</div>
      {(rules || []).length === 0 ? (
        <div style={styles.muted}>Aucune règle pour l’instant.</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {(rules || []).map((r) => (
            <div key={r.id} style={styles.rule}>
              <div style={styles.ruleLeft}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <label style={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={r.enabled !== false}
                      onChange={() => toggleRule(r.id)}
                    />
                    <span style={{ fontWeight: 900 }}>{r.keyword}</span>
                  </label>

                  <span style={styles.arrow}>→</span>

                  <select
                    value={r.category}
                    onChange={(e) => updateRule(r.id, { category: e.target.value })}
                    style={{ ...styles.input, padding: "8px 10px", minWidth: 170 }}
                  >
                    {(categories || []).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <select
                    value={r.matchMode || "contains"}
                    onChange={(e) => updateRule(r.id, { matchMode: e.target.value })}
                    style={{ ...styles.input, padding: "8px 10px", minWidth: 140 }}
                  >
                    <option value="contains">Contient</option>
                    <option value="word">Mot entier</option>
                  </select>
                </div>

                <div style={styles.muted}>
                  {r.enabled === false ? "Désactivée" : "Activée"} • match{" "}
                  {r.matchMode === "word" ? "mot entier" : "contient"}
                </div>
              </div>

              <button type="button" style={styles.btnDanger} onClick={() => deleteRule(r.id)}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 14 }} />

      <div style={styles.h3}>Prévisualisation</div>
      <div style={styles.muted}>
        Règles actives : <b>{preview.enabledRulesCount}</b> • Changements détectés :{" "}
        <b>{preview.changes.length}</b>
      </div>

      <div style={{ height: 10 }} />

      {preview.changes.length === 0 ? (
        <div style={styles.muted}>Rien à changer pour l’instant.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>Note</th>
                <th style={styles.th}>De</th>
                <th style={styles.th}>Vers</th>
              </tr>
            </thead>
            <tbody>
              {preview.changes.slice(0, 20).map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.date}</td>
                  <td style={styles.td}>{String(c.note || "").slice(0, 70)}</td>
                  <td style={styles.td}>{c.from}</td>
                  <td style={styles.td}><b>{c.to}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.changes.length > 20 ? (
            <div style={{ ...styles.muted, marginTop: 8 }}>
              Affichage limité à 20 lignes (mais l’application appliquera tout).
            </div>
          ) : null}
        </div>
      )}

      <div style={{ height: 12 }} />

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" style={styles.btn} onClick={apply}>
          Appliquer les changements
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: { padding: 14, borderRadius: 16, border: "1px solid #e5e7eb", background: "white" },
  h2: { fontSize: 16, fontWeight: 900, marginBottom: 6 },
  h3: { fontSize: 14, fontWeight: 900, marginBottom: 6 },
  muted: { color: "#6b7280", fontSize: 12, lineHeight: 1.3 },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15, flex: "1 1 180px" },
  btn: { padding: "12px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900 },
  btnDanger: { padding: "10px 12px", borderRadius: 12, border: "1px solid #ef4444", background: "white", color: "#ef4444", fontWeight: 900 },
  rule: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  ruleLeft: { display: "grid", gap: 6, flex: 1, minWidth: 0 },
  arrow: { fontWeight: 900, color: "#111827" },
  checkbox: { display: "flex", gap: 8, alignItems: "center", fontSize: 14 },
  tableWrap: { border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 10px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "10px 10px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" }
};

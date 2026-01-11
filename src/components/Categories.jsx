import React, { useState } from "react";

export default function Categories({ categories, onSetCategories }) {
  const [newCat, setNewCat] = useState("");

  function add() {
    const c = newCat.trim();
    if (!c) return;
    if (categories.map(x => x.toLowerCase()).includes(c.toLowerCase())) {
      alert("Cette catégorie existe déjà.");
      return;
    }
    onSetCategories([...categories, c]);
    setNewCat("");
  }

  function remove(cat) {
    if (!confirm(`Supprimer la catégorie "${cat}" ? (Les dépenses existantes garderont le nom.)`)) return;
    onSetCategories(categories.filter(c => c !== cat));
  }

  return (
    <div style={{ padding: 12, display: "grid", gap: 12 }}>
      <div style={styles.card}>
        <h2 style={{ margin: 0, marginBottom: 10 }}>Catégories</h2>

        <div style={{ display: "grid", gap: 10 }}>
          <div style={styles.row}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              style={styles.input}
              placeholder="Nouvelle catégorie (ex: Animaux)"
            />
            <button onClick={add} style={styles.btn}>Ajouter</button>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {categories.map(c => (
              <div key={c} style={styles.item}>
                <div style={{ fontWeight: 800 }}>{c}</div>
                <button onClick={() => remove(c)} style={styles.btnDanger}>Suppr.</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ color: "#6b7280", fontSize: 12, lineHeight: 1.45 }}>
          Note : supprimer une catégorie ne modifie pas les anciennes dépenses.  
          (Tu peux la recréer si besoin.)
        </div>




      </div>
    </div>
  );
}

const styles = {
  card: { padding: 14, borderRadius: 16, border: "1px solid #e5e7eb", background: "white" },
  row: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10 },
  input: { padding: "12px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15 },
  btn: { padding: "12px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900 },
  item: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  btnDanger: { padding: "10px 12px", borderRadius: 12, border: "1px solid #ef4444", background: "#ef4444", color: "white", fontWeight: 900 }
};

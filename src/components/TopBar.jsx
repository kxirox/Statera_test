import React from "react";

export default function TopBar({ tab, setTab }) {
  const tabs = [
    { key: "add", label: "Ajouter" },
    { key: "list", label: "Historique" },
    { key: "stats", label: "Stats" },
    { key: "forecast", label: "Prévisionnel" },
    { key: "debts", label: "Dettes" },
    { key: "cats", label: "Catégories" },
    { key: "recurring", label: "Récurrent" },
    { key: "settings", label: "Paramètres" }   
    
  ];


  return (
    <div style={styles.bar}>
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          style={{
            ...styles.tab,
            ...(tab === t.key ? styles.tabActive : null)
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    padding: 12,
    position: "sticky",
    top: 0,
    background: "white",
    borderBottom: "1px solid #e5e7eb",
    zIndex: 10
  },
  tab: {
    padding: "10px 8px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 600,
    fontSize: 13
  },
  tabActive: {
    background: "#111827",
    color: "white",
    borderColor: "#111827"
  }
};

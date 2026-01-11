import { useMemo, useState } from "react";

const styles = {
  card: { padding: 14, borderRadius: 16, border: "1px solid #e5e7eb", background: "white" },
  h2: { fontSize: 16, fontWeight: 900, marginBottom: 10 },
  row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  input: { padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15, flex: "1 1 220px" },
  btn: { padding: "10px 12px", borderRadius: 12, border: "1px solid #111827", background: "#111827", color: "white", fontWeight: 900 },
  btnLight: { padding: "10px 12px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", fontWeight: 900 },
  item: { display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 14, border: "1px solid #e5e7eb", background: "white" },
  left: { display: "grid", gap: 6, flex: 1, minWidth: 0 },
  muted: { color: "#6b7280", fontSize: 12 },
};

function uniqClean(arr) {
  return Array.from(new Set((arr || []).map((s) => String(s || "").trim()).filter(Boolean)));
}

function ListEditor({ title, items, setItems, usedValues = [] }) {
  const [newItem, setNewItem] = useState("");
  const usedSet = useMemo(
    () => new Set(usedValues.map((x) => String(x || "").trim()).filter(Boolean)),
    [usedValues]
  );

  function add() {
    const v = String(newItem || "").trim();
    if (!v) return;
    setItems((prev) => uniqClean([...(prev || []), v]).sort((a, b) => a.localeCompare(b)));
    setNewItem("");
  }

  function rename(oldValue) {
    const next = prompt(`Renommer "${oldValue}" en :`, oldValue);
    const v = String(next || "").trim();
    if (!v || v === oldValue) return;
    setItems((prev) =>
      uniqClean((prev || []).map((x) => (x === oldValue ? v : x))).sort((a, b) => a.localeCompare(b))
    );
  }

  function remove(value) {
    if (usedSet.has(value)) {
      const ok = confirm(
        `"${value}" est utilisée dans l'historique.\n\nSi tu la supprimes de la liste, les anciennes opérations garderont la valeur, mais elle ne sera plus proposée.\n\nContinuer ?`
      );
      if (!ok) return;
    } else {
      const ok = confirm(`Supprimer "${value}" ?`);
      if (!ok) return;
    }
    setItems((prev) => (prev || []).filter((x) => x !== value));
  }

  return (
    <div style={styles.card}>
      <div style={styles.h2}>{title}</div>

      <div style={{ ...styles.row, marginBottom: 12 }}>
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          style={styles.input}
          placeholder={`Ajouter une valeur (ex: ${title === "Banques" ? "Revolut" : "Courant"})`}
        />
        <button style={styles.btn} onClick={add} type="button">
          Ajouter
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {(items || []).length === 0 ? (
          <div style={styles.muted}>Aucune valeur. Tu peux en ajouter ci-dessus.</div>
        ) : (
          (items || []).map((it) => (
            <div key={it} style={styles.item}>
              <div style={styles.left}>
                <div style={{ fontWeight: 900, wordBreak: "break-word" }}>{it}</div>
                {usedSet.has(it) && <div style={styles.muted}>Utilisé dans l’historique</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={styles.btnLight} type="button" onClick={() => rename(it)}>
                  Renommer
                </button>
                <button
                  style={{ ...styles.btnLight, borderColor: "#ef4444", color: "#ef4444" }}
                  type="button"
                  onClick={() => remove(it)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ManageLists({
  banks,
  setBanks,
  accountTypes,
  setAccountTypes,
  expenses,
  onConnectDrive,
  onBackupNow,
  onRestoreNow,
  driveStatus,
}) {

  const usedBanks = (expenses || []).map((e) => e.bank);
  const usedTypes = (expenses || []).map((e) => e.accountType);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ListEditor title="Banques" items={banks} setItems={setBanks} usedValues={usedBanks} />
      <ListEditor title="Types de compte" items={accountTypes} setItems={setAccountTypes} usedValues={usedTypes} />

      <div style={styles.card}>
        <div style={styles.h2}>Sauvegarde Google Drive</div>

        {driveStatus ? <div style={{ ...styles.muted, marginBottom: 8 }}>{driveStatus}</div> : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={styles.btn} onClick={onConnectDrive} type="button">
            Connecter Google Drive
          </button>

          <button style={styles.btnLight} onClick={onBackupNow} type="button">
            Sauvegarder maintenant
          </button>

          <button style={styles.btnLight} onClick={onRestoreNow} type="button">
            Restaurer depuis Drive
          </button>

        </div>
      </div>
    </div>
  );
}

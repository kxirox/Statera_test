import { uid } from "./storage";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysInMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function addDays(dateISO, days) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function addMonthsKeepingDay(dateISO, monthsToAdd, desiredDay) {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  dt.setMonth(dt.getMonth() + monthsToAdd);
  const year = dt.getFullYear();
  const month1to12 = dt.getMonth() + 1;
  const maxDay = daysInMonth(year, month1to12);
  const day = Math.min(Math.max(1, Number(desiredDay || d || 1)), maxDay);
  const final = new Date(year, month1to12 - 1, day);
  return final.toISOString().slice(0, 10);
}

function cmpISO(a, b) {
  // returns -1/0/1
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function advanceDate(rule, dateISO) {
  const s = rule.schedule || {};
  if (s.type === "monthly") {
    const step = Math.max(1, Number(s.intervalMonths || 1));
    const day = Math.max(1, Number(s.dayOfMonth || 1));
    return addMonthsKeepingDay(dateISO, step, day);
  }
  if (s.type === "interval") {
    const step = Math.max(1, Number(s.intervalDays || 14));
    return addDays(dateISO, step);
  }
  return dateISO;
}

/**
 * Applique les règles récurrentes:
 * - génère toutes les occurrences "due" jusqu'à nowISO
 * - évite les doublons grâce à recurringId + date
 * Retourne { nextExpenses, nextRules, addedCount }
 */
export function applyRecurring(rules, expenses, nowISO = todayISO()) {
  let nextExpenses = Array.isArray(expenses) ? expenses.slice() : [];
  let nextRules = Array.isArray(rules) ? rules.map(r => ({ ...r })) : [];
  let addedCount = 0;

  // index anti-doublon (recurringId|date)
  const seen = new Set(
    nextExpenses
      .filter(e => e && e.recurringId && e.date)
      .map(e => `${e.recurringId}|${e.date}`)
  );

  for (const r of nextRules) {
    if (!r) continue;

    const startDate = (r.startDate && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate))
      ? r.startDate
      : nowISO;

    if (!r.nextDate || !/^\d{4}-\d{2}-\d{2}$/.test(r.nextDate)) {
      r.nextDate = startDate;
    }

    if (!r.active) continue;

    // si startDate est dans le futur, on ne fait rien
    if (cmpISO(r.nextDate, nowISO) === 1) continue;

    // génère toutes les occurrences dues
    let guard = 0;
    while (cmpISO(r.nextDate, nowISO) <= 0) {
      const key = `${r.id}|${r.nextDate}`;
      if (!seen.has(key)) {
        const e = {
          id: uid(),
          title: String(r.title || "").trim() || "Récurrent",
          kind: r.kind || "expense",
          amount: Math.round(Number(r.amount || 0) * 100) / 100,
          category: String(r.category || "Autres").trim() || "Autres",
          bank: String(r.bank || "Physique").trim() || "Physique",
          accountType: String(r.accountType || "Compte courant").trim() || "Compte courant",
          date: r.nextDate,
          note: String(r.note || "").trim(),
          recurringId: r.id
        };
        nextExpenses = [e, ...nextExpenses];
        seen.add(key);
        addedCount++;
      }

      const next = advanceDate(r, r.nextDate);
      if (next === r.nextDate) break;
      r.nextDate = next;

      guard++;
      if (guard > 2000) break; // sécurité anti-boucle
    }
  }

  return { nextExpenses, nextRules, addedCount };
}

/**
 * Génère des occurrences récurrentes "virtuelles" dans une plage [fromISO, toISO]
 * (ne modifie pas les règles, ne touche pas aux dépenses réelles)
 */
export function previewRecurring(rules, fromISO, toISO) {
  const out = [];
  const list = Array.isArray(rules) ? rules : [];
  if (!fromISO || !toISO) return out;

  for (const r0 of list) {
    if (!r0 || !r0.active) continue;

    const r = { ...r0 };
    const startDate = (r.startDate && /^\d{4}-\d{2}-\d{2}$/.test(r.startDate))
      ? r.startDate
      : fromISO;

    let cursor = (r.nextDate && /^\d{4}-\d{2}-\d{2}$/.test(r.nextDate))
      ? r.nextDate
      : startDate;

    // avance jusqu'à fromISO
    let guard = 0;
    while (cmpISO(cursor, fromISO) < 0) {
      const next = advanceDate(r, cursor);
      if (next === cursor) break;
      cursor = next;
      guard++;
      if (guard > 2000) break;
    }

    // génère dans la plage
    guard = 0;
    while (cmpISO(cursor, toISO) <= 0) {
      if (cmpISO(cursor, fromISO) >= 0) {
        out.push({
          id: `prev_${r.id}_${cursor}`,
          title: String(r.title || "").trim() || "Récurrent",
          kind: r.kind || "expense",
          amount: Math.round(Number(r.amount || 0) * 100) / 100,
          category: String(r.category || "Autres").trim() || "Autres",
          bank: String(r.bank || "Physique").trim() || "Physique",
          accountType: String(r.accountType || "Compte courant").trim() || "Compte courant",
          date: cursor,
          note: String(r.note || "").trim(),
          recurringId: r.id,
          isRecurringPreview: true
        });
      }
      const next = advanceDate(r, cursor);
      if (next === cursor) break;
      cursor = next;
      guard++;
      if (guard > 2000) break;
    }
  }

  return out;
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

const intersect = (a, b) => {
  const out = [];
  for (const [s1, e1] of a) for (const [s2, e2] of b) {
    const s = Math.max(s1, s2);
    const e = Math.min(e1, e2);
    if (e - s >= 30) out.push([s, e]);
  }
  return out;
};

export const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Pickup slots valid for ALL given farmers on `date`, mirroring the backend's rules:
// operating day, pickup windows (default 09:00-17:00 if none set) and order cut-off.
export function computeSlots(farmers, date) {
  if (!date || !farmers.length) return [];
  const d = new Date(`${date}T00:00:00`);
  if (isNaN(d)) return [];
  const day = DAY_NAMES[d.getDay()];

  let intervals = [[0, 1440]];
  for (const f of farmers) {
    if (f.operatingDays?.length && !f.operatingDays.includes(day)) return [];
    const windows = (f.pickupWindows || []).filter((w) => w.day === day).map((w) => [toMin(w.start), toMin(w.end)]);
    intervals = intersect(intervals, windows.length ? windows : [[540, 1020]]);
  }

  const cutoffMs = Math.max(...farmers.map((f) => f.cutoffHours ?? 0)) * 3600 * 1000;
  const slots = [];
  for (const [s, e] of intervals) {
    for (let t = s; t + 30 <= e; t += 60) {
      const end = Math.min(t + 60, e);
      if (new Date(`${date}T${fmt(t)}:00`).getTime() - cutoffMs > Date.now()) slots.push({ start: fmt(t), end: fmt(end) });
    }
  }
  return slots;
}

export const fmtIDR = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

export const fmtCompactIDR = (n: number) => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}IDR ${(abs / 1e9).toFixed(2)} B`;
  if (abs >= 1e6) return `${sign}IDR ${(abs / 1e6).toFixed(1)} M`;
  if (abs >= 1e3) return `${sign}IDR ${(abs / 1e3).toFixed(0)} K`;
  return `${sign}IDR ${abs}`;
};

export const fmtPct = (n: number, d = 1) => `${n.toFixed(d)}%`;
export const fmtInt = (n: number) => n.toLocaleString("en-US");

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export const relativeTime = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

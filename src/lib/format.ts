const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatMoney(cents: number): string {
  return brlFormatter.format(cents / 100);
}

/** Converte entrada humana ("1.250,50", "1250.50", "45") para centavos */
export function parseMoneyToCents(raw: string): number {
  const cleaned = raw.trim().replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    normalized = cleaned.replace(",", ".");
  }

  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

export function centsToInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function defaultDateForMonth(month: string): string {
  const today = getTodayIso();
  if (today.startsWith(month)) return today;
  return `${month}-01`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [yStr, mStr] = ym.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = ((total % 12) + 12) % 12 + 1;
  return `${String(newYear).padStart(4, "0")}-${String(newMonth).padStart(2, "0")}`;
}

export function formatMonthLabel(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  const idx = Number(mStr) - 1;
  const name = MONTH_NAMES[idx] ?? mStr;
  return `${name} ${yStr}`;
}

export function formatDateBR(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatDateTimeBR(sqliteDateTime: string): string {
  const [datePart, timePart] = sqliteDateTime.split(" ");
  if (!datePart) return sqliteDateTime;
  const dateParts = datePart.split("-");
  const shortDate =
    dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : datePart;
  const shortTime = timePart ? timePart.slice(0, 5) : "";
  return shortTime ? `${shortDate} · ${shortTime}` : shortDate;
}

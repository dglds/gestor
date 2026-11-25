import type { ReactNode } from "react";

type StatTone =
  | "surface"
  | "primary"
  | "secondary"
  | "paid"
  | "pending"
  | "income"
  | "expense";

interface StatCardProps {
  label: string;
  value: string;
  sublabel?: string;
  tone?: StatTone;
  emphasized?: boolean;
  icon?: ReactNode;
}

const SOLID_BG: Record<StatTone, React.CSSProperties> = {
  surface: { backgroundColor: "#FFFFFF", color: "#111111" },
  primary: {
    backgroundColor: "var(--color-primary)",
    color: "var(--color-primary-ink)",
  },
  secondary: {
    backgroundColor: "var(--color-secondary)",
    color: "var(--color-secondary-ink)",
  },
  paid: { backgroundColor: "var(--status-paid)", color: "#111111" },
  pending: { backgroundColor: "var(--status-pending)", color: "#111111" },
  income: { backgroundColor: "var(--status-income)", color: "#111111" },
  expense: { backgroundColor: "var(--status-expense)", color: "#111111" },
};

const ICON_BG: Record<StatTone, string> = {
  surface: "#EFECE3",
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  paid: "var(--status-paid)",
  pending: "var(--status-pending)",
  income: "var(--status-income)",
  expense: "var(--status-expense)",
};

export function StatCard({
  label,
  value,
  sublabel,
  tone = "surface",
  emphasized = false,
  icon,
}: StatCardProps) {
  const cardStyle = emphasized
    ? SOLID_BG[tone]
    : { backgroundColor: "#FFFFFF", color: "#111111" };

  return (
    <div
      style={cardStyle}
      className="h-full nb-border nb-shadow p-4 flex flex-col justify-start"
    >
      <div className="flex items-center justify-between gap-2 min-h-[1.75rem]">
        <span className="text-[11px] font-black uppercase tracking-wider opacity-85">
          {label}
        </span>
        {icon && (
          <span
            style={
              emphasized
                ? undefined
                : { backgroundColor: ICON_BG[tone], color: "#111111" }
            }
            className={
              emphasized
                ? "w-7 h-7 flex items-center justify-center shrink-0 opacity-90"
                : "w-7 h-7 border-2 border-[#111111] flex items-center justify-center shrink-0"
            }
          >
            {icon}
          </span>
        )}
      </div>
      <div className="font-money text-2xl font-extrabold tracking-tight leading-none mt-2.5">
        {value}
      </div>
      <div className="text-xs font-semibold opacity-75 leading-tight mt-2 min-h-[1rem]">
        {sublabel ?? ""}
      </div>
    </div>
  );
}

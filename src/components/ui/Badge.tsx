import type { ReactNode } from "react";

type BadgeTone =
  | "primary"
  | "secondary"
  | "paid"
  | "pending"
  | "income"
  | "expense"
  | "neutral";

interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

const TONE_STYLES: Record<BadgeTone, React.CSSProperties> = {
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
  neutral: { backgroundColor: "#EFECE3", color: "#111111" },
};

export function Badge({ tone = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span
      style={TONE_STYLES[tone]}
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider border-2 border-[#111111] ${className}`}
    >
      {children}
    </span>
  );
}

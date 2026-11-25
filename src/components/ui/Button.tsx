import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "surface"
  | "paid"
  | "danger"
  | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

const VARIANT_STYLES: Record<ButtonVariant, { className: string; style?: React.CSSProperties }> = {
  primary: {
    className: "nb-border nb-shadow-sm nb-press-sm font-bold",
    style: {
      backgroundColor: "var(--color-primary)",
      color: "var(--color-primary-ink)",
    },
  },
  secondary: {
    className: "nb-border nb-shadow-sm nb-press-sm font-bold",
    style: {
      backgroundColor: "var(--color-secondary)",
      color: "var(--color-secondary-ink)",
    },
  },
  surface: {
    className: "nb-border nb-shadow-sm nb-press-sm bg-white text-[#111111] font-bold",
  },
  paid: {
    className: "nb-border nb-shadow-sm nb-press-sm font-bold text-[#111111]",
    style: { backgroundColor: "var(--status-paid)" },
  },
  danger: {
    className: "nb-border nb-shadow-sm nb-press-sm font-bold text-[#111111]",
    style: { backgroundColor: "var(--status-expense)" },
  },
  ghost: {
    className:
      "border-2 border-transparent hover:border-[#111111] hover:bg-white font-semibold text-[#111111] transition-colors",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  style,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  return (
    <button
      type={type}
      style={{ ...v.style, ...style }}
      className={`inline-flex items-center justify-center uppercase tracking-wide cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_CLASSES[size]} ${v.className} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

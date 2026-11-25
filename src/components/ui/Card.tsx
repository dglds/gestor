import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  headerAction?: ReactNode;
  accent?: "none" | "primary" | "secondary";
  className?: string;
  children: ReactNode;
}

export function Card({
  title,
  headerAction,
  accent = "none",
  className = "",
  children,
}: CardProps) {
  const headerStyle: React.CSSProperties | undefined =
    accent === "primary"
      ? { backgroundColor: "var(--color-primary)", color: "var(--color-primary-ink)" }
      : accent === "secondary"
        ? { backgroundColor: "var(--color-secondary)", color: "var(--color-secondary-ink)" }
        : undefined;

  return (
    <section className={`bg-white nb-border nb-shadow flex flex-col ${className}`}>
      {(title || headerAction) && (
        <header
          style={headerStyle}
          className="flex items-center justify-between gap-4 px-5 py-3 min-h-[3.25rem] border-b-[2.5px] border-[#111111]"
        >
          {title && (
            <h3 className="text-sm font-black uppercase tracking-wider leading-tight">
              {title}
            </h3>
          )}
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </header>
      )}
      <div className="p-5 flex-1">{children}</div>
    </section>
  );
}

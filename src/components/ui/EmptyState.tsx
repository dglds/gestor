import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border-[2.5px] border-dashed border-[#111111] bg-[#FAF8F3] p-7 text-center space-y-2">
      <p className="text-sm font-black uppercase tracking-wider">{title}</p>
      {description && (
        <p className="text-xs font-medium text-[#525252] max-w-sm mx-auto">
          {description}
        </p>
      )}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

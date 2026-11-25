import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatMonthLabel, getCurrentMonth, shiftMonth } from "../../lib/format";
import { Button } from "./Button";

interface MonthPickerProps {
  month: string;
  onChange: (month: string) => void;
}

export function MonthPicker({ month, onChange }: MonthPickerProps) {
  const current = getCurrentMonth();
  const isCurrent = month === current;

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center bg-white nb-border nb-shadow-sm">
        <button
          type="button"
          onClick={() => onChange(shiftMonth(month, -1))}
          aria-label="Mês anterior"
          className="px-2.5 py-2 border-r-[2.5px] border-[#111111] hover:bg-[#EFECE3] cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="min-w-[164px] text-center px-3 py-1.5 text-sm font-black uppercase tracking-wider">
          {formatMonthLabel(month)}
        </span>
        <button
          type="button"
          onClick={() => onChange(shiftMonth(month, 1))}
          aria-label="Próximo mês"
          className="px-2.5 py-2 border-l-[2.5px] border-[#111111] hover:bg-[#EFECE3] cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      {!isCurrent && (
        <Button variant="surface" size="sm" onClick={() => onChange(current)}>
          Hoje
        </Button>
      )}
    </div>
  );
}

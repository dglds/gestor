import { PAYMENT_METHODS, type PaymentMethod } from "../../lib/types";

interface PaymentMethodPillsProps {
  label?: string;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

const SHORT_LABELS: Record<PaymentMethod, string> = {
  PIX: "PIX",
  Dinheiro: "Dinheiro",
  Boleto: "Boleto",
  Cartão: "Cartão",
  Transferência: "Transf.",
};

export function PaymentMethodPills({
  label = "Forma de pagamento",
  value,
  onChange,
}: PaymentMethodPillsProps) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-extrabold uppercase tracking-wider text-[#111111]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {PAYMENT_METHODS.map((method) => {
          const active = value === method;
          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(method)}
              style={
                active
                  ? {
                      backgroundColor: "var(--color-primary)",
                      color: "var(--color-primary-ink)",
                    }
                  : undefined
              }
              className={`px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide border-2 border-[#111111] cursor-pointer transition-all ${
                active
                  ? "nb-shadow-sm"
                  : "bg-white hover:bg-[#FAF8F3]"
              }`}
            >
              {SHORT_LABELS[method]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

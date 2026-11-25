import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Input({ label, hint, className = "", id, ...rest }: InputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={inputId} className="block space-y-1.5">
      <span className="block text-xs font-extrabold uppercase tracking-wider text-[#111111]">
        {label}
      </span>
      <input
        id={inputId}
        className={`w-full px-3 py-2 text-sm font-semibold bg-white text-[#111111] border-[2.5px] border-[#111111] focus:outline-none focus:shadow-[3px_3px_0px_#111111] transition-shadow ${className}`}
        {...rest}
      />
      {hint && <span className="block text-xs text-[#4A4A4A]">{hint}</span>}
    </label>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export function Select({ label, className = "", id, children, ...rest }: SelectProps) {
  const selectId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={selectId} className="block space-y-1.5">
      <span className="block text-xs font-extrabold uppercase tracking-wider text-[#111111]">
        {label}
      </span>
      <select
        id={selectId}
        className={`w-full px-3 py-2 text-sm font-semibold bg-white text-[#111111] border-[2.5px] border-[#111111] focus:outline-none focus:shadow-[3px_3px_0px_#111111] transition-shadow ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

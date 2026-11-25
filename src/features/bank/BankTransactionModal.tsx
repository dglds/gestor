import { useEffect, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { api } from "../../lib/api";
import {
  centsToInputValue,
  defaultDateForMonth,
  parseMoneyToCents,
} from "../../lib/format";
import type {
  BankTransaction,
  Category,
  CategoryKind,
  PaymentMethod,
} from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/FormField";
import { Modal } from "../../components/ui/Modal";
import { PaymentMethodPills } from "../../components/ui/PaymentMethodPills";

interface BankTransactionModalProps {
  open: boolean;
  month: string;
  categories: Category[];
  initialKind: CategoryKind;
  editing: BankTransaction | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (msg: string) => void;
}

export function BankTransactionModal({
  open,
  month,
  categories,
  initialKind,
  editing,
  onClose,
  onSaved,
  onError,
}: BankTransactionModalProps) {
  const [kind, setKind] = useState<CategoryKind>(initialKind);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDateForMonth(month));
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind);
      setTitle(editing.title);
      setAmount(centsToInputValue(editing.amountCents));
      setDate(editing.date);
      setCategoryId(editing.categoryId ? String(editing.categoryId) : "");
      setPaymentMethod(editing.paymentMethod);
      setPaid(editing.paid);
      setNotes(editing.notes ?? "");
      setShowNotes(Boolean(editing.notes));
    } else {
      setKind(initialKind);
      setTitle("");
      setAmount("");
      setDate(defaultDateForMonth(month));
      const defaultCat = categories.find((c) => c.kind === initialKind);
      setCategoryId(defaultCat ? String(defaultCat.id) : "");
      setPaymentMethod("PIX");
      setPaid(true);
      setNotes("");
      setShowNotes(false);
    }
  }, [open, editing, initialKind, month, categories]);

  const filteredCategories = categories.filter((c) => c.kind === kind);

  const switchKind = (nextKind: CategoryKind) => {
    setKind(nextKind);
    const first = categories.find((c) => c.kind === nextKind);
    setCategoryId(first ? String(first.id) : "");
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const amountCents = parseMoneyToCents(amount);
    if (!title.trim() || amountCents <= 0 || !date) {
      onError("Informe descrição, valor maior que zero e data.");
      return;
    }

    try {
      const payload = {
        kind,
        title: title.trim(),
        amountCents,
        date,
        categoryId: categoryId ? Number(categoryId) : null,
        paymentMethod,
        paid,
        notes: notes.trim() || null,
      };
      if (editing) {
        await api.updateBankTransaction({ id: editing.id, ...payload });
      } else {
        await api.createBankTransaction(payload);
      }
      onClose();
      await onSaved();
    } catch (err) {
      onError(String(err));
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? "Editar lançamento" : kind === "income" ? "Nova entrada" : "Nova saída"}
      onClose={onClose}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => switchKind("income")}
            style={
              kind === "income"
                ? { backgroundColor: "var(--status-income)" }
                : undefined
            }
            className={`py-2.5 text-xs font-black uppercase tracking-wider nb-border cursor-pointer ${
              kind === "income" ? "nb-shadow-sm" : "bg-white hover:bg-[#FAF8F3]"
            }`}
          >
            + Entrada
          </button>
          <button
            type="button"
            onClick={() => switchKind("expense")}
            style={
              kind === "expense"
                ? { backgroundColor: "var(--status-expense)" }
                : undefined
            }
            className={`py-2.5 text-xs font-black uppercase tracking-wider nb-border cursor-pointer ${
              kind === "expense" ? "nb-shadow-sm" : "bg-white hover:bg-[#FAF8F3]"
            }`}
          >
            - Saída
          </button>
        </div>

        <Input
          label="Descrição"
          placeholder={
            kind === "income"
              ? "Ex: Venda balcão, Serviço cliente..."
              : "Ex: Fornecedor, Pró-labore, Taxa..."
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Valor (R$)"
            placeholder="250,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <Input
            label="Data"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <PaymentMethodPills
          label={kind === "income" ? "Recebido via" : "Pago via"}
          value={paymentMethod}
          onChange={setPaymentMethod}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          <Select
            label="Categoria"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Sem categoria</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <label className="flex items-center gap-2.5 h-[41px] px-3 bg-[#FAF8F3] border-[2.5px] border-[#111111] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="w-4 h-4 accent-[#111111]"
            />
            <span className="text-xs font-extrabold uppercase tracking-wider">
              {kind === "income" ? "Já recebido" : "Já pago"}
            </span>
          </label>
        </div>

        {showNotes ? (
          <Input
            label="Observação"
            placeholder="Cliente, nota fiscal..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-[#525252] hover:text-[#111111] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Observação
          </button>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="surface" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit">Salvar</Button>
        </div>
      </form>
    </Modal>
  );
}

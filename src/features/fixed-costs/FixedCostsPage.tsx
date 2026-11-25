import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { api } from "../../lib/api";
import {
  centsToInputValue,
  formatDateBR,
  formatMoney,
  parseMoneyToCents,
} from "../../lib/format";
import type {
  Category,
  FixedCost,
  FixedCostEntry,
  PaymentMethod,
} from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input, Select } from "../../components/ui/FormField";
import { Modal } from "../../components/ui/Modal";
import { PaymentMethodPills } from "../../components/ui/PaymentMethodPills";
import { StatCard } from "../../components/ui/StatCard";

interface FixedCostsPageProps {
  month: string;
  categories: Category[];
  onError: (msg: string) => void;
}

export function FixedCostsPage({ month, categories, onError }: FixedCostsPageProps) {
  const [entries, setEntries] = useState<FixedCostEntry[]>([]);
  const [templates, setTemplates] = useState<FixedCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaused, setShowPaused] = useState(false);

  // Modal unificado (criar / editar recorrência ou valor pontual do mês)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FixedCostEntry | null>(null);
  const [editScope, setEditScope] = useState<"recurring" | "single">("recurring");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("20");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Boleto");

  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [e, t] = await Promise.all([
        api.listFixedCostEntries(month),
        api.listFixedCosts(),
      ]);
      setEntries(e);
      setTemplates(t);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }, [month, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const pausedTemplates = templates.filter((t) => !t.active);

  const openCreate = () => {
    setEditingEntry(null);
    setEditScope("recurring");
    setTitle("");
    setAmount("");
    setDueDay("20");
    setCategoryId(expenseCategories[0] ? String(expenseCategories[0].id) : "");
    setPaymentMethod("Boleto");
    setModalOpen(true);
  };

  const openEdit = (entry: FixedCostEntry) => {
    const tpl = templateMap.get(entry.fixedCostId);
    setEditingEntry(entry);
    setEditScope("recurring");
    setTitle(tpl?.title ?? entry.title);
    setAmount(centsToInputValue(entry.amountCents));
    setDueDay(String(tpl?.dueDay ?? entry.dueDay));
    setCategoryId(
      (tpl?.categoryId ?? entry.categoryId)
        ? String(tpl?.categoryId ?? entry.categoryId)
        : ""
    );
    setPaymentMethod(tpl?.paymentMethod ?? entry.paymentMethod);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const amountCents = parseMoneyToCents(amount);

    if (editingEntry && editScope === "single") {
      if (amountCents <= 0) {
        onError("Informe um valor maior que zero.");
        return;
      }
      try {
        await api.updateFixedCostEntryAmount(editingEntry.id, amountCents);
        setModalOpen(false);
        await load();
      } catch (err) {
        onError(String(err));
      }
      return;
    }

    const day = Number.parseInt(dueDay, 10);
    if (!title.trim() || amountCents <= 0 || Number.isNaN(day) || day < 1 || day > 31) {
      onError("Informe descrição, valor válido e dia entre 1 e 31.");
      return;
    }

    try {
      const catId = categoryId ? Number(categoryId) : null;
      if (editingEntry) {
        await api.updateFixedCost({
          id: editingEntry.fixedCostId,
          title: title.trim(),
          amountCents,
          dueDay: day,
          categoryId: catId,
          paymentMethod,
          currentMonth: month,
        });
      } else {
        await api.createFixedCost({
          title: title.trim(),
          amountCents,
          dueDay: day,
          categoryId: catId,
          paymentMethod,
          startMonth: month,
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleTogglePaid = async (entryId: number) => {
    try {
      await api.toggleFixedCostEntryPaid(entryId);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleToggleActive = async (fixedCostId: number) => {
    try {
      await api.toggleFixedCostActive(fixedCostId);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleDelete = async (fixedCostId: number) => {
    try {
      await api.deleteFixedCost(fixedCostId);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const totalCents = entries.reduce((sum, item) => sum + item.amountCents, 0);
  const paidCents = entries
    .filter((i) => i.paid)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const pendingCents = totalCents - paidCents;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <StatCard
          label="Total do mês"
          value={formatMoney(totalCents)}
          icon={<Repeat className="w-4 h-4" />}
        />
        <StatCard
          label="Pago"
          value={formatMoney(paidCents)}
          tone="paid"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          label="Falta pagar"
          value={formatMoney(pendingCents)}
          tone="pending"
          icon={<Clock className="w-4 h-4" />}
        />
      </div>

      <Card
        title="Contas do mês"
        headerAction={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Novo fixo
          </Button>
        }
      >
        {loading && entries.length === 0 ? (
          <p className="text-sm font-bold">Carregando...</p>
        ) : entries.length === 0 ? (
          <EmptyState
            title="Nenhuma conta fixa neste mês"
            action={
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Novo fixo
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-[2.5px] border-[#111111] text-[11px] font-black uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5 px-3">Conta</th>
                  <th className="py-2.5 px-3">Dia</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#111111]/15 text-sm">
                {entries.map((entry) => {
                  const tpl = templateMap.get(entry.fixedCostId);
                  const meta = [
                    entry.categoryName,
                    entry.paymentMethod,
                    entry.paidAt ? `Pago em ${formatDateBR(entry.paidAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <tr
                      key={entry.id}
                      className={entry.paid ? "bg-[#FAF8F3]/80" : ""}
                    >
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(entry.id)}
                          style={{
                            backgroundColor: entry.paid
                              ? "var(--status-paid)"
                              : "var(--status-pending)",
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-black uppercase border-2 border-[#111111] nb-press-sm cursor-pointer"
                        >
                          {entry.paid && <Check className="w-3.5 h-3.5" />}
                          {entry.paid ? "Pago" : "Pendente"}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-bold ${
                            entry.paid ? "line-through opacity-70" : ""
                          }`}
                        >
                          {entry.title}
                        </span>
                        {meta && (
                          <span className="block text-xs font-medium text-[#525252] mt-0.5">
                            {meta}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-money text-xs font-bold whitespace-nowrap">
                        Dia {String(entry.dueDay).padStart(2, "0")}
                      </td>
                      <td className="py-3 px-3 text-right font-money font-extrabold whitespace-nowrap">
                        {formatMoney(entry.amountCents)}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="surface"
                            size="sm"
                            aria-label={`Editar ${entry.title}`}
                            title="Editar"
                            onClick={() => openEdit(entry)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {tpl?.active && (
                            <Button
                              variant="surface"
                              size="sm"
                              aria-label={`Pausar ${entry.title}`}
                              title="Pausar nos próximos meses"
                              onClick={() => handleToggleActive(entry.fixedCostId)}
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            aria-label={`Excluir ${entry.title}`}
                            title="Excluir"
                            onClick={() => handleDelete(entry.fixedCostId)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pausados (só aparece quando existir algum) */}
      {pausedTemplates.length > 0 && (
        <div className="bg-white nb-border nb-shadow-sm">
          <button
            type="button"
            onClick={() => setShowPaused((v) => !v)}
            className="w-full px-5 py-3 flex items-center justify-between text-xs font-black uppercase tracking-wider cursor-pointer hover:bg-[#FAF8F3]"
          >
            <span className="inline-flex items-center gap-2">
              {showPaused ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              Pausados ({pausedTemplates.length})
            </span>
          </button>

          {showPaused && (
            <div className="border-t-[2.5px] border-[#111111] px-5 py-3 divide-y-2 divide-[#111111]/15">
              {pausedTemplates.map((fc) => (
                <div
                  key={fc.id}
                  className="py-2.5 flex items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <span className="font-bold opacity-75">{fc.title}</span>
                    <span className="block text-xs text-[#525252]">
                      Dia {String(fc.dueDay).padStart(2, "0")} · {fc.paymentMethod}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-money font-bold text-sm opacity-75">
                      {formatMoney(fc.amountCents)}
                    </span>
                    <Button
                      variant="surface"
                      size="sm"
                      onClick={() => handleToggleActive(fc.id)}
                    >
                      <Play className="w-3.5 h-3.5" />
                      Reativar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      aria-label={`Excluir ${fc.title}`}
                      onClick={() => handleDelete(fc.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Criar / Editar */}
      <Modal
        open={modalOpen}
        title={editingEntry ? "Editar conta fixa" : "Nova conta fixa"}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {editingEntry && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditScope("recurring")}
                style={
                  editScope === "recurring"
                    ? {
                        backgroundColor: "var(--color-primary)",
                        color: "var(--color-primary-ink)",
                      }
                    : undefined
                }
                className={`py-2 text-xs font-black uppercase tracking-wider nb-border cursor-pointer ${
                  editScope === "recurring" ? "nb-shadow-sm" : "bg-white"
                }`}
              >
                Este mês e próximos
              </button>
              <button
                type="button"
                onClick={() => setEditScope("single")}
                style={
                  editScope === "single"
                    ? {
                        backgroundColor: "var(--color-primary)",
                        color: "var(--color-primary-ink)",
                      }
                    : undefined
                }
                className={`py-2 text-xs font-black uppercase tracking-wider nb-border cursor-pointer ${
                  editScope === "single" ? "nb-shadow-sm" : "bg-white"
                }`}
              >
                Só este mês
              </button>
            </div>
          )}

          {editingEntry && editScope === "single" ? (
            <Input
              label={`Valor em ${month} (R$)`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          ) : (
            <>
              <Input
                label="Descrição"
                placeholder="Ex: DAS-MEI, Aluguel, Internet, Contador..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Valor mensal (R$)"
                  placeholder="75,90"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Input
                  label="Dia do vencimento"
                  type="number"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  required
                />
              </div>
              <PaymentMethodPills
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
              <Select
                label="Categoria"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Sem categoria</option>
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="surface" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

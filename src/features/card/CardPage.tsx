import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, CreditCard, Plus, RotateCcw, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import {
  defaultDateForMonth,
  formatDateBR,
  formatMoney,
  formatMonthLabel,
  parseMoneyToCents,
  shiftMonth,
} from "../../lib/format";
import type { CardStatementView, CardTransaction, Category } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input, Select } from "../../components/ui/FormField";
import { Modal } from "../../components/ui/Modal";

interface CardPageProps {
  month: string;
  categories: Category[];
  onError: (msg: string) => void;
}

const QUICK_INSTALLMENTS = [1, 2, 3, 6, 12];

function previewBillingMonth(purchaseDate: string, closingDay: number): string {
  const parts = purchaseDate.split("-");
  if (parts.length !== 3) return "";
  const base = `${parts[0]}-${parts[1]}`;
  const day = Number(parts[2]);
  if (Number.isNaN(day)) return base;
  return day >= closingDay ? shiftMonth(base, 1) : base;
}

export function CardPage({ month, categories, onError }: CardPageProps) {
  const [statement, setStatement] = useState<CardStatementView | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(defaultDateForMonth(month));
  const [installments, setInstallments] = useState("1");
  const [customInstallments, setCustomInstallments] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [billingOverride, setBillingOverride] = useState("");
  const [editingBillingMonth, setEditingBillingMonth] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CardTransaction | null>(null);

  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getCardStatement(month);
      setStatement(data);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }, [month, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setTitle("");
    setTotalAmount("");
    setPurchaseDate(defaultDateForMonth(month));
    setInstallments("1");
    setCustomInstallments(false);
    setCategoryId(expenseCategories[0] ? String(expenseCategories[0].id) : "");
    setBillingOverride("");
    setEditingBillingMonth(false);
    setModalOpen(true);
  };

  const handleSavePurchase = async (e: FormEvent) => {
    e.preventDefault();
    const totalAmountCents = parseMoneyToCents(totalAmount);
    const count = Number.parseInt(installments, 10);
    if (!title.trim() || totalAmountCents <= 0 || Number.isNaN(count) || count < 1) {
      onError("Informe descrição, valor válido e parcelas.");
      return;
    }

    try {
      await api.createCardPurchase({
        title: title.trim(),
        totalAmountCents,
        purchaseDate,
        installments: count,
        categoryId: categoryId ? Number(categoryId) : null,
        billingMonthOverride: billingOverride.trim() || null,
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleToggleStatementPaid = async () => {
    try {
      await api.toggleCardStatementPaid(month);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleDelete = async (tx: CardTransaction, deleteAll: boolean) => {
    try {
      await api.deleteCardTransaction(tx.id, deleteAll);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const parsedTotal = parseMoneyToCents(totalAmount);
  const parsedInstallments = Math.max(1, Number.parseInt(installments, 10) || 1);
  const autoBillingMonth = statement
    ? previewBillingMonth(purchaseDate, statement.closingDay)
    : month;
  const effectiveBillingMonth = billingOverride || autoBillingMonth || month;

  return (
    <div className="space-y-6">
      {/* Resumo da fatura */}
      <div className="bg-white nb-border nb-shadow p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
              <CreditCard className="w-4 h-4" />
              Fatura de {formatMonthLabel(month)}
            </span>
            {statement && statement.totalCents > 0 ? (
              <Badge tone={statement.paid ? "paid" : "pending"}>
                {statement.paid ? "Paga" : "Em aberto"}
              </Badge>
            ) : (
              <Badge tone="neutral">Zerada</Badge>
            )}
          </div>
          <div className="font-money text-3xl font-extrabold tracking-tight">
            {formatMoney(statement?.totalCents ?? 0)}
          </div>
          {statement && (
            <p className="text-xs font-semibold text-[#525252]">
              Fecha dia {String(statement.closingDay).padStart(2, "0")} · Vence dia{" "}
              {String(statement.dueDay).padStart(2, "0")}
              {statement.paid && statement.paidAt
                ? ` · Paga em ${formatDateBR(statement.paidAt)}`
                : ""}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {statement && statement.totalCents > 0 && (
            <Button
              variant={statement.paid ? "surface" : "paid"}
              onClick={handleToggleStatementPaid}
            >
              {statement.paid ? (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reabrir
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Marcar paga
                </>
              )}
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Nova compra
          </Button>
        </div>
      </div>

      {/* Compras da fatura */}
      <Card title="Compras na fatura">
        {loading && !statement ? (
          <p className="text-sm font-bold">Carregando...</p>
        ) : !statement || statement.transactions.length === 0 ? (
          <EmptyState
            title="Nenhuma compra nesta fatura"
            action={
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4" />
                Nova compra
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-[2.5px] border-[#111111] text-[11px] font-black uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Data</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Parcela</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#111111]/15 text-sm">
                {statement.transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="py-3 pr-3 font-money text-xs font-bold whitespace-nowrap">
                      {formatDateBR(tx.purchaseDate)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold">{tx.title}</span>
                      {tx.categoryName && (
                        <span className="block text-xs font-medium text-[#525252] mt-0.5">
                          {tx.categoryName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {tx.installmentTotal > 1 ? (
                        <Badge tone="secondary">
                          {tx.installmentNumber}/{tx.installmentTotal}
                        </Badge>
                      ) : (
                        <span className="text-xs font-semibold text-[#525252]">
                          À vista
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-money font-extrabold whitespace-nowrap">
                      {formatMoney(tx.amountCents)}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        aria-label={`Excluir ${tx.title}`}
                        title="Excluir"
                        onClick={() => {
                          if (tx.installmentTotal > 1) {
                            setDeleteTarget(tx);
                          } else {
                            void handleDelete(tx, false);
                          }
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal Nova Compra */}
      <Modal open={modalOpen} title="Nova compra no cartão" onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSavePurchase} className="space-y-4">
          <Input
            label="Descrição"
            placeholder="Ex: Insumos, Equipamento, Software, Anúncios..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor total (R$)"
              placeholder="300,00"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              required
            />
            <Input
              label="Data"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-extrabold uppercase tracking-wider text-[#111111]">
              Parcelas
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_INSTALLMENTS.map((n) => {
                const active = !customInstallments && parsedInstallments === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setCustomInstallments(false);
                      setInstallments(String(n));
                    }}
                    style={
                      active
                        ? {
                            backgroundColor: "var(--color-primary)",
                            color: "var(--color-primary-ink)",
                          }
                        : undefined
                    }
                    className={`px-3 py-1.5 text-xs font-extrabold uppercase border-2 border-[#111111] cursor-pointer ${
                      active ? "nb-shadow-sm" : "bg-white hover:bg-[#FAF8F3]"
                    }`}
                  >
                    {n === 1 ? "À vista" : `${n}x`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomInstallments(true)}
                style={
                  customInstallments
                    ? {
                        backgroundColor: "var(--color-primary)",
                        color: "var(--color-primary-ink)",
                      }
                    : undefined
                }
                className={`px-3 py-1.5 text-xs font-extrabold uppercase border-2 border-[#111111] cursor-pointer ${
                  customInstallments ? "nb-shadow-sm" : "bg-white hover:bg-[#FAF8F3]"
                }`}
              >
                Outro
              </button>
            </div>

            {customInstallments && (
              <div className="pt-1.5 max-w-[140px]">
                <Input
                  label="Nº de parcelas"
                  type="number"
                  min={1}
                  max={60}
                  value={installments}
                  onChange={(e) => setInstallments(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {parsedTotal > 0 && parsedInstallments > 1 && (
            <div className="px-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] text-xs font-bold flex items-center justify-between">
              <span>{parsedInstallments} parcelas</span>
              <span className="font-money font-extrabold">
                {parsedInstallments}x de {formatMoney(Math.floor(parsedTotal / parsedInstallments))}
              </span>
            </div>
          )}

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

          {/* Fatura automática com opção discreta de alterar */}
          <div className="px-3 py-2.5 bg-[#FAF8F3] border-2 border-[#111111] space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span>
                Fatura:{" "}
                <strong className="uppercase">
                  {formatMonthLabel(effectiveBillingMonth)}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  if (editingBillingMonth) {
                    setBillingOverride("");
                    setEditingBillingMonth(false);
                  } else {
                    setBillingOverride(effectiveBillingMonth);
                    setEditingBillingMonth(true);
                  }
                }}
                className="underline font-extrabold uppercase cursor-pointer"
              >
                {editingBillingMonth ? "Usar automática" : "Alterar"}
              </button>
            </div>

            {editingBillingMonth && (
              <input
                type="month"
                aria-label="Mês da primeira fatura"
                value={billingOverride}
                onChange={(e) => setBillingOverride(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-semibold bg-white border-2 border-[#111111]"
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="surface" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Excluir Parcelada */}
      <Modal
        open={Boolean(deleteTarget)}
        title="Excluir compra parcelada"
        onClose={() => setDeleteTarget(null)}
        maxWidthClass="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm font-semibold">
              <strong>{deleteTarget.title}</strong> ({deleteTarget.installmentNumber}/
              {deleteTarget.installmentTotal})
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="surface" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
              <Button
                variant="surface"
                onClick={() => handleDelete(deleteTarget, false)}
              >
                Só esta parcela
              </Button>
              <Button
                variant="danger"
                onClick={() => handleDelete(deleteTarget, true)}
              >
                Todas as {deleteTarget.installmentTotal}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

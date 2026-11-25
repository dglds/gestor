import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatDateBR, formatMoney } from "../../lib/format";
import {
  PAYMENT_METHODS,
  type BankTransaction,
  type Category,
  type CategoryKind,
} from "../../lib/types";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { BankTransactionModal } from "./BankTransactionModal";

interface BankPageProps {
  month: string;
  categories: Category[];
  onError: (msg: string) => void;
}

type BankFilter = "all" | "income" | "expense" | "pending";

export function BankPage({ month, categories, onError }: BankPageProps) {
  const [items, setItems] = useState<BankTransaction[]>([]);
  const [filter, setFilter] = useState<BankFilter>("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalKind, setModalKind] = useState<CategoryKind>("income");
  const [editing, setEditing] = useState<BankTransaction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listBankTransactions(month);
      setItems(data);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }, [month, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (kind: CategoryKind) => {
    setEditing(null);
    setModalKind(kind);
    setModalOpen(true);
  };

  const openEdit = (tx: BankTransaction) => {
    setEditing(tx);
    setModalKind(tx.kind);
    setModalOpen(true);
  };

  const handleTogglePaid = async (id: number) => {
    try {
      await api.toggleBankTransactionPaid(id);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteBankTransaction(id);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  const incomeTotal = items
    .filter((i) => i.kind === "income")
    .reduce((s, i) => s + i.amountCents, 0);
  const expenseTotal = items
    .filter((i) => i.kind === "expense")
    .reduce((s, i) => s + i.amountCents, 0);
  const netBank = incomeTotal - expenseTotal;

  const visibleItems = items.filter((item) => {
    if (filter === "income" && item.kind !== "income") return false;
    if (filter === "expense" && item.kind !== "expense") return false;
    if (filter === "pending" && item.paid) return false;
    if (methodFilter !== "all" && item.paymentMethod !== methodFilter) return false;
    return true;
  });

  const hasActiveFilter = filter !== "all" || methodFilter !== "all";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        <StatCard
          label="Entradas"
          value={formatMoney(incomeTotal)}
          tone="income"
          icon={<ArrowDownLeft className="w-4 h-4" />}
        />
        <StatCard
          label="Saídas"
          value={formatMoney(expenseTotal)}
          tone="expense"
          icon={<ArrowUpRight className="w-4 h-4" />}
        />
        <StatCard
          label="Saldo"
          value={formatMoney(netBank)}
          tone={netBank >= 0 ? "primary" : "expense"}
          emphasized
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Filtros + Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex nb-border nb-shadow-sm bg-white">
            {(
              [
                ["all", "Todos"],
                ["income", "Entradas"],
                ["expense", "Saídas"],
                ["pending", "Pendentes"],
              ] as [BankFilter, string][]
            ).map(([id, label], idx, arr) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                style={
                  filter === id
                    ? {
                        backgroundColor: "var(--color-primary)",
                        color: "var(--color-primary-ink)",
                      }
                    : undefined
                }
                className={`px-3.5 py-2 text-xs font-black uppercase tracking-wider cursor-pointer ${
                  idx < arr.length - 1 ? "border-r-[2.5px] border-[#111111]" : ""
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            aria-label="Filtrar por meio de pagamento"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="px-3 py-2 text-xs font-black uppercase tracking-wider bg-white text-[#111111] nb-border nb-shadow-sm cursor-pointer"
          >
            <option value="all">Todos os meios</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="paid" onClick={() => openCreate("income")}>
            <Plus className="w-4 h-4" />
            Entrada
          </Button>
          <Button onClick={() => openCreate("expense")}>
            <Plus className="w-4 h-4" />
            Saída
          </Button>
        </div>
      </div>

      <Card title="Movimentações">
        {loading && items.length === 0 ? (
          <p className="text-sm font-bold">Carregando...</p>
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title={
              hasActiveFilter
                ? "Nenhum lançamento para esse filtro"
                : "Nenhuma movimentação neste mês"
            }
            action={
              hasActiveFilter ? (
                <Button
                  variant="surface"
                  onClick={() => {
                    setFilter("all");
                    setMethodFilter("all");
                  }}
                >
                  Limpar filtros
                </Button>
              ) : (
                <Button onClick={() => openCreate("income")}>
                  <Plus className="w-4 h-4" />
                  Nova entrada
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-[2.5px] border-[#111111] text-[11px] font-black uppercase tracking-wider">
                  <th className="py-2.5 pr-3">Data</th>
                  <th className="py-2.5 px-3">Descrição</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Valor</th>
                  <th className="py-2.5 pl-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-[#111111]/15 text-sm">
                {visibleItems.map((tx) => {
                  const meta = [tx.categoryName, tx.paymentMethod, tx.notes]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <tr key={tx.id}>
                      <td className="py-3 pr-3 font-money text-xs font-bold whitespace-nowrap">
                        {formatDateBR(tx.date)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold">{tx.title}</span>
                        {meta && (
                          <span className="block text-xs font-medium text-[#525252] mt-0.5">
                            {meta}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(tx.id)}
                          style={{
                            backgroundColor: tx.paid
                              ? "var(--status-paid)"
                              : "var(--status-pending)",
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black uppercase border-2 border-[#111111] nb-press-sm cursor-pointer"
                        >
                          {tx.paid && <Check className="w-3.5 h-3.5" />}
                          {tx.paid
                            ? tx.kind === "income"
                              ? "Recebido"
                              : "Pago"
                            : "Pendente"}
                        </button>
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-money font-extrabold whitespace-nowrap ${
                          tx.kind === "income" ? "text-[#14532D]" : "text-[#991B1B]"
                        }`}
                      >
                        {tx.kind === "income" ? "+" : "-"} {formatMoney(tx.amountCents)}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            variant="surface"
                            size="sm"
                            aria-label={`Editar ${tx.title}`}
                            title="Editar"
                            onClick={() => openEdit(tx)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            aria-label={`Excluir ${tx.title}`}
                            title="Excluir"
                            onClick={() => handleDelete(tx.id)}
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

      <BankTransactionModal
        open={modalOpen}
        month={month}
        categories={categories}
        initialKind={modalKind}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        onError={onError}
      />
    </div>
  );
}

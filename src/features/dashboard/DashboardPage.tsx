import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Plus,
  Wallet,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatMoney } from "../../lib/format";
import type {
  Category,
  CategoryKind,
  DashboardSummary,
  NavTab,
  PendingItem,
} from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { StatCard } from "../../components/ui/StatCard";
import { BankTransactionModal } from "../bank/BankTransactionModal";

interface DashboardPageProps {
  month: string;
  categories: Category[];
  onNavigate: (tab: NavTab) => void;
  onError: (msg: string) => void;
}

const SOURCE_LABELS: Record<PendingItem["source"], string> = {
  fixed: "Fixo",
  bank: "Caixa",
  card: "Cartão",
};

export function DashboardPage({
  month,
  categories,
  onNavigate,
  onError,
}: DashboardPageProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [quickModalKind, setQuickModalKind] = useState<CategoryKind | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardSummary(month);
      setSummary(data);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }, [month, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleQuickPay = async (item: PendingItem) => {
    const key = `${item.source}-${item.id}`;
    setBusyKey(key);
    try {
      if (item.source === "fixed") {
        await api.toggleFixedCostEntryPaid(item.id);
      } else if (item.source === "bank") {
        await api.toggleBankTransactionPaid(item.id);
      } else if (item.source === "card") {
        await api.toggleCardStatementPaid(month);
      }
      await load();
    } catch (err) {
      onError(String(err));
    } finally {
      setBusyKey(null);
    }
  };

  if (loading && !summary) {
    return (
      <div className="bg-white nb-border nb-shadow p-8 text-center font-bold uppercase text-sm">
        Carregando...
      </div>
    );
  }

  if (!summary) return null;

  const fixedTotal = summary.fixedPaidCents + summary.fixedPendingCents;
  const bankOutTotal = summary.bankExpensePaidCents + summary.bankExpensePendingCents;
  const totalOut = summary.totalPaidCents + summary.totalPendingCents;
  const paidPct = totalOut > 0 ? Math.round((summary.totalPaidCents / totalOut) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs alinhados no topo como em todas as telas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
        <StatCard
          label="Entradas"
          value={formatMoney(summary.incomeCents)}
          sublabel={
            summary.incomeReceivedCents !== summary.incomeCents
              ? `Recebido ${formatMoney(summary.incomeReceivedCents)}`
              : undefined
          }
          tone="income"
          icon={<ArrowDownLeft className="w-4 h-4" />}
        />
        <StatCard
          label="Pago"
          value={formatMoney(summary.totalPaidCents)}
          tone="paid"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
        <StatCard
          label="Falta pagar"
          value={formatMoney(summary.totalPendingCents)}
          sublabel={
            summary.pendingItems.length > 0
              ? `${summary.pendingItems.length} em aberto`
              : undefined
          }
          tone="pending"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="Resultado"
          value={formatMoney(summary.balanceCents)}
          tone={summary.balanceCents >= 0 ? "primary" : "expense"}
          emphasized
          icon={<Wallet className="w-4 h-4" />}
        />
      </div>

      {/* Barra de progresso de pagamentos + ações rápidas */}
      <div className="bg-white nb-border nb-shadow p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider">
              Pagamentos do mês
            </span>
            <span className="font-money text-xs font-extrabold">
              {formatMoney(summary.totalPaidCents)} / {formatMoney(totalOut)} ({paidPct}%)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="paid" size="sm" onClick={() => setQuickModalKind("income")}>
              <Plus className="w-3.5 h-3.5" />
              Entrada
            </Button>
            <Button size="sm" onClick={() => setQuickModalKind("expense")}>
              <Plus className="w-3.5 h-3.5" />
              Saída
            </Button>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso de pagamentos do mês"
          aria-valuenow={paidPct}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-5 w-full bg-[#EFECE3] border-[2.5px] border-[#111111] overflow-hidden"
        >
          <div
            style={{
              width: `${paidPct}%`,
              backgroundColor: "var(--status-paid)",
            }}
            className={`h-full transition-all duration-300 ${
              paidPct > 0 && paidPct < 100 ? "border-r-[2.5px] border-[#111111]" : ""
            }`}
          />
        </div>
      </div>

      {/* Pendências + Resumo por origem (cards alinhados em altura) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <Card
          title="Falta pagar"
          accent={summary.pendingItems.length > 0 ? "secondary" : "none"}
          className="lg:col-span-3 h-full"
        >
          {summary.pendingItems.length === 0 ? (
            <EmptyState title="Tudo pago neste mês" />
          ) : (
            <ul className="divide-y-2 divide-[#111111]/20">
              {summary.pendingItems.map((item) => {
                const key = `${item.source}-${item.id}`;
                return (
                  <li
                    key={key}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          tone={
                            item.source === "fixed"
                              ? "primary"
                              : item.source === "card"
                                ? "secondary"
                                : "neutral"
                          }
                        >
                          {SOURCE_LABELS[item.source]}
                        </Badge>
                        <span className="font-bold text-sm truncate">{item.title}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#525252] mt-0.5">
                        {item.dueInfo}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-money text-sm font-extrabold">
                        {formatMoney(item.amountCents)}
                      </span>
                      <Button
                        variant="paid"
                        size="sm"
                        disabled={busyKey === key}
                        onClick={() => handleQuickPay(item)}
                      >
                        Pagar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Saídas por área" className="lg:col-span-2 h-full">
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate("fixed")}
              className="w-full text-left p-3.5 bg-[#FAF8F3] nb-border nb-shadow-sm nb-press-sm cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-black uppercase tracking-wider">Fixos</div>
                <div className="font-money text-lg font-extrabold mt-0.5">
                  {formatMoney(fixedTotal)}
                </div>
                {summary.fixedPendingCents > 0 && (
                  <div className="text-xs font-bold text-[#9A3412] mt-0.5">
                    Falta {formatMoney(summary.fixedPendingCents)}
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("bank")}
              className="w-full text-left p-3.5 bg-[#FAF8F3] nb-border nb-shadow-sm nb-press-sm cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-black uppercase tracking-wider">Caixa</div>
                <div className="font-money text-lg font-extrabold mt-0.5">
                  {formatMoney(bankOutTotal)}
                </div>
                {summary.bankExpensePendingCents > 0 && (
                  <div className="text-xs font-bold text-[#9A3412] mt-0.5">
                    Falta {formatMoney(summary.bankExpensePendingCents)}
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("card")}
              className="w-full text-left p-3.5 bg-[#FAF8F3] nb-border nb-shadow-sm nb-press-sm cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-black uppercase tracking-wider">Cartão</div>
                <div className="font-money text-lg font-extrabold mt-0.5">
                  {formatMoney(summary.cardTotalCents)}
                </div>
                {summary.cardTotalCents > 0 && (
                  <div
                    className={`text-xs font-bold mt-0.5 ${
                      summary.cardPaid ? "text-[#14532D]" : "text-[#9A3412]"
                    }`}
                  >
                    {summary.cardPaid ? "Fatura paga" : "Em aberto"}
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </Card>
      </div>

      <BankTransactionModal
        open={quickModalKind !== null}
        month={month}
        categories={categories}
        initialKind={quickModalKind ?? "income"}
        editing={null}
        onClose={() => setQuickModalKind(null)}
        onSaved={load}
        onError={onError}
      />
    </div>
  );
}

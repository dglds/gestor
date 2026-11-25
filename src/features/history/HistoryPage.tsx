import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTimeBR } from "../../lib/format";
import type { ActivityArea, ActivityLog } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";

interface HistoryPageProps {
  onError: (msg: string) => void;
}

type AreaFilter = "all" | ActivityArea;

const AREA_FILTERS: [AreaFilter, string][] = [
  ["all", "Tudo"],
  ["bank", "Caixa"],
  ["fixed", "Fixos"],
  ["card", "Cartão"],
  ["settings", "Ajustes"],
];

const AREA_LABELS: Record<string, string> = {
  bank: "Caixa",
  fixed: "Fixos",
  card: "Cartão",
  settings: "Ajustes",
};

function areaTone(area: string): "primary" | "secondary" | "neutral" {
  if (area === "fixed") return "primary";
  if (area === "card") return "secondary";
  return "neutral";
}

function ActionIcon({ action }: { action: string }) {
  const styles: Record<string, { bg: string; icon: typeof Plus }> = {
    create: { bg: "var(--status-income)", icon: Plus },
    pay: { bg: "var(--status-paid)", icon: Check },
    unpay: { bg: "var(--status-pending)", icon: RotateCcw },
    update: { bg: "var(--color-primary)", icon: Pencil },
    delete: { bg: "var(--status-expense)", icon: Trash2 },
    pause: { bg: "#EFECE3", icon: Pause },
    resume: { bg: "var(--status-paid)", icon: Play },
  };
  const cfg = styles[action] ?? { bg: "#EFECE3", icon: Pencil };
  const Icon = cfg.icon;
  return (
    <span
      style={{ backgroundColor: cfg.bg }}
      className="w-7 h-7 border-2 border-[#111111] flex items-center justify-center shrink-0"
    >
      <Icon className="w-3.5 h-3.5 text-[#111111]" />
    </span>
  );
}

export function HistoryPage({ onError }: HistoryPageProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [area, setArea] = useState<AreaFilter>("all");
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listActivityLogs(area === "all" ? null : area, 200);
      setLogs(data);
    } catch (err) {
      onError(String(err));
    } finally {
      setLoading(false);
    }
  }, [area, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClear = async () => {
    try {
      await api.clearActivityLogs();
      setConfirmClear(false);
      await load();
    } catch (err) {
      onError(String(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex nb-border nb-shadow-sm bg-white flex-wrap">
          {AREA_FILTERS.map(([id, label], idx, arr) => (
            <button
              key={id}
              type="button"
              onClick={() => setArea(id)}
              style={
                area === id
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

        {logs.length > 0 && (
          <Button variant="surface" size="sm" onClick={() => setConfirmClear(true)}>
            <Trash2 className="w-3.5 h-3.5" />
            Limpar histórico
          </Button>
        )}
      </div>

      <Card title="Ações recentes">
        {loading && logs.length === 0 ? (
          <p className="text-sm font-bold">Carregando...</p>
        ) : logs.length === 0 ? (
          <EmptyState title="Nenhuma ação registrada ainda" />
        ) : (
          <ul className="divide-y-2 divide-[#111111]/15">
            {logs.map((log) => (
              <li
                key={log.id}
                className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ActionIcon action={log.action} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={areaTone(log.area)}>
                        {AREA_LABELS[log.area] ?? log.area}
                      </Badge>
                      <span className="text-sm font-bold truncate">{log.summary}</span>
                    </div>
                  </div>
                </div>
                <span className="font-money text-xs font-bold text-[#525252] whitespace-nowrap shrink-0">
                  {formatDateTimeBR(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={confirmClear}
        title="Limpar histórico"
        onClose={() => setConfirmClear(false)}
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-sm font-semibold">
            Deseja apagar todos os registros do histórico de ações?
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="surface" onClick={() => setConfirmClear(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleClear}>
              Limpar tudo
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

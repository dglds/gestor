import { ArrowUpCircle, Download, RefreshCw } from "lucide-react";
import type { UpdateState } from "../../lib/updates";

interface SidebarUpdateFooterProps {
  update: UpdateState;
  onCheckUpdate: () => void;
  onOpenUpdate: (url: string) => void;
}

export function SidebarUpdateFooter({
  update,
  onCheckUpdate,
  onOpenUpdate,
}: SidebarUpdateFooterProps) {
  const isChecking = update.status === "checking";
  const hasUpdate = update.status === "available" && update.latestVersion !== null;

  const statusText = (() => {
    if (isChecking) return "Verificando...";
    if (update.checkedManually && update.status === "up-to-date") return "Atualizado";
    if (update.checkedManually && update.status === "error") return "Sem conexão";
    return null;
  })();

  return (
    <div className="mt-auto pt-3 border-t-[2.5px] border-[#111111] space-y-2.5">
      {hasUpdate && (
        <button
          type="button"
          onClick={() => onOpenUpdate(update.releaseUrl)}
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-primary-ink)",
          }}
          className="w-full text-left p-2.5 nb-border nb-shadow-sm nb-press-sm cursor-pointer"
          aria-label={`Nova versão ${update.latestVersion} disponível para download`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
              <ArrowUpCircle className="w-3.5 h-3.5 shrink-0" />
              Nova versão
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-black font-money bg-[#111111] text-white leading-none">
              v{update.latestVersion}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs font-extrabold">
            <span>Baixar atualização</span>
            <Download className="w-3.5 h-3.5 shrink-0" />
          </div>
        </button>
      )}

      <div className="flex items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <p className="text-[11px] font-black font-money uppercase tracking-wider text-[#525252] leading-none">
            v{update.currentVersion}
          </p>
          {statusText && (
            <p className="text-[10px] font-bold text-[#525252] mt-1 truncate">
              {statusText}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onCheckUpdate}
          disabled={isChecking}
          title="Verificar atualizações"
          aria-label="Verificar atualizações"
          className="p-1.5 border-2 border-[#111111] bg-[#FAF8F3] hover:bg-white cursor-pointer disabled:opacity-50 nb-press-sm shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`} />
        </button>
      </div>
    </div>
  );
}

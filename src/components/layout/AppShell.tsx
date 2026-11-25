import type { ReactNode } from "react";
import {
  CreditCard,
  History,
  Landmark,
  LayoutDashboard,
  Repeat,
  Settings,
} from "lucide-react";
import type { NavTab } from "../../lib/types";
import type { UpdateState } from "../../lib/updates";
import { MonthPicker } from "../ui/MonthPicker";
import { SidebarUpdateFooter } from "./SidebarUpdateFooter";

interface AppShellProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  month: string;
  onChangeMonth: (month: string) => void;
  companyName: string;
  companyLogo: string;
  updateState: UpdateState;
  onCheckUpdate: () => void;
  onOpenUpdate: (url: string) => void;
  children: ReactNode;
}

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Resumo", icon: LayoutDashboard },
  { id: "bank", label: "Caixa", icon: Landmark },
  { id: "fixed", label: "Fixos", icon: Repeat },
  { id: "card", label: "Cartão", icon: CreditCard },
  { id: "history", label: "Histórico", icon: History },
  { id: "settings", label: "Ajustes", icon: Settings },
];

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: "Resumo",
  bank: "Caixa",
  fixed: "Contas Fixas",
  card: "Cartão",
  history: "Histórico",
  settings: "Ajustes",
};

export function AppShell({
  activeTab,
  onSelectTab,
  month,
  onChangeMonth,
  companyName,
  companyLogo,
  updateState,
  onCheckUpdate,
  onOpenUpdate,
  children,
}: AppShellProps) {
  const showMonthPicker = activeTab !== "settings" && activeTab !== "history";
  const displayName = companyName.trim() || "Finance";

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 bg-white border-r-[3px] border-[#111111] flex flex-col p-4">
        <div className="pb-4 mb-5 border-b-[2.5px] border-[#111111]">
          {companyLogo ? (
            <div className="space-y-2.5">
              <img
                src={companyLogo}
                alt={displayName}
                className="block w-full h-auto max-h-36 object-contain"
              />
              <div className="min-w-0">
                <h1 className="text-base font-black uppercase tracking-tight leading-tight break-words">
                  {displayName}
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#525252] mt-0.5">
                  PJ / MEI
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: "var(--color-primary)",
                  color: "var(--color-primary-ink)",
                }}
                className="w-10 h-10 nb-border nb-shadow-sm flex items-center justify-center font-black text-lg select-none shrink-0"
              >
                F$
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-black uppercase tracking-tight leading-none truncate">
                  {displayName}
                </h1>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#525252] mt-0.5">
                  PJ / MEI
                </p>
              </div>
            </div>
          )}
        </div>

        <nav className="space-y-1.5" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectTab(item.id)}
                style={
                  isActive
                    ? {
                        backgroundColor: "var(--color-primary)",
                        color: "var(--color-primary-ink)",
                      }
                    : undefined
                }
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-left cursor-pointer transition-all ${
                  isActive
                    ? "nb-border nb-shadow-sm"
                    : "border-2 border-transparent hover:border-[#111111] hover:bg-[#FAF8F3]"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <SidebarUpdateFooter
          update={updateState}
          onCheckUpdate={onCheckUpdate}
          onOpenUpdate={onOpenUpdate}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b-[3px] border-[#111111] px-6 min-h-[4.5rem] py-3 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-black uppercase tracking-tight leading-none">
            {TAB_TITLES[activeTab]}
          </h2>
          {showMonthPicker && (
            <MonthPicker month={month} onChange={onChangeMonth} />
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

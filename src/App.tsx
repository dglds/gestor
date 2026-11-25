import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { AppShell } from "./components/layout/AppShell";
import { BankPage } from "./features/bank/BankPage";
import { CardPage } from "./features/card/CardPage";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { FixedCostsPage } from "./features/fixed-costs/FixedCostsPage";
import { HistoryPage } from "./features/history/HistoryPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { api } from "./lib/api";
import { getCurrentMonth } from "./lib/format";
import {
  applyFontScale,
  applyThemeColors,
  DEFAULT_FONT_SCALE,
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
} from "./lib/theme";
import type { AppSettings, Category, NavTab } from "./lib/types";
import {
  checkForAppUpdate,
  formatSimpleVersion,
  RELEASES_PAGE_URL,
  type UpdateState,
} from "./lib/updates";

const UPDATE_POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

const INITIAL_UPDATE_STATE: UpdateState = {
  status: "idle",
  currentVersion: formatSimpleVersion(__APP_VERSION__),
  latestVersion: null,
  releaseUrl: RELEASES_PAGE_URL,
  checkedManually: false,
};

const FALLBACK_SETTINGS: AppSettings = {
  primaryColor: DEFAULT_PRIMARY,
  secondaryColor: DEFAULT_SECONDARY,
  cardClosingDay: 25,
  cardDueDay: 5,
  fontScale: DEFAULT_FONT_SCALE,
  companyName: "Finance",
  companyLogo: "",
};

export function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [month, setMonth] = useState<string>(getCurrentMonth);
  const [settings, setSettings] = useState<AppSettings>(FALLBACK_SETTINGS);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>(INITIAL_UPDATE_STATE);

  const reportError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const runUpdateCheck = useCallback(async (version: string, manual: boolean) => {
    setUpdateState((prev) => ({
      ...prev,
      status: "checking",
      currentVersion: formatSimpleVersion(version),
      checkedManually: manual,
    }));
    const result = await checkForAppUpdate(version, manual);
    setUpdateState(result);
  }, []);

  const handleManualUpdateCheck = useCallback(() => {
    void runUpdateCheck(updateState.currentVersion, true);
  }, [runUpdateCheck, updateState.currentVersion]);

  const handleOpenUpdate = useCallback(
    async (url: string) => {
      try {
        await api.openReleaseUrl(url);
      } catch {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  const loadCategories = useCallback(async () => {
    try {
      const list = await api.listCategories();
      setCategories(list);
    } catch (err) {
      reportError(String(err));
    }
  }, [reportError]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [loadedSettings, loadedCategories] = await Promise.all([
          api.getSettings(),
          api.listCategories(),
        ]);
        if (!active) return;
        setSettings(loadedSettings);
        setCategories(loadedCategories);
        applyThemeColors(loadedSettings.primaryColor, loadedSettings.secondaryColor);
        applyFontScale(loadedSettings.fontScale);
      } catch (err) {
        if (active) reportError(String(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [reportError]);

  useEffect(() => {
    let active = true;
    let intervalId: number | undefined;

    (async () => {
      let version = __APP_VERSION__;
      try {
        version = await api.getAppVersion();
      } catch {
        // Fallback para versão injetada pelo Vite fora do runtime Tauri
      }
      if (!active) return;

      const simpleVersion = formatSimpleVersion(version);
      setUpdateState((prev) => ({ ...prev, currentVersion: simpleVersion }));
      const initialResult = await checkForAppUpdate(simpleVersion, false);
      if (!active) return;
      setUpdateState(initialResult);

      intervalId = window.setInterval(async () => {
        const nextResult = await checkForAppUpdate(simpleVersion, false);
        if (active) setUpdateState(nextResult);
      }, UPDATE_POLL_INTERVAL_MS);
    })();

    return () => {
      active = false;
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      month={month}
      onChangeMonth={setMonth}
      companyName={settings.companyName}
      companyLogo={settings.companyLogo}
      updateState={updateState}
      onCheckUpdate={handleManualUpdateCheck}
      onOpenUpdate={handleOpenUpdate}
    >
      {error && (
        <div
          role="alert"
          style={{ backgroundColor: "var(--status-expense)" }}
          className="mb-5 px-4 py-3 nb-border nb-shadow-sm flex items-center justify-between gap-3 text-sm font-bold"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Fechar alerta"
            className="p-1 border-2 border-[#111111] bg-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === "dashboard" && (
        <DashboardPage
          month={month}
          categories={categories}
          onNavigate={setActiveTab}
          onError={reportError}
        />
      )}

      {activeTab === "fixed" && (
        <FixedCostsPage
          month={month}
          categories={categories}
          onError={reportError}
        />
      )}

      {activeTab === "bank" && (
        <BankPage month={month} categories={categories} onError={reportError} />
      )}

      {activeTab === "card" && (
        <CardPage month={month} categories={categories} onError={reportError} />
      )}

      {activeTab === "history" && <HistoryPage onError={reportError} />}

      {activeTab === "settings" && (
        <SettingsPage
          settings={settings}
          categories={categories}
          onSettingsUpdated={(next) => {
            setSettings(next);
            applyThemeColors(next.primaryColor, next.secondaryColor);
            applyFontScale(next.fontScale);
          }}
          onCategoriesUpdated={loadCategories}
          onError={reportError}
        />
      )}
    </AppShell>
  );
}

export default App;

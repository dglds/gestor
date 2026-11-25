import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Check, Minus, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { api } from "../../lib/api";
import {
  applyFontScale,
  applyThemeColors,
  DEFAULT_FONT_SCALE,
  DEFAULT_PRIMARY,
  DEFAULT_SECONDARY,
  FONT_SCALE_PRESETS,
  MAX_FONT_SCALE,
  MIN_FONT_SCALE,
  THEME_PRESETS,
} from "../../lib/theme";
import type { AppSettings, Category, CategoryKind } from "../../lib/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input, Select } from "../../components/ui/FormField";

interface SettingsPageProps {
  settings: AppSettings;
  categories: Category[];
  onSettingsUpdated: (next: AppSettings) => void;
  onCategoriesUpdated: () => Promise<void>;
  onError: (msg: string) => void;
}

type SavedSection = "logo" | "colors" | "font" | "card" | null;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function resizeImageToDataUrl(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => {
      const rawUrl = String(reader.result ?? "");
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height, 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(rawUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function SettingsPage({
  settings,
  categories,
  onSettingsUpdated,
  onCategoriesUpdated,
  onError,
}: SettingsPageProps) {
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [fontScale, setFontScale] = useState(settings.fontScale);
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [companyLogo, setCompanyLogo] = useState(settings.companyLogo);
  const [closingDay, setClosingDay] = useState(String(settings.cardClosingDay));
  const [dueDay, setDueDay] = useState(String(settings.cardDueDay));
  const [savedSection, setSavedSection] = useState<SavedSection>(null);

  const [newCatName, setNewCatName] = useState("");
  const [newCatKind, setNewCatKind] = useState<CategoryKind>("expense");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const badgeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
      if (badgeTimerRef.current !== null) window.clearTimeout(badgeTimerRef.current);
    };
  }, []);

  const flashSaved = (section: Exclude<SavedSection, null>) => {
    setSavedSection(section);
    if (badgeTimerRef.current !== null) window.clearTimeout(badgeTimerRef.current);
    badgeTimerRef.current = window.setTimeout(() => setSavedSection(null), 1800);
  };

  const buildCurrentSettings = (overrides: Partial<AppSettings>): AppSettings => {
    const closing = Number.parseInt(closingDay, 10);
    const due = Number.parseInt(dueDay, 10);
    return {
      primaryColor: HEX_RE.test(primaryColor) ? primaryColor : settings.primaryColor,
      secondaryColor: HEX_RE.test(secondaryColor)
        ? secondaryColor
        : settings.secondaryColor,
      cardClosingDay:
        !Number.isNaN(closing) && closing >= 1 && closing <= 31
          ? closing
          : settings.cardClosingDay,
      cardDueDay:
        !Number.isNaN(due) && due >= 1 && due <= 31 ? due : settings.cardDueDay,
      fontScale,
      companyName,
      companyLogo,
      ...overrides,
    };
  };

  const persistSettings = async (
    next: AppSettings,
    section: Exclude<SavedSection, null>
  ) => {
    try {
      const updated = await api.updateSettings(next);
      onSettingsUpdated(updated);
      flashSaved(section);
    } catch (err) {
      onError(String(err));
    }
  };

  const schedulePersist = (
    next: AppSettings,
    section: Exclude<SavedSection, null>,
    immediate = false
  ) => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    if (immediate) {
      void persistSettings(next, section);
      return;
    }
    saveTimerRef.current = window.setTimeout(() => {
      void persistSettings(next, section);
    }, 240);
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Selecione um arquivo de imagem (PNG, JPG, WEBP ou SVG).");
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file, 512);
      setCompanyLogo(dataUrl);
      schedulePersist(buildCurrentSettings({ companyLogo: dataUrl }), "logo", true);
    } catch (err) {
      onError(String(err));
    }
  };

  const handleCompanyNameChange = (nextName: string) => {
    setCompanyName(nextName);
    schedulePersist(buildCurrentSettings({ companyName: nextName }), "logo");
  };

  const handleRemoveLogo = () => {
    setCompanyLogo("");
    schedulePersist(buildCurrentSettings({ companyLogo: "" }), "logo", true);
  };

  const updateColors = (
    nextPrimary: string,
    nextSecondary: string,
    immediate = false
  ) => {
    setPrimaryColor(nextPrimary);
    setSecondaryColor(nextSecondary);
    if (!HEX_RE.test(nextPrimary) || !HEX_RE.test(nextSecondary)) return;

    applyThemeColors(nextPrimary, nextSecondary);
    schedulePersist(
      buildCurrentSettings({ primaryColor: nextPrimary, secondaryColor: nextSecondary }),
      "colors",
      immediate
    );
  };

  const updateFontScale = (nextRaw: number, immediate = false) => {
    const clamped = Math.min(
      MAX_FONT_SCALE,
      Math.max(MIN_FONT_SCALE, Math.round(nextRaw))
    );
    setFontScale(clamped);
    applyFontScale(clamped);
    schedulePersist(buildCurrentSettings({ fontScale: clamped }), "font", immediate);
  };

  const updateCardDays = (nextClosingRaw: string, nextDueRaw: string) => {
    setClosingDay(nextClosingRaw);
    setDueDay(nextDueRaw);
    const closing = Number.parseInt(nextClosingRaw, 10);
    const due = Number.parseInt(nextDueRaw, 10);
    if (
      Number.isNaN(closing) ||
      closing < 1 ||
      closing > 31 ||
      Number.isNaN(due) ||
      due < 1 ||
      due > 31
    ) {
      return;
    }
    schedulePersist(
      buildCurrentSettings({ cardClosingDay: closing, cardDueDay: due }),
      "card"
    );
  };

  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.createCategory(newCatName.trim(), newCatKind);
      setNewCatName("");
      await onCategoriesUpdated();
    } catch (err) {
      onError(String(err));
    }
  };

  const handleDeleteCategory = async (id: number) => {
    try {
      await api.deleteCategory(id);
      await onCategoriesUpdated();
    } catch (err) {
      onError(String(err));
    }
  };

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");

  return (
    <div className="space-y-6">
      {/* Linha 1: Logo + Fonte (cards alinhados em altura) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Card
          title="Empresa"
          className="h-full"
          headerAction={
            savedSection === "logo" ? (
              <Badge tone="paid" className="gap-1">
                <Check className="w-3 h-3" />
                Salvo
              </Badge>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <Input
              label="Nome da empresa"
              placeholder="Ex: Finance, Minha Loja..."
              value={companyName}
              onChange={(e) => handleCompanyNameChange(e.target.value)}
            />

            <div className="space-y-3">
              {companyLogo && (
                <img
                  src={companyLogo}
                  alt={companyName.trim() || "Logo da empresa"}
                  className="block w-full max-w-[240px] h-auto max-h-28 object-contain"
                />
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5" />
                  {companyLogo ? "Trocar logo" : "Enviar logo"}
                </Button>
                {companyLogo && (
                  <Button variant="surface" size="sm" onClick={handleRemoveLogo}>
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Tamanho da fonte"
          className="h-full"
          headerAction={
            savedSection === "font" ? (
              <Badge tone="paid" className="gap-1">
                <Check className="w-3 h-3" />
                Salvo
              </Badge>
            ) : fontScale !== DEFAULT_FONT_SCALE ? (
              <Button
                variant="surface"
                size="sm"
                onClick={() => updateFontScale(DEFAULT_FONT_SCALE, true)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                100%
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button
                variant="surface"
                size="sm"
                aria-label="Diminuir fonte"
                disabled={fontScale <= MIN_FONT_SCALE}
                onClick={() => updateFontScale(fontScale - 5, true)}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <input
                type="range"
                aria-label="Tamanho geral da fonte"
                min={MIN_FONT_SCALE}
                max={MAX_FONT_SCALE}
                step={5}
                value={fontScale}
                onChange={(e) => updateFontScale(Number(e.target.value))}
                className="flex-1 accent-[#111111] cursor-pointer"
              />
              <Button
                variant="surface"
                size="sm"
                aria-label="Aumentar fonte"
                disabled={fontScale >= MAX_FONT_SCALE}
                onClick={() => updateFontScale(fontScale + 5, true)}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
              <span className="font-money text-sm font-extrabold w-12 text-right">
                {fontScale}%
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {FONT_SCALE_PRESETS.map((preset) => {
                const active = fontScale === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => updateFontScale(preset.value, true)}
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
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Linha 2: Cores + Cartão (cards alinhados em altura) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Card
          title="Cores"
          accent="primary"
          className="h-full"
          headerAction={
            savedSection === "colors" ? (
              <Badge tone="paid" className="gap-1">
                <Check className="w-3 h-3" />
                Salvo
              </Badge>
            ) : (
              <Button
                variant="surface"
                size="sm"
                onClick={() => updateColors(DEFAULT_PRIMARY, DEFAULT_SECONDARY, true)}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Padrão
              </Button>
            )
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="block text-xs font-extrabold uppercase tracking-wider">
                  Primária
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Cor primária"
                    value={HEX_RE.test(primaryColor) ? primaryColor : DEFAULT_PRIMARY}
                    onChange={(e) => updateColors(e.target.value, secondaryColor)}
                    className="w-11 h-10 p-0.5 bg-white nb-border cursor-pointer"
                  />
                  <input
                    type="text"
                    aria-label="Código hex da cor primária"
                    value={primaryColor}
                    onChange={(e) => updateColors(e.target.value, secondaryColor)}
                    className="w-full px-2.5 py-2 font-money text-sm font-bold nb-border bg-white uppercase"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-extrabold uppercase tracking-wider">
                  Secundária
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Cor secundária"
                    value={
                      HEX_RE.test(secondaryColor) ? secondaryColor : DEFAULT_SECONDARY
                    }
                    onChange={(e) => updateColors(primaryColor, e.target.value)}
                    className="w-11 h-10 p-0.5 bg-white nb-border cursor-pointer"
                  />
                  <input
                    type="text"
                    aria-label="Código hex da cor secundária"
                    value={secondaryColor}
                    onChange={(e) => updateColors(primaryColor, e.target.value)}
                    className="w-full px-2.5 py-2 font-money text-sm font-bold nb-border bg-white uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => updateColors(preset.primary, preset.secondary, true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FAF8F3] nb-border nb-shadow-sm nb-press-sm text-xs font-extrabold cursor-pointer"
                >
                  <span
                    style={{ backgroundColor: preset.primary }}
                    className="w-3.5 h-3.5 border-2 border-[#111111]"
                  />
                  <span
                    style={{ backgroundColor: preset.secondary }}
                    className="w-3.5 h-3.5 border-2 border-[#111111]"
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <Card
          title="Cartão"
          className="h-full"
          headerAction={
            savedSection === "card" ? (
              <Badge tone="paid" className="gap-1">
                <Check className="w-3 h-3" />
                Salvo
              </Badge>
            ) : undefined
          }
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Dia de fechamento"
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => updateCardDays(e.target.value, dueDay)}
              required
            />
            <Input
              label="Dia de vencimento"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => updateCardDays(closingDay, e.target.value)}
              required
            />
          </div>
        </Card>
      </div>

      {/* Categorias */}
      <Card title="Categorias">
        <form
          onSubmit={handleAddCategory}
          className="flex flex-wrap items-end gap-3 pb-5 mb-5 border-b-[2.5px] border-[#111111]"
        >
          <div className="flex-1 min-w-[200px]">
            <Input
              label="Nova categoria"
              placeholder="Ex: Embalagens, Contador..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              label="Tipo"
              value={newCatKind}
              onChange={(e) => setNewCatKind(e.target.value as CategoryKind)}
            >
              <option value="expense">Saída</option>
              <option value="income">Entrada</option>
            </Select>
          </div>
          <Button type="submit">
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider">
              Saídas ({expenseCategories.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {expenseCategories.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-[#FAF8F3] border-2 border-[#111111] text-xs font-extrabold"
                >
                  {c.name}
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id)}
                    aria-label={`Remover ${c.name}`}
                    className="hover:text-[#991B1B] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider">
              Entradas ({incomeCategories.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {incomeCategories.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-[#FAF8F3] border-2 border-[#111111] text-xs font-extrabold"
                >
                  {c.name}
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(c.id)}
                    aria-label={`Remover ${c.name}`}
                    className="hover:text-[#991B1B] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

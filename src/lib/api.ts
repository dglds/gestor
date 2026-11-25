import { invoke } from "@tauri-apps/api/core";
import type {
  ActivityLog,
  AppSettings,
  BankTransaction,
  CardStatementView,
  Category,
  CategoryKind,
  DashboardSummary,
  FixedCost,
  FixedCostEntry,
  PaymentMethod,
} from "./types";

export const api = {
  // Configurações e categorias
  getSettings: () => invoke<AppSettings>("get_settings"),
  updateSettings: (payload: AppSettings) =>
    invoke<AppSettings>("update_settings", {
      primaryColor: payload.primaryColor,
      secondaryColor: payload.secondaryColor,
      cardClosingDay: payload.cardClosingDay,
      cardDueDay: payload.cardDueDay,
      fontScale: payload.fontScale,
      companyName: payload.companyName,
      companyLogo: payload.companyLogo,
    }),
  listCategories: () => invoke<Category[]>("list_categories"),
  createCategory: (name: string, kind: CategoryKind) =>
    invoke<Category>("create_category", { name, kind }),
  deleteCategory: (id: number) => invoke<void>("delete_category", { id }),

  // Dashboard
  getDashboardSummary: (month: string) =>
    invoke<DashboardSummary>("get_dashboard_summary", { month }),

  // Custos Fixos
  listFixedCostEntries: (month: string) =>
    invoke<FixedCostEntry[]>("list_fixed_cost_entries", { month }),
  listFixedCosts: () => invoke<FixedCost[]>("list_fixed_costs"),
  createFixedCost: (payload: {
    title: string;
    amountCents: number;
    dueDay: number;
    categoryId: number | null;
    paymentMethod: PaymentMethod;
    startMonth: string;
  }) => invoke<number>("create_fixed_cost", payload),
  updateFixedCost: (payload: {
    id: number;
    title: string;
    amountCents: number;
    dueDay: number;
    categoryId: number | null;
    paymentMethod: PaymentMethod;
    currentMonth: string;
  }) => invoke<void>("update_fixed_cost", payload),
  toggleFixedCostActive: (id: number) =>
    invoke<boolean>("toggle_fixed_cost_active", { id }),
  deleteFixedCost: (id: number) => invoke<void>("delete_fixed_cost", { id }),
  toggleFixedCostEntryPaid: (entryId: number) =>
    invoke<boolean>("toggle_fixed_cost_entry_paid", { entryId }),
  updateFixedCostEntryAmount: (entryId: number, amountCents: number) =>
    invoke<void>("update_fixed_cost_entry_amount", { entryId, amountCents }),

  // Extrato Bancário / Caixa
  listBankTransactions: (month: string) =>
    invoke<BankTransaction[]>("list_bank_transactions", { month }),
  createBankTransaction: (payload: {
    kind: CategoryKind;
    title: string;
    amountCents: number;
    date: string;
    categoryId: number | null;
    paymentMethod: PaymentMethod;
    paid: boolean;
    notes: string | null;
  }) => invoke<number>("create_bank_transaction", payload),
  updateBankTransaction: (payload: {
    id: number;
    kind: CategoryKind;
    title: string;
    amountCents: number;
    date: string;
    categoryId: number | null;
    paymentMethod: PaymentMethod;
    paid: boolean;
    notes: string | null;
  }) => invoke<void>("update_bank_transaction", payload),
  toggleBankTransactionPaid: (id: number) =>
    invoke<boolean>("toggle_bank_transaction_paid", { id }),
  deleteBankTransaction: (id: number) =>
    invoke<void>("delete_bank_transaction", { id }),

  // Cartão de Crédito
  getCardStatement: (month: string) =>
    invoke<CardStatementView>("get_card_statement", { month }),
  createCardPurchase: (payload: {
    title: string;
    totalAmountCents: number;
    purchaseDate: string;
    installments: number;
    categoryId: number | null;
    billingMonthOverride: string | null;
  }) => invoke<string>("create_card_purchase", payload),
  deleteCardTransaction: (id: number, deleteAllInstallments: boolean) =>
    invoke<void>("delete_card_transaction", { id, deleteAllInstallments }),
  toggleCardStatementPaid: (month: string) =>
    invoke<boolean>("toggle_card_statement_paid", { month }),

  // Histórico de ações
  listActivityLogs: (area?: string | null, limit?: number) =>
    invoke<ActivityLog[]>("list_activity_logs", {
      area: area ?? null,
      limit: limit ?? 200,
    }),
  clearActivityLogs: () => invoke<void>("clear_activity_logs"),

  // Versão e atualizações
  getAppVersion: () => invoke<string>("get_app_version"),
  openReleaseUrl: (url: string) => invoke<void>("open_release_url", { url }),
};

export type CategoryKind = "income" | "expense";

export type PaymentMethod =
  | "PIX"
  | "Dinheiro"
  | "Boleto"
  | "Cartão"
  | "Transferência";

export const PAYMENT_METHODS: PaymentMethod[] = [
  "PIX",
  "Dinheiro",
  "Boleto",
  "Cartão",
  "Transferência",
];

export interface AppSettings {
  primaryColor: string;
  secondaryColor: string;
  cardClosingDay: number;
  cardDueDay: number;
  fontScale: number;
  companyName: string;
  companyLogo: string;
}

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
}

export interface FixedCost {
  id: number;
  title: string;
  amountCents: number;
  dueDay: number;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethod: PaymentMethod;
  active: boolean;
  startMonth: string;
}

export interface FixedCostEntry {
  id: number;
  fixedCostId: number;
  month: string;
  title: string;
  amountCents: number;
  dueDay: number;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethod: PaymentMethod;
  paid: boolean;
  paidAt: string | null;
}

export interface BankTransaction {
  id: number;
  kind: CategoryKind;
  title: string;
  amountCents: number;
  date: string;
  month: string;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethod: PaymentMethod;
  paid: boolean;
  notes: string | null;
}

export interface CardTransaction {
  id: number;
  title: string;
  amountCents: number;
  purchaseDate: string;
  billingMonth: string;
  installmentNumber: number;
  installmentTotal: number;
  installmentGroupId: string | null;
  categoryId: number | null;
  categoryName: string | null;
}

export interface CardStatementView {
  month: string;
  totalCents: number;
  paid: boolean;
  paidAt: string | null;
  closingDay: number;
  dueDay: number;
  transactions: CardTransaction[];
}

export interface PendingItem {
  source: "fixed" | "bank" | "card";
  id: number;
  title: string;
  amountCents: number;
  dueInfo: string;
}

export interface DashboardSummary {
  month: string;
  incomeCents: number;
  incomeReceivedCents: number;
  fixedPaidCents: number;
  fixedPendingCents: number;
  bankExpensePaidCents: number;
  bankExpensePendingCents: number;
  cardTotalCents: number;
  cardPaid: boolean;
  totalPaidCents: number;
  totalPendingCents: number;
  balanceCents: number;
  pendingItems: PendingItem[];
}

export type ActivityArea = "bank" | "fixed" | "card" | "settings";

export interface ActivityLog {
  id: number;
  createdAt: string;
  area: ActivityArea | string;
  action: string;
  summary: string;
}

export type NavTab = "dashboard" | "fixed" | "bank" | "card" | "history" | "settings";

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub primary_color: String,
    pub secondary_color: String,
    pub card_closing_day: i64,
    pub card_due_day: i64,
    pub font_scale: i64,
    pub company_name: String,
    pub company_logo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedCost {
    pub id: i64,
    pub title: String,
    pub amount_cents: i64,
    pub due_day: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method: String,
    pub active: bool,
    pub start_month: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedCostEntry {
    pub id: i64,
    pub fixed_cost_id: i64,
    pub month: String,
    pub title: String,
    pub amount_cents: i64,
    pub due_day: i64,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method: String,
    pub paid: bool,
    pub paid_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BankTransaction {
    pub id: i64,
    pub kind: String,
    pub title: String,
    pub amount_cents: i64,
    pub date: String,
    pub month: String,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
    pub payment_method: String,
    pub paid: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardTransaction {
    pub id: i64,
    pub title: String,
    pub amount_cents: i64,
    pub purchase_date: String,
    pub billing_month: String,
    pub installment_number: i64,
    pub installment_total: i64,
    pub installment_group_id: Option<String>,
    pub category_id: Option<i64>,
    pub category_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardStatementView {
    pub month: String,
    pub total_cents: i64,
    pub paid: bool,
    pub paid_at: Option<String>,
    pub closing_day: i64,
    pub due_day: i64,
    pub transactions: Vec<CardTransaction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingItem {
    pub source: String,
    pub id: i64,
    pub title: String,
    pub amount_cents: i64,
    pub due_info: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardSummary {
    pub month: String,
    pub income_cents: i64,
    pub income_received_cents: i64,
    pub fixed_paid_cents: i64,
    pub fixed_pending_cents: i64,
    pub bank_expense_paid_cents: i64,
    pub bank_expense_pending_cents: i64,
    pub card_total_cents: i64,
    pub card_paid: bool,
    pub total_paid_cents: i64,
    pub total_pending_cents: i64,
    pub balance_cents: i64,
    pub pending_items: Vec<PendingItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityLog {
    pub id: i64,
    pub created_at: String,
    pub area: String,
    pub action: String,
    pub summary: String,
}

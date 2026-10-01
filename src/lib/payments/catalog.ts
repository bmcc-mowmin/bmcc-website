// Funds, preset amounts and membership dues. Shared by the browser and the server.
// (Fund names/descriptions are translated in messages/*.json: fund_<key> / fund_<key>_desc.)

export const FUNDS = [
  { id: "new-bmcc", nameKey: "fund_new_bmcc", descKey: "fund_new_bmcc_desc" },
  { id: "masjid-membership", nameKey: "fund_membership", descKey: "fund_membership_desc" },
  { id: "construct-run", nameKey: "fund_construct", descKey: "fund_construct_desc" },
  { id: "sadaqah-zakat", nameKey: "fund_sadaqah", descKey: "fund_sadaqah_desc" },
  { id: "zakat-fitr", nameKey: "fund_zakat_fitr", descKey: "fund_zakat_fitr_desc" },
] as const;
export type FundId = (typeof FUNDS)[number]["id"];
export const DEFAULT_FUND: FundId = "masjid-membership";
export const isFund = (v: unknown): v is FundId => FUNDS.some((f) => f.id === v);

// English fund names for receipts, admin and payment-provider line items.
export const FUND_LABELS: Record<FundId, string> = {
  "new-bmcc": "Help Us Build New BMCC",
  "masjid-membership": "Masjid Membership",
  "construct-run": "Construct & Run the Masjid",
  "sadaqah-zakat": "Sadaqah / Zakat-ul-Maal",
  "zakat-fitr": "Zakat-ul-Fitr",
};

export const PRESET_AMOUNTS = [25, 50, 100, 250];
export const DEFAULT_AMOUNT = 50;
export const MIN_DONATION = 5;
export const MAX_DONATION = 25_000; // larger gifts: contact the office

export const DUES = {
  MONTHLY: { cents: 100_00, interval: "MONTH" as const, label: "$100/month" },
  YEARLY: { cents: 1_000_00, interval: "YEAR" as const, label: "$1,000/year" },
};

export const usd = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

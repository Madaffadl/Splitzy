// Common travel currencies supported by the multi-currency feature.
// IDR is always the base (settlement currency); others carry fxRate.

export interface CurrencyMeta {
  code: string;
  name: string;
  symbol: string;
  /** Typical integer-only display (no cents), e.g. JPY, KRW, VND. */
  noDecimals?: boolean;
}

export const TRAVEL_CURRENCIES: CurrencyMeta[] = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", noDecimals: true },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫", noDecimals: true },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", noDecimals: true },
  { code: "KRW", name: "South Korean Won", symbol: "₩", noDecimals: true },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "TWD", name: "Taiwan Dollar", symbol: "NT$" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ" },
];

const CURRENCY_MAP = new Map<string, CurrencyMeta>(
  TRAVEL_CURRENCIES.map((c) => [c.code, c])
);

export function getCurrencyMeta(code: string | undefined): CurrencyMeta {
  return CURRENCY_MAP.get(code ?? "IDR") ?? { code: code ?? "IDR", name: code ?? "IDR", symbol: code ?? "Rp" };
}

/**
 * Format an amount with its currency SYMBOL prefix, grouped id-ID style so it
 * reads naturally for Indonesian users. IDR → "Rp 450.000"; VND → "₫ 450.000".
 * Use for per-receipt native display (the amount is in that receipt's currency).
 */
export function formatMoney(amount: number, currency?: string): string {
  const meta = getCurrencyMeta(currency);
  const grouped = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: meta.noDecimals ? 0 : 2,
  }).format(meta.noDecimals ? Math.round(amount) : amount);
  return `${meta.symbol} ${grouped}`;
}

/**
 * Format an amount in its native currency for display.
 * IDR uses Indonesian number format (no symbol — callers add "Rp").
 * Other currencies use en-US Intl with the proper symbol.
 */
export function formatNative(amount: number, currency?: string): string {
  const code = currency && currency !== "IDR" ? currency : undefined;
  if (!code) {
    // IDR — match the existing formatCurrency style (no symbol, id-ID locale)
    return new Intl.NumberFormat("id-ID", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  }
  const meta = getCurrencyMeta(code);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: meta.noDecimals ? 0 : 2,
    }).format(amount);
  } catch {
    return `${meta.symbol} ${amount.toLocaleString()}`;
  }
}

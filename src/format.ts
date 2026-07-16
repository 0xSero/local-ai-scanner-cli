/**
 * Display formatting for the CLI — currency, tables, and compact summaries.
 * Currency is NOT converted across regions; we just format each listing in
 * its native currency so the user sees what the retailer actually charges.
 */

const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  JPY: "ja-JP",
};

/** Format a number as a currency string in the given currency code. */
export function formatPrice(price: number, currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

/** Pad a string to a width, truncating with an ellipsis if too long. */
function pad(str: string, width: number): string {
  if (str.length <= width) return str.padEnd(width);
  return str.slice(0, width - 1) + "…";
}

export interface TableColumn {
  header: string;
  width: number;
  align?: "left" | "right";
}

/** Render rows as a simple fixed-width text table. */
export function renderTable(columns: TableColumn[], rows: (string | number)[][]): string {
  const header = columns.map((c) => pad(c.header, c.width)).join("  ");
  const separator = columns.map((c) => "─".repeat(c.width)).join("  ");
  const body = rows
    .map((row) =>
      columns
        .map((c, i) => {
          const cell = String(row[i] ?? "");
          const field = pad(cell, c.width);
          return c.align === "right" ? field.padStart(c.width) : field;
        })
        .join("  "),
    )
    .join("\n");
  return [header, separator, body].join("\n");
}

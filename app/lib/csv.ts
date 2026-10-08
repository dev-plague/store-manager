// Utilidades para generar CSV (compatible con Excel: BOM UTF-8 + comillas).

// Escapa un valor según RFC 4180.
function escapeValue(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Construye un CSV a partir de encabezados y filas.
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeValue).join(","),
  );
  // BOM para que Excel reconozca UTF-8 (acentos, ñ).
  return `\uFEFF${lines.join("\r\n")}`;
}

// Utilidades monetarias.
//
// Regla de negocio: todos los montos se almacenan como ENTEROS en la unidad
// mínima de la moneda (centavos) para evitar errores de punto flotante.
// Estas funciones son el único punto de conversión entre la entrada del usuario
// (decimal) y la base de datos (entero).

// Convierte un monto decimal (número o texto, ej: "12.50") a centavos.
export function toCents(value: number | string): number {
  const normalized =
    typeof value === "string" ? Number(value.trim().replace(",", ".")) : value;

  if (!Number.isFinite(normalized)) {
    throw new Error(`Monto inválido: ${String(value)}`);
  }

  return Math.round(normalized * 100);
}

// Convierte centavos a un monto decimal.
export function fromCents(cents: number): number {
  return cents / 100;
}

// Moneda y locale por defecto (peso colombiano). El negocio puede sobreescribir
// la moneda; estas constantes se usan cuando no se especifica una.
export const DEFAULT_CURRENCY = "COP";
export const DEFAULT_LOCALE = "es-CO";

// Formatea centavos como moneda para mostrar en la UI (en español).
// Nota: se guarda en la unidad mínima (centavos); Intl aplica los decimales
// que correspondan a la moneda (COP muestra 0 decimales de forma estándar).
export function formatCurrency(
  cents: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(fromCents(cents));
}

// Formato compacto para ejes de gráficas (ej: "$ 50 mil").
export function formatCompactCurrency(
  cents: number,
  currency = DEFAULT_CURRENCY,
  locale = DEFAULT_LOCALE,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(fromCents(cents));
}

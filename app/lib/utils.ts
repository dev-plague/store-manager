import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_TIMEZONE, formatDateInTimeZone } from "~/lib/time";

// Une clases de Tailwind resolviendo conflictos (requerido por shadcn/ui).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Valida un destino de redirección interno para evitar "open redirect".
// Solo se permiten rutas absolutas dentro del propio sitio ("/algo"), nunca
// URLs externas ("https://...") ni protocol-relative ("//evil.com").
export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  fallback = "/dashboard",
): string {
  if (typeof to !== "string") return fallback;
  const trimmed = to.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  return trimmed;
}

// Formatea un instante como "YYYY-MM-DD" en la zona de la tienda (por defecto
// Colombia, UTC-5). Determinista en servidor y cliente para evitar desajustes
// de hidratación.
export function formatDate(
  value: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return formatDateInTimeZone(value, timeZone);
}

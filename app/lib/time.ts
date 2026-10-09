// Utilidades de zona horaria.
//
// La aplicación opera en Colombia (UTC-5, `America/Bogota`, sin horario de
// verano). Los instantes se guardan en UTC (`timestamptz`), pero los límites de
// día/mes de los informes y las fechas mostradas deben calcularse en la zona
// de la tienda. Estas funciones concentran esa conversión.

// Zona por defecto cuando la tienda no define una (o en vistas globales).
export const DEFAULT_TIMEZONE = "America/Bogota";

// Desfase (en milisegundos) de una zona IANA respecto a UTC en un instante.
// Positivo al este de Greenwich; para Colombia es -18.000.000 (-5 h).
export function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }

  // Algunos entornos devuelven "24" para la medianoche con `hour12: false`.
  const hour = values.hour === 24 ? 0 : values.hour;

  // Se comparan segundos (sin milisegundos) para no arrastrar el desfase.
  const asUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    hour,
    values.minute,
    values.second,
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Instante UTC correspondiente a la medianoche local de "YYYY-MM-DD".
export function zonedStartOfDay(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

  // Dos pasadas: el desfase puede cambiar en el límite del día (DST).
  let offset = getTimeZoneOffsetMs(timeZone, guess);
  let instant = new Date(guess.getTime() - offset);
  offset = getTimeZoneOffsetMs(timeZone, instant);
  instant = new Date(guess.getTime() - offset);

  return instant;
}

// Suma (o resta) días a una fecha "YYYY-MM-DD".
export function addDaysToDateString(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

// Formatea un instante como "YYYY-MM-DD" en la zona indicada (determinista,
// igual en servidor y cliente para evitar desajustes de hidratación).
export function formatDateInTimeZone(
  value: Date | string,
  timeZone: string,
): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Fecha "YYYY-MM-DD" de hoy en la zona indicada.
export function todayInTimeZone(timeZone: string, now = new Date()): string {
  return formatDateInTimeZone(now, timeZone);
}

// Primer día del mes actual ("YYYY-MM-01") en la zona indicada.
export function firstDayOfMonthInTimeZone(
  timeZone: string,
  now = new Date(),
): string {
  return `${todayInTimeZone(timeZone, now).slice(0, 7)}-01`;
}

// Desplaza un instante al "reloj local" de la zona, devolviendo un `Date` cuyos
// métodos UTC representan la hora local (útil para aritmética de calendario).
export function toZonedClock(date: Date, timeZone: string): Date {
  return new Date(date.getTime() + getTimeZoneOffsetMs(timeZone, date));
}

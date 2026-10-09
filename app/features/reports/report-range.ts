// Rango de fechas para informes.
//
// Los días son locales a la zona de la tienda (por defecto Colombia, UTC-5).
// Se usa `to` como límite EXCLUSIVO (medianoche local del día siguiente), de
// modo que las consultas usan `created_at >= from AND created_at < to`.

import {
  addDaysToDateString,
  DEFAULT_TIMEZONE,
  firstDayOfMonthInTimeZone,
  todayInTimeZone,
  zonedStartOfDay,
} from "~/lib/time";

export type ReportRange = {
  from: Date;
  to: Date;
  fromParam: string;
  toParam: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Rango por defecto: desde el primer día del mes actual hasta hoy (en la zona).
export function defaultReportRange(timeZone = DEFAULT_TIMEZONE): {
  fromParam: string;
  toParam: string;
} {
  return {
    fromParam: firstDayOfMonthInTimeZone(timeZone),
    toParam: todayInTimeZone(timeZone),
  };
}

// Parsea `from`/`to` de la query, con validación y valores por defecto.
export function parseReportRange(
  params: URLSearchParams,
  timeZone = DEFAULT_TIMEZONE,
): ReportRange {
  const defaults = defaultReportRange(timeZone);

  let fromParam = params.get("from") ?? defaults.fromParam;
  let toParam = params.get("to") ?? defaults.toParam;

  if (!DATE_PATTERN.test(fromParam)) fromParam = defaults.fromParam;
  if (!DATE_PATTERN.test(toParam)) toParam = defaults.toParam;

  // Si vienen invertidos, se corrigen.
  if (fromParam > toParam) {
    [fromParam, toParam] = [toParam, fromParam];
  }

  const from = zonedStartOfDay(fromParam, timeZone);
  const to = zonedStartOfDay(addDaysToDateString(toParam, 1), timeZone);

  return { from, to, fromParam, toParam };
}

// Rango de fechas para informes.
// Se trabaja en UTC con `to` como límite EXCLUSIVO (inicio del día siguiente),
// de modo que las consultas usan `created_at >= from AND created_at < to`.

export type ReportRange = {
  from: Date;
  to: Date;
  fromParam: string;
  toParam: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Rango por defecto: desde el primer día del mes actual hasta hoy.
export function defaultReportRange(): { fromParam: string; toParam: string } {
  const now = new Date();
  const firstDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  return { fromParam: toIsoDate(firstDay), toParam: toIsoDate(now) };
}

// Parsea `from`/`to` de la query, con validación y valores por defecto.
export function parseReportRange(params: URLSearchParams): ReportRange {
  const defaults = defaultReportRange();

  let fromParam = params.get("from") ?? defaults.fromParam;
  let toParam = params.get("to") ?? defaults.toParam;

  if (!DATE_PATTERN.test(fromParam)) fromParam = defaults.fromParam;
  if (!DATE_PATTERN.test(toParam)) toParam = defaults.toParam;

  // Si vienen invertidos, se corrigen.
  if (fromParam > toParam) {
    [fromParam, toParam] = [toParam, fromParam];
  }

  const from = new Date(`${fromParam}T00:00:00.000Z`);
  const to = new Date(`${toParam}T00:00:00.000Z`);
  to.setUTCDate(to.getUTCDate() + 1);

  return { from, to, fromParam, toParam };
}

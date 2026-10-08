import { z } from "zod";
import { authContext } from "~/context";
import { parseReportRange } from "~/features/reports/report-range";
import {
  getCustomerReport,
  listReportMovements,
} from "~/features/reports/services/report.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { toCsv } from "~/lib/csv";
import { fromCents } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/reports-export";

// Ruta de recurso: descarga CSV de informes.
//   /dashboard/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=movements|customers

function money(cents: number): string {
  return fromCents(cents).toFixed(2);
}

function formatDate(value: Date): string {
  const date = new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "metrics:read");

  const businessId = await requireBusinessId(request, auth);
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "movements";
  const range = parseReportRange(url.searchParams);

  const customerIdRaw = url.searchParams.get("customerId");
  const customerId =
    customerIdRaw && z.uuid().safeParse(customerIdRaw).success
      ? customerIdRaw
      : null;

  if (format === "customers") {
    const rows = await getCustomerReport(businessId, range, customerId);
    const csv = toCsv(
      ["Cliente", "Deudas", "Abonos", "Neto", "Saldo pendiente"],
      rows.map((row) => [
        row.customerName,
        money(row.debtCents),
        money(row.paymentCents),
        money(row.balanceCents),
        money(row.outstandingCents),
      ]),
    );

    return csvResponse(
      csv,
      `informe-clientes-${range.fromParam}_${range.toParam}.csv`,
    );
  }

  const rows = await listReportMovements(businessId, range, customerId);
  const csv = toCsv(
    ["Fecha", "Cliente", "Tipo", "Monto", "Descripción"],
    rows.map((row) => [
      formatDate(row.createdAt),
      row.customerName,
      row.type === "DEBT" ? "Deuda" : "Abono",
      money(row.amountCents),
      row.description ?? "",
    ]),
  );

  return csvResponse(
    csv,
    `informe-movimientos-${range.fromParam}_${range.toParam}.csv`,
  );
}

import { Receipt, SlidersHorizontal, Users, X } from "lucide-react";
import { useState } from "react";
import { Form, useNavigate } from "react-router";
import { z } from "zod";
import {
  CustomerSearch,
  type CustomerSuggestion,
} from "~/components/customer-search";
import { authContext } from "~/context";
import { getBusinessById } from "~/features/businesses/services/business.server";
import { getCustomerById, listCustomerOptions } from "~/features/customers/services/customer.server";
import { parseReportRange } from "~/features/reports/report-range";
import {
  getCustomerReport,
  getReportSummary,
  listReportMovements,
} from "~/features/reports/services/report.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { DEFAULT_CURRENCY, formatCurrency } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.reports";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Informes · Gestor de Tienda" }];
}

// Formatea una fecha de forma determinista (evita desajustes de hidratación).
function formatDate(value: Date): string {
  const date = new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "metrics:read");

  const businessId = await requireBusinessId(request, auth);
  const url = new URL(request.url);
  const range = parseReportRange(url.searchParams);

  const customerIdRaw = url.searchParams.get("customerId");
  const customerId =
    customerIdRaw && z.uuid().safeParse(customerIdRaw).success
      ? customerIdRaw
      : null;

  const [summary, movements, customerRows, business, selectedCustomer, customerOptions] =
    await Promise.all([
      getReportSummary(businessId, range, customerId),
      listReportMovements(businessId, range, customerId),
      getCustomerReport(businessId, range, customerId),
      getBusinessById(businessId),
      customerId
        ? getCustomerById(businessId, customerId)
        : Promise.resolve(null),
      listCustomerOptions(businessId),
    ]);

  return {
    summary,
    movements,
    customerRows,
    fromParam: range.fromParam,
    toParam: range.toParam,
    currency: business?.currency ?? DEFAULT_CURRENCY,
    customerId,
    selectedCustomerName: selectedCustomer
      ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
      : null,
    customerOptions,
  };
}

// Botón solo con icono (compacto y accesible).
const iconButtonClass =
  "grid size-11 shrink-0 place-items-center rounded-xl border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground";

type ReportTab = "customers" | "movements";

export default function Reports({ loaderData }: Route.ComponentProps) {
  const {
    summary,
    movements,
    customerRows,
    fromParam,
    toParam,
    currency,
    customerId,
    selectedCustomerName,
    customerOptions,
  } = loaderData;

  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<ReportTab>("customers");

  function applyCustomer(customer: CustomerSuggestion) {
    const params = new URLSearchParams({ from: fromParam, to: toParam });
    params.set("customerId", customer.id);
    navigate(`/dashboard/reports?${params.toString()}`);
  }

  function clearCustomer() {
    const params = new URLSearchParams({ from: fromParam, to: toParam });
    navigate(`/dashboard/reports?${params.toString()}`);
  }

  const exportBase = `/dashboard/reports/export?from=${fromParam}&to=${toParam}${
    customerId ? `&customerId=${customerId}` : ""
  }`;

  const summaryItems = [
    { label: "Movimientos", value: String(summary.entryCount), money: false },
    { label: "Deudas", value: summary.totalDebtCents, money: true },
    { label: "Abonos", value: summary.totalPaymentCents, money: true },
    { label: "Neto", value: summary.balanceCents, money: true },
    { label: "Pendiente", value: summary.outstandingCents, money: true },
  ];

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-2.5 text-base font-semibold transition-colors ${
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <div className="space-y-6">
      {/* Encabezado + acción de filtros */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Informes</h1>
          <p className="text-sm text-muted-foreground">
            Del {fromParam} al {toParam}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((value) => !value)}
          aria-label="Filtros"
          aria-expanded={showFilters}
          title="Filtros"
          className={
            showFilters
              ? "grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
              : iconButtonClass
          }
        >
          <SlidersHorizontal className="size-5" />
        </button>
      </div>

      {/* Búsqueda por cliente (autocompletado) */}
      {selectedCustomerName ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm">
          <span className="min-w-0 truncate text-base">
            Cliente: <strong>{selectedCustomerName}</strong>
          </span>
          <button
            type="button"
            onClick={clearCustomer}
            aria-label="Quitar filtro de cliente"
            title="Quitar filtro de cliente"
            className={iconButtonClass}
          >
            <X className="size-5" />
          </button>
        </div>
      ) : (
        <CustomerSearch customers={customerOptions} onSelect={applyCustomer} />
      )}

      {/* Filtros colapsables */}
      {showFilters ? (
        <Form
          method="get"
          className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
        >
          {customerId ? (
            <input type="hidden" name="customerId" value={customerId} />
          ) : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">Desde</span>
            <input
              type="date"
              name="from"
              defaultValue={fromParam}
              className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">Hasta</span>
            <input
              type="date"
              name="to"
              defaultValue={toParam}
              className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Aplicar rango
          </button>
        </Form>
      ) : null}

      {/* Resumen */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Resumen</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border bg-card p-3 shadow-sm"
            >
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-1 text-base font-semibold">
                {item.money
                  ? formatCurrency(Number(item.value), currency)
                  : item.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs: por cliente / movimientos */}
      <section className="space-y-3">
        <div
          role="tablist"
          aria-label="Detalle del informe"
          className="grid grid-cols-2 gap-1 rounded-xl border bg-card p-1 shadow-sm"
        >
          <button
            type="button"
            role="tab"
            id="tab-customers"
            aria-selected={tab === "customers"}
            aria-controls="panel-customers"
            onClick={() => setTab("customers")}
            className={tabClass(tab === "customers")}
          >
            Por cliente ({customerRows.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-movements"
            aria-selected={tab === "movements"}
            aria-controls="panel-movements"
            onClick={() => setTab("movements")}
            className={tabClass(tab === "movements")}
          >
            Movimientos ({movements.length})
          </button>
        </div>

        {tab === "customers" ? (
          <div
            role="tabpanel"
            id="panel-customers"
            aria-labelledby="tab-customers"
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {customerRows.length} cliente
                {customerRows.length === 1 ? "" : "s"} con movimientos
              </span>
              <a
                href={`${exportBase}&format=customers`}
                aria-label="Descargar por cliente (CSV)"
                title="Descargar por cliente (CSV)"
                className={iconButtonClass}
              >
                <Users className="size-5" />
              </a>
            </div>

            {customerRows.length === 0 ? (
              <p className="rounded-xl border bg-card p-6 text-center text-base text-muted-foreground shadow-sm">
                Sin movimientos en el período.
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
                {customerRows.map((row) => (
                  <li key={row.customerId} className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-base font-semibold">
                        {row.customerName}
                      </span>
                      <span
                        className={
                          row.outstandingCents > 0
                            ? "shrink-0 text-base font-semibold text-destructive"
                            : "shrink-0 text-base font-semibold text-muted-foreground"
                        }
                      >
                        {formatCurrency(row.outstandingCents, currency)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Deudas {formatCurrency(row.debtCents, currency)} · Abonos{" "}
                      {formatCurrency(row.paymentCents, currency)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div
            role="tabpanel"
            id="panel-movements"
            aria-labelledby="tab-movements"
            className="space-y-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {movements.length} movimiento
                {movements.length === 1 ? "" : "s"}
              </span>
              <a
                href={`${exportBase}&format=movements`}
                aria-label="Descargar movimientos (CSV)"
                title="Descargar movimientos (CSV)"
                className={iconButtonClass}
              >
                <Receipt className="size-5" />
              </a>
            </div>

            {movements.length === 0 ? (
              <p className="rounded-xl border bg-card p-6 text-center text-base text-muted-foreground shadow-sm">
                Sin movimientos en el período.
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
                {movements.map((movement) => (
                  <li
                    key={movement.id}
                    className="flex items-center justify-between gap-3 p-4 text-base transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {movement.customerName}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {formatDate(movement.createdAt)}
                        {movement.description
                          ? ` · ${movement.description}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={
                        movement.type === "DEBT"
                          ? "shrink-0 font-semibold text-destructive"
                          : "shrink-0 font-semibold text-emerald-600"
                      }
                    >
                      {movement.type === "DEBT" ? "+" : "−"}
                      {formatCurrency(movement.amountCents, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

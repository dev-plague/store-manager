import { Receipt, SlidersHorizontal, Users, X } from "lucide-react";
import { useState } from "react";
import { Form, useNavigate } from "react-router";
import { z } from "zod";
import {
  CustomerSearch,
  type CustomerSuggestion,
} from "~/components/customer-search";
import { SubmitButton } from "~/components/submit-button";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { authContext } from "~/context";
import { getBusinessById } from "~/features/businesses/services/business.server";
import {
  getCustomerById,
  listCustomerOptions,
} from "~/features/customers/services/customer.server";
import { parseReportRange } from "~/features/reports/report-range";
import {
  getCustomerReport,
  getReportSummary,
  listReportMovements,
} from "~/features/reports/services/report.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { DEFAULT_CURRENCY, formatCurrency } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import { DEFAULT_TIMEZONE } from "~/lib/time";
import { formatDate } from "~/lib/utils";
import type { Route } from "./+types/dashboard.reports";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Informes · Gestor de Tienda" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "metrics:read");

  const businessId = await requireBusinessId(request, auth);
  const url = new URL(request.url);
  const business = await getBusinessById(businessId);
  const timeZone = business?.timezone ?? DEFAULT_TIMEZONE;
  const range = parseReportRange(url.searchParams, timeZone);

  const customerIdRaw = url.searchParams.get("customerId");
  const customerId =
    customerIdRaw && z.uuid().safeParse(customerIdRaw).success
      ? customerIdRaw
      : null;

  const [summary, movements, customerRows, selectedCustomer, customerOptions] =
    await Promise.all([
      getReportSummary(businessId, range, customerId),
      listReportMovements(businessId, range, customerId),
      getCustomerReport(businessId, range, customerId),
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
    timeZone,
    customerId,
    selectedCustomerName: selectedCustomer
      ? `${selectedCustomer.firstName} ${selectedCustomer.lastName}`
      : null,
    customerOptions,
  };
}

type ReportTab = "customers" | "movements";

export default function Reports({ loaderData }: Route.ComponentProps) {
  const {
    summary,
    movements,
    customerRows,
    fromParam,
    toParam,
    currency,
    timeZone,
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
        <Button
          type="button"
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters((value) => !value)}
          aria-label="Filtros"
          aria-expanded={showFilters}
          title="Filtros"
          className="size-11 rounded-xl"
        >
          <SlidersHorizontal className="size-5" />
        </Button>
      </div>

      {/* Búsqueda por cliente (autocompletado) */}
      {selectedCustomerName ? (
        <Card className="flex-row items-center justify-between gap-3 p-3">
          <span className="min-w-0 truncate text-base">
            Cliente: <strong>{selectedCustomerName}</strong>
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={clearCustomer}
            aria-label="Quitar filtro de cliente"
            title="Quitar filtro de cliente"
            className="size-11 shrink-0 rounded-xl"
          >
            <X className="size-5" />
          </Button>
        </Card>
      ) : (
        <CustomerSearch customers={customerOptions} onSelect={applyCustomer} />
      )}

      {/* Filtros colapsables */}
      {showFilters ? (
        <Card className="gap-3 p-4">
          <Form method="get" className="space-y-3">
            {customerId ? (
              <input type="hidden" name="customerId" value={customerId} />
            ) : null}
            <div className="space-y-1.5">
              <label htmlFor="from" className="text-base font-medium">
                Desde
              </label>
              <Input
                id="from"
                type="date"
                name="from"
                defaultValue={fromParam}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="to" className="text-base font-medium">
                Hasta
              </label>
              <Input
                id="to"
                type="date"
                name="to"
                defaultValue={toParam}
                className="h-12 rounded-xl text-base"
              />
            </div>
            <SubmitButton
              mode="any"
              pendingText="Aplicando…"
              className="h-12 w-full rounded-xl text-base"
            >
              Aplicar rango
            </SubmitButton>
          </Form>
        </Card>
      ) : null}

      {/* Resumen */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Resumen</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {summaryItems.map((item) => (
            <Card key={item.label} className="gap-1 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {item.label}
              </p>
              <p className="text-base font-semibold">
                {item.money
                  ? formatCurrency(Number(item.value), currency)
                  : item.value}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* Tabs: por cliente / movimientos */}
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as ReportTab)}
        className="space-y-3"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customers">
            Por cliente ({customerRows.length})
          </TabsTrigger>
          <TabsTrigger value="movements">
            Movimientos ({movements.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {customerRows.length} cliente
              {customerRows.length === 1 ? "" : "s"} con movimientos
            </span>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="size-11 rounded-xl"
            >
              <a
                href={`${exportBase}&format=customers`}
                aria-label="Descargar por cliente (CSV)"
                title="Descargar por cliente (CSV)"
              >
                <Users className="size-5" />
              </a>
            </Button>
          </div>

          {customerRows.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-base text-muted-foreground">
                Sin movimientos en el período.
              </p>
            </Card>
          ) : (
            <Card className="gap-0 p-0">
              <ul className="divide-y">
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
            </Card>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {movements.length} movimiento
              {movements.length === 1 ? "" : "s"}
            </span>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="size-11 rounded-xl"
            >
              <a
                href={`${exportBase}&format=movements`}
                aria-label="Descargar movimientos (CSV)"
                title="Descargar movimientos (CSV)"
              >
                <Receipt className="size-5" />
              </a>
            </Button>
          </div>

          {movements.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-base text-muted-foreground">
                Sin movimientos en el período.
              </p>
            </Card>
          ) : (
            <Card className="gap-0 p-0">
              <ul className="divide-y">
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
                        {formatDate(movement.createdAt, timeZone)}
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
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

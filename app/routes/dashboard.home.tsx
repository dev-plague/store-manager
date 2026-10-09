import { Form } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { Card } from "~/components/ui/card";
import { authContext } from "~/context";
import {
  getBusinessById,
  listBusinessesWithMetrics,
} from "~/features/businesses/services/business.server";
import {
  BalanceRankingChart,
  MonthlyFlowChart,
} from "~/features/metrics/components/balance-charts";
import {
  getBusinessMetrics,
  getGlobalMetrics,
  getMonthlyFlow,
  listCustomerBalances,
} from "~/features/metrics/services/metrics.server";
import {
  getActiveBusinessId,
  requireBusinessId,
} from "~/lib/business-context.server";
import { DEFAULT_CURRENCY, formatCurrency } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import { DEFAULT_TIMEZONE } from "~/lib/time";
import type { Route } from "./+types/dashboard.home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Panel · Gestor de Tienda" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "metrics:read");

  // Vista global para el Administrador Global (sin tienda asignada).
  if (auth.isSuperadmin) {
    const [globalMetrics, businessList, activeBusinessId, monthlyFlow] =
      await Promise.all([
        getGlobalMetrics(),
        listBusinessesWithMetrics(),
        getActiveBusinessId(request, auth),
        getMonthlyFlow(null, 6, DEFAULT_TIMEZONE),
      ]);

    return {
      scope: "global" as const,
      globalMetrics,
      businessList,
      activeBusinessId,
      monthlyFlow,
      currency: DEFAULT_CURRENCY,
    };
  }

  // Vista por tienda para usuarios normales.
  const businessId = await requireBusinessId(request, auth);
  const business = await getBusinessById(businessId);
  const timeZone = business?.timezone ?? DEFAULT_TIMEZONE;

  const [metrics, balances, monthlyFlow] = await Promise.all([
    getBusinessMetrics(businessId),
    listCustomerBalances(businessId),
    getMonthlyFlow(businessId, 6, timeZone),
  ]);

  const topDebtors = balances
    .filter((customer) => customer.outstandingCents > 0)
    .sort((a, b) => b.outstandingCents - a.outstandingCents)
    .slice(0, 6)
    .map((customer) => ({
      label: `${customer.firstName} ${customer.lastName}`,
      value: customer.outstandingCents,
    }));

  return {
    scope: "business" as const,
    metrics,
    topDebtors,
    monthlyFlow,
    currency: DEFAULT_CURRENCY,
  };
}

export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  if (loaderData.scope === "global") {
    return <GlobalPanel {...loaderData} />;
  }

  return <BusinessPanel {...loaderData} />;
}

// Tarjeta contenedora de una gráfica.
function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Panel global (Superadmin)
// ---------------------------------------------------------------------------

function GlobalPanel({
  globalMetrics,
  businessList,
  activeBusinessId,
  monthlyFlow,
  currency,
}: Extract<Route.ComponentProps["loaderData"], { scope: "global" }>) {
  const cards = [
    { label: "Tiendas", value: String(globalMetrics.businessCount) },
    { label: "Clientes", value: String(globalMetrics.customerCount) },
    {
      label: "Deuda total",
      value: formatCurrency(globalMetrics.totalDebtCents, currency),
    },
    {
      label: "Abonos totales",
      value: formatCurrency(globalMetrics.totalPaymentCents, currency),
    },
    {
      label: "Deuda pendiente",
      value: formatCurrency(globalMetrics.outstandingCents, currency),
    },
  ];

  const businessRanking = businessList
    .filter((business) => business.outstandingCents > 0)
    .sort((a, b) => b.outstandingCents - a.outstandingCents)
    .slice(0, 8)
    .map((business) => ({
      label: business.name,
      value: business.outstandingCents,
    }));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label} className="gap-1 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className="text-lg font-semibold">{card.value}</p>
          </Card>
        ))}
      </section>

      <ChartCard title="Flujo mensual (todas las tiendas)">
        <MonthlyFlowChart data={monthlyFlow} currency={currency} />
      </ChartCard>

      {businessRanking.length > 0 ? (
        <ChartCard title="Deuda pendiente por tienda">
          <BalanceRankingChart data={businessRanking} currency={currency} />
        </ChartCard>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Tiendas</h2>
        {businessList.length === 0 ? (
          <Card className="p-6">
            <p className="text-center text-sm text-muted-foreground">
              No hay tiendas registradas.
            </p>
          </Card>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {businessList.map((business) => {
                const isActive = business.id === activeBusinessId;
                return (
                  <li
                    key={business.id}
                    className="flex items-center justify-between gap-3 p-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        <span className="truncate">{business.name}</span>
                        {isActive ? (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            activa
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {business.customerCount} clientes · pendiente{" "}
                        {formatCurrency(business.outstandingCents, currency)}
                      </p>
                    </div>
                    <Form method="post" action="/select-business">
                      <input
                        type="hidden"
                        name="businessId"
                        value={business.id}
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value="/dashboard/customers"
                      />
                      <SubmitButton
                        variant="outline"
                        size="sm"
                        pendingText="Abriendo…"
                      >
                        Gestionar
                      </SubmitButton>
                    </Form>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {activeBusinessId ? (
          <Form method="post" action="/select-business">
            <input type="hidden" name="businessId" value="" />
            <SubmitButton
              variant="link"
              pendingText="Quitando…"
              className="h-auto p-0 text-xs text-muted-foreground"
            >
              Quitar tienda activa
            </SubmitButton>
          </Form>
        ) : null}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel de una tienda (usuario normal)
// ---------------------------------------------------------------------------

function BusinessPanel({
  metrics,
  topDebtors,
  monthlyFlow,
  currency,
}: Extract<Route.ComponentProps["loaderData"], { scope: "business" }>) {
  const cards = [
    { label: "Deuda total", value: metrics.totalDebtCents },
    { label: "Abonos totales", value: metrics.totalPaymentCents },
    { label: "Deuda pendiente", value: metrics.outstandingCents },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="gap-1 p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className="text-xl font-semibold">
              {formatCurrency(card.value, currency)}
            </p>
          </Card>
        ))}
      </div>

      <ChartCard title="Flujo mensual (deudas vs abonos)">
        <MonthlyFlowChart data={monthlyFlow} currency={currency} />
      </ChartCard>

      <ChartCard title="Mayores deudores">
        {topDebtors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay deudas pendientes.
          </p>
        ) : (
          <BalanceRankingChart data={topDebtors} currency={currency} />
        )}
      </ChartCard>
    </div>
  );
}

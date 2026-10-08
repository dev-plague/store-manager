import { Form } from "react-router";
import { authContext } from "~/context";
import { listBusinessesWithMetrics } from "~/features/businesses/services/business.server";
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
        getMonthlyFlow(null),
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

  const [metrics, balances, monthlyFlow] = await Promise.all([
    getBusinessMetrics(businessId),
    listCustomerBalances(businessId),
    getMonthlyFlow(businessId),
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
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
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
    { label: "Deuda total", value: formatCurrency(globalMetrics.totalDebtCents, currency) },
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
          <div
            key={card.label}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-lg font-semibold">{card.value}</p>
          </div>
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
          <p className="text-sm text-muted-foreground">
            No hay tiendas registradas.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
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
                    <input type="hidden" name="businessId" value={business.id} />
                    <button
                      type="submit"
                      className="rounded-md border px-3 py-1.5 text-xs font-medium"
                    >
                      Gestionar
                    </button>
                  </Form>
                </li>
              );
            })}
          </ul>
        )}

        {activeBusinessId ? (
          <Form method="post" action="/select-business">
            <input type="hidden" name="businessId" value="" />
            <button
              type="submit"
              className="text-xs text-muted-foreground underline"
            >
              Quitar tienda activa
            </button>
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
          <div
            key={card.label}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <p className="text-xs font-medium text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(card.value, currency)}
            </p>
          </div>
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

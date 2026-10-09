import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumn,
  Plus,
  Store,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Form, Link } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { Button } from "~/components/ui/button";
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
  listRecentMovements,
} from "~/features/metrics/services/metrics.server";
import {
  getActiveBusinessId,
  requireBusinessId,
} from "~/lib/business-context.server";
import { DEFAULT_CURRENCY, formatCurrency } from "~/lib/money";
import type { Permission } from "~/lib/permissions";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import { DEFAULT_TIMEZONE } from "~/lib/time";
import { cn, formatDate } from "~/lib/utils";
import type { Route } from "./+types/dashboard.home";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Panel · Gestor de Tienda" }];
}

// Tonos de color para los "chips" de icono (se adaptan a claro/oscuro).
const TONES = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
} as const;

type Tone = keyof typeof TONES;

function todayLabel(timeZone: string): string {
  const label = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(new Date());
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "metrics:read");

  const can = (permission: Permission) =>
    auth.isSuperadmin || auth.permissions.has(permission);

  const flags = {
    canCreateCustomers: can("customers:create"),
    canReadCustomers: can("customers:read"),
    canManageUsers: can("users:manage"),
    canManageBusinesses: can("businesses:manage"),
  };

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
      userName: auth.user.name,
      dateLabel: todayLabel(DEFAULT_TIMEZONE),
      globalMetrics,
      businessList,
      activeBusinessId,
      monthlyFlow,
      currency: DEFAULT_CURRENCY,
      ...flags,
    };
  }

  // Vista por tienda para usuarios normales.
  const businessId = await requireBusinessId(request, auth);
  const business = await getBusinessById(businessId);
  const timeZone = business?.timezone ?? DEFAULT_TIMEZONE;

  const [metrics, balances, monthlyFlow, recentMovements] = await Promise.all([
    getBusinessMetrics(businessId),
    listCustomerBalances(businessId),
    getMonthlyFlow(businessId, 6, timeZone),
    listRecentMovements(businessId, 6),
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
    userName: auth.user.name,
    dateLabel: todayLabel(timeZone),
    businessName: business?.name ?? null,
    metrics,
    topDebtors,
    monthlyFlow,
    recentMovements,
    timeZone,
    currency: business?.currency ?? DEFAULT_CURRENCY,
    ...flags,
  };
}

export default function DashboardHome({ loaderData }: Route.ComponentProps) {
  if (loaderData.scope === "global") {
    return <GlobalPanel {...loaderData} />;
  }

  return <BusinessPanel {...loaderData} />;
}

// ---------------------------------------------------------------------------
// Piezas compartidas
// ---------------------------------------------------------------------------

function Greeting({ name, date }: { name: string; date: string }) {
  const firstName = name.split(/\s+/)[0] ?? name;
  return (
    <div>
      <p className="text-sm text-muted-foreground">{date}</p>
      <h1 className="text-2xl font-bold tracking-tight">
        Hola, {firstName} <span aria-hidden>👋</span>
      </h1>
    </div>
  );
}

// Tarjeta de balance destacada (hero) con degradado de marca.
function HeroBalance({
  label,
  amount,
  currency,
  stats,
}: {
  label: string;
  amount: number;
  currency: string;
  stats: { label: string; value: string }[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-600/20">
      <div className="pointer-events-none absolute -top-10 -right-8 size-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 size-36 rounded-full bg-white/10" />
      <div className="relative">
        <p className="text-sm font-medium text-white/80">{label}</p>
        <p className="mt-1 text-4xl font-bold tracking-tight">
          {formatCurrency(amount, currency)}
        </p>
        {stats.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl bg-white/15 px-3 py-2 backdrop-blur-sm"
              >
                <p className="text-xs text-white/80">{stat.label}</p>
                <p className="text-sm font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type QuickAction = {
  to: string;
  label: string;
  icon: LucideIcon;
  tone: Tone;
};

function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-semibold">Accesos rápidos</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.to}
              to={action.to}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-background/50 p-3 text-center transition-colors hover:bg-muted"
            >
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-2xl",
                  TONES[action.tone],
                )}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-xs font-medium">{action.label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: Tone;
  hint?: string;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl",
            TONES[tone],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold">{value}</p>
        </div>
      </div>
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </Card>
  );
}

function ChartCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Panel de una tienda (usuario normal)
// ---------------------------------------------------------------------------

function BusinessPanel({
  userName,
  dateLabel,
  metrics,
  topDebtors,
  monthlyFlow,
  recentMovements,
  timeZone,
  currency,
  canCreateCustomers,
  canReadCustomers,
  canManageUsers,
}: Extract<Route.ComponentProps["loaderData"], { scope: "business" }>) {
  const actions: QuickAction[] = [
    ...(canCreateCustomers
      ? [
          {
            to: "/dashboard/customers/new",
            label: "Nuevo cliente",
            icon: Plus,
            tone: "emerald" as Tone,
          },
        ]
      : []),
    ...(canReadCustomers
      ? [
          {
            to: "/dashboard/customers",
            label: "Clientes",
            icon: Users,
            tone: "sky" as Tone,
          },
        ]
      : []),
    {
      to: "/dashboard/reports",
      label: "Informes",
      icon: ChartColumn,
      tone: "violet" as Tone,
    },
    ...(canManageUsers
      ? [
          {
            to: "/dashboard/users",
            label: "Usuarios",
            icon: UserCog,
            tone: "amber" as Tone,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <Greeting name={userName} date={dateLabel} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroBalance
            label="Deuda pendiente"
            amount={metrics.outstandingCents}
            currency={currency}
            stats={[
              {
                label: "Deudas",
                value: formatCurrency(metrics.totalDebtCents, currency),
              },
              {
                label: "Abonos",
                value: formatCurrency(metrics.totalPaymentCents, currency),
              },
              {
                label: "Clientes",
                value: String(metrics.customerCount),
              },
            ]}
          />
        </div>
        <QuickActions actions={actions} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Deuda total"
          value={formatCurrency(metrics.totalDebtCents, currency)}
          icon={ArrowUpRight}
          tone="rose"
        />
        <KpiCard
          label="Abonos totales"
          value={formatCurrency(metrics.totalPaymentCents, currency)}
          icon={ArrowDownRight}
          tone="emerald"
        />
        <KpiCard
          label="Saldo neto"
          value={formatCurrency(metrics.balanceCents, currency)}
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Flujo mensual (deudas vs abonos)">
          <MonthlyFlowChart data={monthlyFlow} currency={currency} />
        </ChartCard>

        <Card className="gap-0 p-0">
          <div className="flex items-center justify-between gap-2 p-4 pb-2">
            <h2 className="text-sm font-semibold">Actividad reciente</h2>
            <Button
              asChild
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
            >
              <Link to="/dashboard/customers">Ver clientes</Link>
            </Button>
          </div>
          {recentMovements.length === 0 ? (
            <p className="p-4 pt-2 text-sm text-muted-foreground">
              Aún no hay movimientos registrados.
            </p>
          ) : (
            <ul className="divide-y">
              {recentMovements.map((movement) => {
                const isDebt = movement.type === "DEBT";
                return (
                  <li
                    key={movement.id}
                    className="flex items-center gap-3 p-4 text-sm"
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-full",
                        isDebt ? TONES.rose : TONES.emerald,
                      )}
                    >
                      {isDebt ? (
                        <ArrowUpRight className="size-5" aria-hidden />
                      ) : (
                        <ArrowDownRight className="size-5" aria-hidden />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {movement.customerName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {movement.description ??
                          (isDebt ? "Deuda" : "Abono")}{" "}
                        · {formatDate(movement.createdAt, timeZone)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 font-semibold",
                        isDebt ? "text-rose-600" : "text-emerald-600",
                      )}
                    >
                      {isDebt ? "+" : "−"}
                      {formatCurrency(movement.amountCents, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

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

// ---------------------------------------------------------------------------
// Panel global (Superadmin)
// ---------------------------------------------------------------------------

function GlobalPanel({
  userName,
  dateLabel,
  globalMetrics,
  businessList,
  activeBusinessId,
  monthlyFlow,
  currency,
  canManageBusinesses,
}: Extract<Route.ComponentProps["loaderData"], { scope: "global" }>) {
  const actions: QuickAction[] = [
    {
      to: "/dashboard/businesses",
      label: "Tiendas",
      icon: Store,
      tone: "sky",
    },
    ...(canManageBusinesses
      ? [
          {
            to: "/dashboard/businesses/new",
            label: "Nueva tienda",
            icon: Plus,
            tone: "emerald" as Tone,
          },
        ]
      : []),
    {
      to: "/dashboard/reports",
      label: "Informes",
      icon: ChartColumn,
      tone: "violet",
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
      <Greeting name={userName} date={dateLabel} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroBalance
            label="Deuda pendiente (global)"
            amount={globalMetrics.outstandingCents}
            currency={currency}
            stats={[
              {
                label: "Tiendas",
                value: String(globalMetrics.businessCount),
              },
              {
                label: "Clientes",
                value: String(globalMetrics.customerCount),
              },
              {
                label: "Deuda total",
                value: formatCurrency(globalMetrics.totalDebtCents, currency),
              },
            ]}
          />
        </div>
        <QuickActions actions={actions} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Tiendas"
          value={String(globalMetrics.businessCount)}
          icon={Store}
          tone="sky"
        />
        <KpiCard
          label="Clientes"
          value={String(globalMetrics.customerCount)}
          icon={Users}
          tone="violet"
        />
        <KpiCard
          label="Abonos totales"
          value={formatCurrency(globalMetrics.totalPaymentCents, currency)}
          icon={Wallet}
          tone="emerald"
        />
        <KpiCard
          label="Deuda pendiente"
          value={formatCurrency(globalMetrics.outstandingCents, currency)}
          icon={TrendingUp}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Flujo mensual (todas las tiendas)">
          <MonthlyFlowChart data={monthlyFlow} currency={currency} />
        </ChartCard>

        {businessRanking.length > 0 ? (
          <ChartCard title="Deuda pendiente por tienda">
            <BalanceRankingChart data={businessRanking} currency={currency} />
          </ChartCard>
        ) : null}
      </div>

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
                    className="flex items-center gap-3 p-3 text-sm"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                      <Store className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        <span className="truncate">{business.name}</span>
                        {isActive ? (
                          <span className="rounded-full bg-primary/12 px-2 py-0.5 text-xs text-primary">
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

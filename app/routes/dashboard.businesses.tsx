import { Plus } from "lucide-react";
import { Link } from "react-router";
import { authContext } from "~/context";
import {
  getBusinessById,
  listBusinessesWithMetrics,
} from "~/features/businesses/services/business.server";
import { formatCurrency } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.businesses";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Tiendas · Gestor de Tienda" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "businesses:manage");

  if (auth.isSuperadmin) {
    return {
      scope: "global" as const,
      businesses: await listBusinessesWithMetrics(),
    };
  }

  const business = auth.businessId
    ? await getBusinessById(auth.businessId)
    : null;

  return { scope: "business" as const, business };
}

export default function Businesses({ loaderData }: Route.ComponentProps) {
  if (loaderData.scope === "business") {
    return (
      <div className="space-y-5">
        <h1 className="text-xl font-bold">Mi tienda</h1>
        {loaderData.business ? (
          <Link
            to={`/dashboard/businesses/${loaderData.business.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/60"
          >
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold">
                {loaderData.business.name}
              </span>
              <span className="block text-sm text-muted-foreground">
                {loaderData.business.currency} ·{" "}
                {loaderData.business.isActive ? "activa" : "inactiva"}
              </span>
            </span>
            <span className="shrink-0 text-sm font-medium text-primary">
              Editar
            </span>
          </Link>
        ) : (
          <p className="text-base text-muted-foreground">
            No tienes una tienda asignada.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Tiendas</h1>

      <Link
        to="/dashboard/businesses/new"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Plus className="size-5" /> Nueva tienda
      </Link>

      {loaderData.businesses.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-base text-muted-foreground shadow-sm">
          Todavía no hay tiendas registradas.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {loaderData.businesses.map((business) => (
            <li key={business.id}>
              <Link
                to={`/dashboard/businesses/${business.id}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">
                    {business.name}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {business.currency} · pendiente{" "}
                    {formatCurrency(
                      business.outstandingCents,
                      business.currency,
                    )}
                  </span>
                </span>
                <span
                  className={
                    business.isActive
                      ? "shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      : "shrink-0 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
                  }
                >
                  {business.isActive ? "activa" : "inactiva"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

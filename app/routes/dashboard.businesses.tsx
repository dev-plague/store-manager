import { Plus, Store } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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
          <Card className="gap-0 p-0">
            <Link
              to={`/dashboard/businesses/${loaderData.business.id}`}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                <Store className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold">
                  {loaderData.business.name}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {loaderData.business.currency}
                </span>
              </span>
              <Badge
                variant={loaderData.business.isActive ? "default" : "destructive"}
              >
                {loaderData.business.isActive ? "activa" : "inactiva"}
              </Badge>
            </Link>
          </Card>
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

      <Button asChild className="h-12 w-full rounded-xl text-base">
        <Link to="/dashboard/businesses/new">
          <Plus className="size-5" /> Nueva tienda
        </Link>
      </Button>

      {loaderData.businesses.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-base text-muted-foreground">
            Todavía no hay tiendas registradas.
          </p>
        </Card>
      ) : (
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {loaderData.businesses.map((business) => (
              <li key={business.id}>
                <Link
                  to={`/dashboard/businesses/${business.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-muted/60"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <Store className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
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
                  <Badge
                    variant={business.isActive ? "default" : "destructive"}
                    className="shrink-0"
                  >
                    {business.isActive ? "activa" : "inactiva"}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

import { Plus, Search, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { authContext } from "~/context";
import { listCustomerBalances } from "~/features/metrics/services/metrics.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { formatCurrency } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.customers";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Clientes · Gestor de Tienda" }];
}

// Normaliza para comparar sin acentos ni mayúsculas.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "customers:read");

  const businessId = await requireBusinessId(request, auth);

  return {
    customers: await listCustomerBalances(businessId),
    canCreate: auth.isSuperadmin || auth.permissions.has("customers:create"),
  };
}

export default function Customers({ loaderData }: Route.ComponentProps) {
  const [query, setQuery] = useState("");

  const term = normalize(query.trim());
  const customers = term
    ? loaderData.customers.filter((customer) =>
        normalize(
          `${customer.firstName} ${customer.lastName} ${customer.lastName} ${customer.firstName}`,
        ).includes(term),
      )
    : loaderData.customers;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Clientes</h1>

      {loaderData.canCreate ? (
        <Button
          asChild
          className="h-12 w-full rounded-xl text-base"
        >
          <Link to="/dashboard/customers/new">
            <Plus className="size-5" /> Nuevo cliente
          </Link>
        </Button>
      ) : null}

      {/* Buscar por nombre (filtra la lista al escribir) */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre"
          aria-label="Buscar cliente por nombre"
          className="h-12 rounded-xl pr-12 pl-10 text-base"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setQuery("")}
            aria-label="Limpiar búsqueda"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {customers.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-base text-muted-foreground">
            {term
              ? `Sin resultados para «${query.trim()}».`
              : "Todavía no hay clientes. Toca «Nuevo cliente» para agregar el primero."}
          </p>
        </Card>
      ) : (
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {customers.map((customer) => (
              <li key={customer.id}>
                <Link
                  to={`/dashboard/customers/${customer.id}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-base font-semibold">
                      {customer.firstName} {customer.lastName}
                    </span>
                    {customer.phone ? (
                      <span className="block truncate text-sm text-muted-foreground">
                        {customer.phone}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      customer.outstandingCents > 0
                        ? "shrink-0 text-base font-semibold text-destructive"
                        : "shrink-0 text-base font-semibold text-muted-foreground"
                    }
                  >
                    {formatCurrency(customer.outstandingCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

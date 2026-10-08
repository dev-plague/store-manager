import { Plus } from "lucide-react";
import { Link } from "react-router";
import { authContext } from "~/context";
import { getBusinessById } from "~/features/businesses/services/business.server";
import { listBusinessUsers } from "~/features/users/services/user.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.users";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Usuarios · Gestor de Tienda" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "users:manage");

  const businessId = await requireBusinessId(request, auth);
  const [users, business] = await Promise.all([
    listBusinessUsers(businessId),
    getBusinessById(businessId),
  ]);

  return { users, businessName: business?.name ?? "" };
}

export default function Users({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">
        Usuarios
        {loaderData.businessName ? (
          <span className="block text-sm font-normal text-muted-foreground">
            {loaderData.businessName}
          </span>
        ) : null}
      </h1>

      <Link
        to="/dashboard/users/new"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Plus className="size-5" /> Nuevo usuario
      </Link>

      {loaderData.users.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-base text-muted-foreground shadow-sm">
          Todavía no hay usuarios en esta tienda.
        </p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
          {loaderData.users.map((user) => (
            <li key={user.id}>
              <Link
                to={`/dashboard/users/${user.id}`}
                className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base font-semibold">
                    {user.name}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {user.email}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {user.permissions.length} permisos
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

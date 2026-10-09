import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
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

      <Button asChild className="h-12 w-full rounded-xl text-base">
        <Link to="/dashboard/users/new">
          <Plus className="size-5" /> Nuevo usuario
        </Link>
      </Button>

      {loaderData.users.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-base text-muted-foreground">
            Todavía no hay usuarios en esta tienda.
          </p>
        </Card>
      ) : (
        <Card className="gap-0 p-0">
          <ul className="divide-y">
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
                  <Badge variant="secondary" className="shrink-0">
                    {user.permissions.length} permisos
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

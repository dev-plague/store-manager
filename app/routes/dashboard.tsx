import {
  ChartColumn,
  LayoutDashboard,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import { Form, NavLink, Outlet } from "react-router";
import { MobileNav, type MobileNavItem } from "~/components/mobile-nav";
import { FlashToast } from "~/components/flash-toast";
import { authContext } from "~/context";
import { getBusinessById } from "~/features/businesses/services/business.server";
import { getActiveBusinessId } from "~/lib/business-context.server";
import type { Permission } from "~/lib/permissions";
import { assertAuthenticated, getAuthContext } from "~/lib/session.server";
import type { Route } from "./+types/dashboard";

// Middleware: resuelve la sesión/permisos y los comparte con las rutas hijas
// mediante el contexto de React Router.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }) => {
    context.set(authContext, await getAuthContext(request));
  },
];

// El loader obliga a que el middleware corra en cada navegación del cliente.
export async function loader({ request, context }: Route.LoaderArgs) {
  const authContextValue = context.get(authContext);
  assertAuthenticated(authContextValue);

  const activeBusinessId = await getActiveBusinessId(
    request,
    authContextValue,
  );
  const activeBusiness = activeBusinessId
    ? await getBusinessById(activeBusinessId)
    : null;

  const can = (permission: Permission) =>
    authContextValue.isSuperadmin ||
    authContextValue.permissions.has(permission);

  return {
    user: authContextValue.user,
    isSuperadmin: authContextValue.isSuperadmin,
    activeBusinessName: activeBusiness?.name ?? null,
    canReadCustomers: can("customers:read"),
    canReadMetrics: can("metrics:read"),
    canManageUsers: can("users:manage"),
    canManageBusinesses: can("businesses:manage"),
  };
}

export default function DashboardLayout({
  loaderData,
}: Route.ComponentProps) {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  // Elementos de navegación (compartidos por las tabs de escritorio y la barra móvil).
  const navItems: MobileNavItem[] = [
    { to: "/dashboard", label: "Panel", icon: LayoutDashboard, end: true },
    ...(loaderData.canReadCustomers
      ? [{ to: "/dashboard/customers", label: "Clientes", icon: Users }]
      : []),
    ...(loaderData.canReadMetrics
      ? [{ to: "/dashboard/reports", label: "Informes", icon: ChartColumn }]
      : []),
    ...(loaderData.canManageUsers
      ? [{ to: "/dashboard/users", label: "Usuarios", icon: UserCog }]
      : []),
    ...(loaderData.canManageBusinesses
      ? [{ to: "/dashboard/businesses", label: "Tiendas", icon: Store }]
      : []),
  ];

  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background/80 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            ST
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {loaderData.user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {loaderData.isSuperadmin
                ? loaderData.activeBusinessName
                  ? `Tienda activa: ${loaderData.activeBusinessName}`
                  : "Todas las tiendas"
                : loaderData.user.email}
            </p>
          </div>
        </div>
        <Form method="post" action="/logout">
          <button
            type="submit"
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            Salir
          </button>
        </Form>
      </header>

      <nav className="hidden gap-1 overflow-x-auto border-b p-2 sm:flex">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={navLinkClass}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="p-4 pb-28 sm:pb-12">
        <Outlet />
      </main>

      <MobileNav items={navItems} />
      <FlashToast />
    </div>
  );
}

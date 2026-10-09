import {
  ChartColumn,
  LayoutDashboard,
  type LucideIcon,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { FlashToast } from "~/components/flash-toast";
import { MobileNav, type MobileNavItem } from "~/components/mobile-nav";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button, buttonVariants } from "~/components/ui/button";
import { authContext } from "~/context";
import { getBusinessById } from "~/features/businesses/services/business.server";
import { getActiveBusinessId } from "~/lib/business-context.server";
import type { Permission } from "~/lib/permissions";
import { assertAuthenticated, getAuthContext } from "~/lib/session.server";
import { cn } from "~/lib/utils";
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
    activeBusinessId,
    activeBusinessName: activeBusiness?.name ?? null,
    canReadCustomers: can("customers:read"),
    canReadMetrics: can("metrics:read"),
    canManageUsers: can("users:manage"),
    canManageBusinesses: can("businesses:manage"),
  };
}

// Barra fina en la parte superior que indica navegación en curso.
function NavigationProgress() {
  const navigation = useNavigation();
  const active = navigation.state !== "idle";

  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-x-0 top-0 z-30 h-0.5 origin-left bg-primary transition-opacity duration-300",
        active ? "animate-pulse opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "h-full bg-primary transition-[width] duration-500 ease-out",
          active ? "w-11/12" : "w-0",
        )}
      />
    </div>
  );
}

export default function DashboardLayout({
  loaderData,
}: Route.ComponentProps) {
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

  const secondaryLine = loaderData.isSuperadmin
    ? loaderData.activeBusinessName
      ? `Tienda activa: ${loaderData.activeBusinessName}`
      : "Todas las tiendas"
    : loaderData.user.email;

  return (
    <div className="mx-auto min-h-screen max-w-5xl">
      <NavigationProgress />

      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              ST
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {loaderData.user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {secondaryLine}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {loaderData.isSuperadmin ? (
              <Button
                asChild
                variant="outline"
                className="hidden rounded-xl sm:inline-flex"
              >
                <NavLink to="/select-business?redirectTo=/dashboard">
                  <Store className="size-4" />
                  {loaderData.activeBusinessName ? "Cambiar" : "Elegir tienda"}
                </NavLink>
              </Button>
            ) : null}
            <ThemeToggle />
            <Form method="post" action="/logout">
              <Button type="submit" variant="outline" className="rounded-xl">
                Salir
              </Button>
            </Form>
          </div>
        </div>

        {/* Tabs de escritorio con icono + etiqueta. */}
        <nav className="hidden gap-1 overflow-x-auto px-3 pb-2 sm:flex">
          {navItems.map((item) => (
            <DesktopNavLink key={item.to} item={item} />
          ))}
        </nav>
      </header>

      <main className="p-4 pb-28 sm:p-6 sm:pb-12">
        <Outlet />
      </main>

      <MobileNav items={navItems} />
      <FlashToast />
    </div>
  );
}

function DesktopNavLink({ item }: { item: MobileNavItem }) {
  const Icon: LucideIcon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          buttonVariants({ variant: isActive ? "default" : "ghost" }),
          "rounded-xl",
        )
      }
    >
      <Icon className="size-4" aria-hidden />
      {item.label}
    </NavLink>
  );
}

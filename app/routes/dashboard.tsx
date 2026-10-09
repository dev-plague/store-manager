import {
  ChartColumn,
  LayoutDashboard,
  type LucideIcon,
  LogOut,
  Store,
  UserCog,
  Users,
} from "lucide-react";
import { Form, NavLink, Outlet, useNavigation } from "react-router";
import { FlashToast } from "~/components/flash-toast";
import { MobileNav, type MobileNavItem } from "~/components/mobile-nav";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { UserAvatar } from "~/components/user-avatar";
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
    canCreateCustomers: can("customers:create"),
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
        "fixed inset-x-0 top-0 z-40 h-0.5 origin-left bg-primary transition-opacity duration-300",
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

  const contextLine = loaderData.isSuperadmin
    ? loaderData.activeBusinessName
      ? `Tienda activa: ${loaderData.activeBusinessName}`
      : "Todas las tiendas"
    : loaderData.user.email;

  return (
    <div className="min-h-screen">
      <NavigationProgress />

      {/* Barra lateral (escritorio). */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/70 bg-card/60 px-4 py-5 backdrop-blur-xl lg:flex">
        <BrandMark />

        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <SidebarNavLink key={item.to} item={item} />
          ))}
        </nav>

        {loaderData.isSuperadmin ? (
          <NavLink
            to="/select-business?redirectTo=/dashboard"
            className="mb-3 flex items-center gap-3 rounded-2xl border border-border/70 bg-background/60 p-3 transition-colors hover:bg-muted"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              <Store className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.7rem] font-medium text-muted-foreground">
                Tienda activa
              </span>
              <span className="block truncate text-sm font-semibold">
                {loaderData.activeBusinessName ?? "Todas las tiendas"}
              </span>
            </span>
          </NavLink>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border/70 pt-4">
          <UserAvatar name={loaderData.user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {loaderData.user.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {contextLine}
            </p>
          </div>
          <ThemeToggle className="size-9" />
          <Form method="post" action="/logout">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              aria-label="Salir"
              title="Salir"
              className="size-9 rounded-xl text-muted-foreground"
            >
              <LogOut className="size-4" />
            </Button>
          </Form>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Encabezado móvil. */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              ST
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {loaderData.user.name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {contextLine}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {loaderData.isSuperadmin ? (
              <Button
                asChild
                variant="outline"
                size="icon"
                className="size-10 rounded-xl"
              >
                <NavLink
                  to="/select-business?redirectTo=/dashboard"
                  aria-label="Cambiar tienda"
                  title="Cambiar tienda"
                >
                  <Store className="size-4" />
                </NavLink>
              </Button>
            ) : null}
            <ThemeToggle className="size-10" />
            <Form method="post" action="/logout">
              <Button
                type="submit"
                variant="outline"
                size="icon"
                aria-label="Salir"
                title="Salir"
                className="size-10 rounded-xl"
              >
                <LogOut className="size-4" />
              </Button>
            </Form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <MobileNav items={navItems} />
      <FlashToast />
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
        ST
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Gestor de Tienda</p>
        <p className="text-xs text-muted-foreground">Fiados y abonos</p>
      </div>
    </div>
  );
}

function SidebarNavLink({ item }: { item: MobileNavItem }) {
  const Icon: LucideIcon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  );
}

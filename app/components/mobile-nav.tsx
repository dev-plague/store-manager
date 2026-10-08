import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";

export type MobileNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

// Barra de navegación inferior flotante para móvil.
// En escritorio se oculta (`sm:hidden`) y se usan las tabs superiores.
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-3xl border bg-card/95 p-1.5 shadow-lg shadow-black/5 backdrop-blur">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="size-6"
                    strokeWidth={isActive ? 2.5 : 2}
                    aria-hidden
                  />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

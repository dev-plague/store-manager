import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router";
import { cn } from "~/lib/utils";

export type MobileNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

// Barra de navegación inferior flotante para móvil (estilo fintech).
// En escritorio se oculta (`lg:hidden`) y se usa la barra lateral.
export function MobileNav({ items }: { items: MobileNavItem[] }) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 rounded-[1.75rem] border border-border/70 bg-card/90 p-1.5 shadow-lg shadow-black/5 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "grid size-10 place-items-center rounded-2xl transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                  >
                    <Icon
                      className="size-5"
                      strokeWidth={isActive ? 2.5 : 2}
                      aria-hidden
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[0.7rem] leading-none font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

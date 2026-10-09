import { cn } from "~/lib/utils";

// Avatar circular con las iniciales del usuario (no dependemos de una imagen).
export function UserAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary",
        className,
      )}
    >
      {initials || "?"}
    </span>
  );
}

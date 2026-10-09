import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useNavigation } from "react-router";
import { Button } from "~/components/ui/button";

type SubmitButtonProps = ComponentProps<typeof Button> & {
  // Texto mostrado mientras se guarda (por defecto "Guardando…").
  pendingText?: string;
  // "any" deshabilita también durante cualquier navegación/carga (útil en
  // formularios GET), en lugar de solo mientras se ejecuta la acción.
  mode?: "submit" | "any";
};

// Botón de envío (shadcn) que se deshabilita y muestra un spinner mientras hay
// un envío en curso. Evita que el usuario pulse varias veces y genere registros
// duplicados.
export function SubmitButton({
  children,
  pendingText = "Guardando…",
  mode = "submit",
  disabled,
  ...props
}: SubmitButtonProps) {
  const navigation = useNavigation();
  const pending =
    navigation.state === "submitting" ||
    (mode === "any" && navigation.state === "loading");

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      {...props}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          <span>{pendingText}</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}

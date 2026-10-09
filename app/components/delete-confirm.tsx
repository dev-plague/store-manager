import type { ReactNode } from "react";
import { useState } from "react";
import { Form } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

type DeleteConfirmProps = {
  // Texto exacto que el usuario debe escribir para habilitar el borrado.
  confirmText: string;
  title: string;
  description: ReactNode;
  // Etiqueta del botón que abre el diálogo y del botón que confirma.
  triggerLabel: string;
  // Campos ocultos que se envían al servidor (intent, ids, …).
  fields: Record<string, string>;
  action?: string;
  pendingText?: string;
  className?: string;
};

// Diálogo de confirmación "fuerte" para operaciones destructivas: obliga a
// escribir el nombre exacto antes de habilitar el botón de eliminar.
export function DeleteConfirm({
  confirmText,
  title,
  description,
  triggerLabel,
  fields,
  action,
  pendingText = "Eliminando…",
  className,
}: DeleteConfirmProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const matches = value.trim() === confirmText;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setValue("");
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          className={className ?? "h-12 w-full rounded-xl text-base"}
        >
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Form method="post" action={action} className="space-y-4">
          {Object.entries(fields).map(([name, fieldValue]) => (
            <input
              key={name}
              type="hidden"
              name={name}
              value={fieldValue}
            />
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm-input" className="text-base">
              Escribe{" "}
              <span className="font-semibold text-foreground">
                {confirmText}
              </span>{" "}
              para confirmar
            </Label>
            <Input
              id="delete-confirm-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoComplete="off"
              autoFocus
              className="h-12 rounded-xl text-base"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <SubmitButton
              variant="destructive"
              disabled={!matches}
              pendingText={pendingText}
              className="rounded-xl"
            >
              {triggerLabel}
            </SubmitButton>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

import { ArrowLeft, CircleAlert } from "lucide-react";
import { Form, Link, redirect } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authContext } from "~/context";
import { createCustomer } from "~/features/customers/services/customer.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.customer-new";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Nuevo cliente · Gestor de Tienda" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "customers:create");
  await requireBusinessId(request, auth);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "customers:create");

  const businessId = await requireBusinessId(request, auth);
  const form = await request.formData();

  const firstName = String(form.get("firstName") ?? "").trim();
  const lastName = String(form.get("lastName") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!firstName || !lastName) {
    return { error: "Escribe el nombre y el apellido." };
  }

  await createCustomer({
    businessId,
    firstName,
    lastName,
    phone: phone || null,
    email: email || null,
    createdBy: auth.user.id,
  });

  return redirect("/dashboard/customers?flash=Cliente+guardado");
}

export default function CustomerNew({ actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/dashboard/customers"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">Nuevo cliente</h1>

      <Form method="post" className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="firstName" className="text-base">
            Nombre
          </Label>
          <Input
            id="firstName"
            name="firstName"
            required
            autoFocus
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="lastName" className="text-base">
            Apellido
          </Label>
          <Input
            id="lastName"
            name="lastName"
            required
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-base">
            Teléfono (opcional)
          </Label>
          <Input
            id="phone"
            name="phone"
            inputMode="tel"
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-base">
            Correo (opcional)
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            className="h-12 rounded-xl text-base"
          />
        </div>

        {actionData?.error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Algo salió mal</AlertTitle>
            <AlertDescription>{actionData.error}</AlertDescription>
          </Alert>
        ) : null}

        <SubmitButton
          pendingText="Guardando…"
          className="h-12 w-full rounded-xl text-base"
        >
          Guardar cliente
        </SubmitButton>
      </Form>
    </div>
  );
}

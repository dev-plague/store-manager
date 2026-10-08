import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect } from "react-router";
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
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">Nuevo cliente</h1>

      <Form method="post" className="space-y-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Nombre</span>
          <input
            name="firstName"
            required
            autoFocus
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Apellido</span>
          <input
            name="lastName"
            required
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Teléfono (opcional)</span>
          <input
            name="phone"
            inputMode="tel"
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Correo (opcional)</span>
          <input
            name="email"
            type="email"
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {actionData?.error ? (
          <p className="text-base text-destructive">{actionData.error}</p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Guardar cliente
        </button>
      </Form>
    </div>
  );
}

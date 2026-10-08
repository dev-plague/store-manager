import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect } from "react-router";
import { authContext } from "~/context";
import { createBusiness } from "~/features/businesses/services/business.server";
import {
  assertAuthenticated,
  assertPermission,
  assertSuperadmin,
} from "~/lib/session.server";
import type { Route } from "./+types/dashboard.business-new";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Nueva tienda · Gestor de Tienda" }];
}

async function messageFromError(error: unknown): Promise<string> {
  if (error instanceof Response) {
    const text = await error.text();
    return text || "No se pudo crear la tienda.";
  }
  if (error instanceof Error) return error.message;
  return "No se pudo crear la tienda.";
}

export async function loader({ context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "businesses:manage");
  assertSuperadmin(auth);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "businesses:manage");
  assertSuperadmin(auth);

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const slug = String(form.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const currency = String(form.get("currency") ?? "COP")
    .trim()
    .toUpperCase();
  const timezone = String(form.get("timezone") ?? "America/Bogota").trim();

  if (!name) return { error: "Escribe el nombre de la tienda." };
  if (!SLUG_PATTERN.test(slug)) {
    return {
      error: "El identificador solo admite minúsculas, números y guiones.",
    };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "La moneda debe tener 3 letras (ej: COP)." };
  }
  if (!timezone) return { error: "Escribe la zona horaria." };

  try {
    await createBusiness({ name, slug, currency, timezone });
    return redirect("/dashboard/businesses?flash=Tienda+creada");
  } catch (error) {
    return { error: await messageFromError(error) };
  }
}

export default function BusinessNew({ actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/dashboard/businesses"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">Nueva tienda</h1>

      <Form method="post" className="space-y-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Nombre de la tienda</span>
          <input
            name="name"
            required
            autoFocus
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">
            Identificador (sin espacios)
          </span>
          <input
            name="slug"
            required
            placeholder="mi-tienda"
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Moneda</span>
          <input
            name="currency"
            defaultValue="COP"
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Zona horaria</span>
          <input
            name="timezone"
            defaultValue="America/Bogota"
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
          Guardar tienda
        </button>
      </Form>
    </div>
  );
}

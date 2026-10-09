import { ArrowLeft, CircleAlert } from "lucide-react";
import { Form, Link, redirect } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">Nueva tienda</h1>

      <Form method="post" className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-base">
            Nombre de la tienda
          </Label>
          <Input
            id="name"
            name="name"
            required
            autoFocus
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug" className="text-base">
            Identificador (sin espacios)
          </Label>
          <Input
            id="slug"
            name="slug"
            required
            placeholder="mi-tienda"
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-base">
            Moneda
          </Label>
          <Input
            id="currency"
            name="currency"
            defaultValue="COP"
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="timezone" className="text-base">
            Zona horaria
          </Label>
          <Input
            id="timezone"
            name="timezone"
            defaultValue="America/Bogota"
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
          Guardar tienda
        </SubmitButton>
      </Form>
    </div>
  );
}

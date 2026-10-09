import { ArrowLeft, CircleAlert } from "lucide-react";
import { Form, Link, redirect } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authContext } from "~/context";
import { createBusinessUser } from "~/features/users/services/user.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.user-new";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Nuevo usuario · Gestor de Tienda" }];
}

async function messageFromError(error: unknown): Promise<string> {
  if (error instanceof Response) {
    const text = await error.text();
    return text || "No se pudo crear el usuario.";
  }
  if (error instanceof Error) return error.message;
  return "No se pudo crear el usuario.";
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "users:manage");
  await requireBusinessId(request, auth);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "users:manage");

  const businessId = await requireBusinessId(request, auth);
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email.includes("@")) {
    return { error: "Escribe un correo válido." };
  }

  try {
    await createBusinessUser({ businessId, name, email, password });
    return redirect("/dashboard/users?flash=Usuario+creado");
  } catch (error) {
    return { error: await messageFromError(error) };
  }
}

export default function UserNew({ actionData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/dashboard/users"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">Nuevo usuario</h1>

      <Form method="post" className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-base">
            Nombre
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
          <Label htmlFor="email" className="text-base">
            Correo electrónico
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            className="h-12 rounded-xl text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-base">
            Contraseña
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="h-12 rounded-xl text-base"
          />
          <span className="text-sm text-muted-foreground">
            Mínimo 8 caracteres.
          </span>
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
          Guardar usuario
        </SubmitButton>
      </Form>
    </div>
  );
}

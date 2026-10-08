import { ArrowLeft } from "lucide-react";
import { Form, Link, redirect } from "react-router";
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
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">Nuevo usuario</h1>

      <Form method="post" className="space-y-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Nombre</span>
          <input
            name="name"
            required
            autoFocus
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Correo electrónico</span>
          <input
            name="email"
            type="email"
            required
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Contraseña</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">
            Mínimo 8 caracteres.
          </span>
        </label>

        {actionData?.error ? (
          <p className="text-base text-destructive">{actionData.error}</p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Guardar usuario
        </button>
      </Form>
    </div>
  );
}

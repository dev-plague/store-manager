import { Form, redirect } from "react-router";
import { auth } from "~/lib/auth.server";
import { getAuthContext } from "~/lib/session.server";
import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Iniciar sesión · Gestor de Tienda" }];
}

// Si ya hay sesión, no tiene sentido mostrar el formulario.
export async function loader({ request }: Route.LoaderArgs) {
  const authContext = await getAuthContext(request);
  if (authContext) throw redirect("/dashboard");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  // Better Auth gestiona la cookie de sesión; la reenviamos en el redirect.
  const response = await auth.api.signInEmail({
    body: { email, password },
    headers: request.headers,
    asResponse: true,
  });

  if (!response.ok) {
    return { error: "Credenciales inválidas." };
  }

  const setCookie = response.headers.get("set-cookie");
  return redirect(
    "/dashboard",
    setCookie ? { headers: { "Set-Cookie": setCookie } } : undefined,
  );
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            ST
          </span>
          <h1 className="pt-2 text-2xl font-bold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Accede para gestionar tus clientes y sus saldos.
          </p>
        </header>

        <Form method="post" className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Correo electrónico</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {actionData?.error ? (
            <p className="text-sm text-destructive">{actionData.error}</p>
          ) : null}

          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entrar
          </button>
        </Form>
      </div>
    </main>
  );
}

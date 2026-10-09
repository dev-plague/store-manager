import { CircleAlert } from "lucide-react";
import { Form, redirect } from "react-router";
import { SubmitButton } from "~/components/submit-button";
import { ThemeToggle } from "~/components/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
    <main className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="gap-6 p-6 sm:p-8">
        <header className="space-y-1">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
            ST
          </span>
          <h1 className="pt-3 text-2xl font-bold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Accede para gestionar tus clientes y sus saldos.
          </p>
        </header>

        <Form method="post" className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-base">
              Correo electrónico
            </Label>
            <Input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
              autoFocus
              className="h-12 rounded-xl text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-base">
              Contraseña
            </Label>
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
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
            pendingText="Entrando…"
            className="h-12 rounded-xl text-base"
          >
            Entrar
          </SubmitButton>
        </Form>
      </Card>
    </main>
  );
}

import { ArrowLeft, Check, Store } from "lucide-react";
import { Form, Link, redirect } from "react-router";
import { z } from "zod";
import { SubmitButton } from "~/components/submit-button";
import { ThemeToggle } from "~/components/theme-toggle";
import { Badge } from "~/components/ui/badge";
import { Card } from "~/components/ui/card";
import {
  getBusinessById,
  listBusinessesWithMetrics,
} from "~/features/businesses/services/business.server";
import {
  clearActiveBusinessCookie,
  getActiveBusinessId,
  setActiveBusinessCookie,
} from "~/lib/business-context.server";
import { formatCurrency } from "~/lib/money";
import { assertAuthenticated, getAuthContext } from "~/lib/session.server";
import { safeRedirect } from "~/lib/utils";
import type { Route } from "./+types/select-business";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Elegir tienda · Gestor de Tienda" }];
}

const businessIdSchema = z.uuid();

// Selector de "tienda activa" para el Administrador Global.
//
// Antes esta ruta solo redirigía al panel; ahora es una pantalla real a la que
// `requireBusinessId` envía al Superadmin cuando intenta entrar a un módulo que
// necesita una tienda. Así se evita el rebote confuso al dashboard.
export async function loader({ request }: Route.LoaderArgs) {
  const auth = await getAuthContext(request);
  assertAuthenticated(auth);

  if (!auth.isSuperadmin) {
    throw redirect("/dashboard");
  }

  const url = new URL(request.url);
  const redirectTo = safeRedirect(url.searchParams.get("redirectTo"));
  const [businesses, activeBusinessId] = await Promise.all([
    listBusinessesWithMetrics(),
    getActiveBusinessId(request, auth),
  ]);

  return { businesses, activeBusinessId, redirectTo };
}

export async function action({ request }: Route.ActionArgs) {
  const auth = await getAuthContext(request);
  assertAuthenticated(auth);

  if (!auth.isSuperadmin) {
    throw new Response("No autorizado.", { status: 403 });
  }

  const form = await request.formData();
  const rawBusinessId = String(form.get("businessId") ?? "").trim();
  const redirectTo = safeRedirect(form.get("redirectTo"));

  // Sin tienda: se limpia la cookie y se vuelve al panel global.
  if (!rawBusinessId) {
    return redirect("/dashboard", {
      headers: { "Set-Cookie": await clearActiveBusinessCookie() },
    });
  }

  const parsed = businessIdSchema.safeParse(rawBusinessId);
  if (!parsed.success) {
    throw new Response("Tienda inválida.", { status: 400 });
  }

  const business = await getBusinessById(parsed.data);
  if (!business) {
    throw new Response("Tienda no encontrada.", { status: 404 });
  }

  return redirect(redirectTo, {
    headers: { "Set-Cookie": await setActiveBusinessCookie(business.id) },
  });
}

export default function SelectBusiness({
  loaderData,
}: Route.ComponentProps) {
  const { businesses, activeBusinessId, redirectTo } = loaderData;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-4 sm:justify-center sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Volver al panel
        </Link>
        <ThemeToggle />
      </div>

      <header className="space-y-1.5">
        <Badge className="gap-1.5">
          <Store className="size-3.5" /> Administrador Global
        </Badge>
        <h1 className="text-2xl font-bold tracking-tight">Elige una tienda</h1>
        <p className="text-sm text-muted-foreground">
          {activeBusinessId
            ? "Cambia la tienda activa para gestionar sus clientes, usuarios e informes."
            : "Selecciona la tienda que quieres gestionar para continuar."}
        </p>
      </header>

      {businesses.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-base text-muted-foreground">
            No hay tiendas registradas todavía.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {businesses.map((business) => {
            const isActive = business.id === activeBusinessId;
            return (
              <li key={business.id}>
                <Card className="gap-0 p-0">
                  <Form
                    method="post"
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <input
                      type="hidden"
                      name="businessId"
                      value={business.id}
                    />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={redirectTo}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="block truncate text-base font-semibold">
                          {business.name}
                        </span>
                        {isActive ? (
                          <Badge className="gap-1">
                            <Check className="size-3" /> activa
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {business.customerCount} clientes · pendiente{" "}
                        {formatCurrency(
                          business.outstandingCents,
                          business.currency,
                        )}
                      </p>
                    </div>
                    <SubmitButton
                      variant={isActive ? "default" : "outline"}
                      pendingText="Entrando…"
                      className="shrink-0 rounded-xl"
                    >
                      {isActive ? "Entrar" : "Gestionar"}
                    </SubmitButton>
                  </Form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {activeBusinessId ? (
        <Form method="post">
          <input type="hidden" name="businessId" value="" />
          <SubmitButton
            variant="outline"
            pendingText="Quitando…"
            className="h-12 w-full rounded-xl text-base text-muted-foreground"
          >
            Quitar tienda activa
          </SubmitButton>
        </Form>
      ) : null}
    </main>
  );
}

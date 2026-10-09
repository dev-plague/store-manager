import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Form, Link, redirect } from "react-router";
import { sileo } from "sileo";
import { DeleteConfirm } from "~/components/delete-confirm";
import { SubmitButton } from "~/components/submit-button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { authContext } from "~/context";
import {
  deleteBusiness,
  getBusinessById,
  getBusinessDeletionImpact,
  updateBusiness,
  type UpdateBusinessInput,
} from "~/features/businesses/services/business.server";
import {
  assertAuthenticated,
  assertPermission,
  assertSuperadmin,
} from "~/lib/session.server";
import type { Route } from "./+types/dashboard.business";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Editar tienda · Gestor de Tienda" }];
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function messageFromError(error: unknown): Promise<string> {
  if (error instanceof Response) {
    const text = await error.text();
    return text || "No se pudo completar la operación.";
  }
  if (error instanceof Error) return error.message;
  return "No se pudo completar la operación.";
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "businesses:manage");

  if (!auth.isSuperadmin && auth.businessId !== params.businessId) {
    throw new Response("No autorizado.", { status: 403 });
  }

  const business = await getBusinessById(params.businessId);
  if (!business) {
    throw new Response("Tienda no encontrada.", { status: 404 });
  }

  const impact = auth.isSuperadmin
    ? await getBusinessDeletionImpact(params.businessId)
    : null;

  return { business, canEditGlobalFields: auth.isSuperadmin, impact };
}

export async function action({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "businesses:manage");

  if (!auth.isSuperadmin && auth.businessId !== params.businessId) {
    throw new Response("No autorizado.", { status: 403 });
  }

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "update");

  // Eliminar (solo Administrador Global).
  if (intent === "delete") {
    assertSuperadmin(auth);
    try {
      await deleteBusiness(params.businessId);
    } catch (error) {
      return { ok: false, error: await messageFromError(error) };
    }
    throw redirect("/dashboard/businesses?flash=Tienda+eliminada");
  }

  // Actualizar.
  const name = String(form.get("name") ?? "").trim();
  const currency = String(form.get("currency") ?? "COP")
    .trim()
    .toUpperCase();
  const timezone = String(form.get("timezone") ?? "").trim();

  if (!name) return { ok: false, error: "El nombre es obligatorio." };
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: "La moneda debe ser ISO 4217 (3 letras)." };
  }
  if (!timezone) {
    return { ok: false, error: "La zona horaria es obligatoria." };
  }

  const changes: UpdateBusinessInput = { name, currency, timezone };

  if (auth.isSuperadmin) {
    const slug = String(form.get("slug") ?? "")
      .trim()
      .toLowerCase();
    if (!SLUG_PATTERN.test(slug)) {
      return {
        ok: false,
        error: "El identificador solo admite minúsculas, números y guiones.",
      };
    }
    changes.slug = slug;
    changes.isActive = String(form.get("isActive")) === "true";
  }

  try {
    await updateBusiness(params.businessId, changes);
    return { ok: true, message: "Tienda actualizada." };
  } catch (error) {
    return { ok: false, error: await messageFromError(error) };
  }
}

export default function BusinessDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { business, canEditGlobalFields, impact } = loaderData;

  useEffect(() => {
    if (!actionData) return;
    if (actionData.ok) {
      sileo.success({ title: actionData.message });
    } else {
      sileo.error({
        title: "Algo salió mal",
        description: actionData.error,
      });
    }
  }, [actionData]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/dashboard/businesses"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">{business.name}</h1>

      <Card className="gap-4 p-5">
        <Form method="post" className="space-y-5">
          <input type="hidden" name="intent" value="update" />

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-base">
              Nombre
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={business.name}
              required
              className="h-12 rounded-xl text-base"
            />
          </div>

          {canEditGlobalFields ? (
            <div className="space-y-1.5">
              <Label htmlFor="slug" className="text-base">
                Identificador (slug)
              </Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={business.slug}
                className="h-12 rounded-xl text-base"
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="currency" className="text-base">
              Moneda (ISO 4217)
            </Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={business.currency}
              className="h-12 rounded-xl text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-base">
              Zona horaria (IANA)
            </Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue={business.timezone}
              className="h-12 rounded-xl text-base"
            />
          </div>

          {canEditGlobalFields ? (
            <Label className="items-center gap-3 text-base">
              <Checkbox
                name="isActive"
                value="true"
                defaultChecked={business.isActive}
              />
              <span>Tienda activa</span>
            </Label>
          ) : null}

          <SubmitButton
            pendingText="Guardando…"
            className="h-12 w-full rounded-xl text-base"
          >
            Guardar cambios
          </SubmitButton>
        </Form>

        {canEditGlobalFields ? (
          <>
            <Separator />
            <DeleteConfirm
              triggerLabel="Eliminar tienda"
              title={`Eliminar «${business.name}»`}
              confirmText={business.name}
              fields={{ intent: "delete" }}
              description={
                <>
                  Se eliminarán en cascada{" "}
                  <strong>{impact?.customers ?? 0} clientes</strong>,{" "}
                  <strong>{impact?.entries ?? 0} movimientos</strong> y{" "}
                  <strong>{impact?.users ?? 0} usuarios</strong>. Esta acción no
                  se puede deshacer.
                </>
              }
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}

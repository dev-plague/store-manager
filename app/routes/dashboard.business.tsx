import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Form, Link, redirect } from "react-router";
import { sileo } from "sileo";
import { authContext } from "~/context";
import {
  deleteBusiness,
  getBusinessById,
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

  return { business, canEditGlobalFields: auth.isSuperadmin };
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
  const { business, canEditGlobalFields } = loaderData;

  useEffect(() => {
    if (!actionData) return;
    if (actionData.ok) {
      sileo.success({ title: actionData.message });
    } else {
      sileo.error({ title: actionData.error });
    }
  }, [actionData]);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Link
        to="/dashboard/businesses"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Volver
      </Link>

      <h1 className="text-xl font-bold">{business.name}</h1>

      <Form method="post" className="space-y-5">
        <input type="hidden" name="intent" value="update" />

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Nombre</span>
          <input
            name="name"
            defaultValue={business.name}
            required
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {canEditGlobalFields ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">Identificador (slug)</span>
            <input
              name="slug"
              defaultValue={business.slug}
              className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ) : null}

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Moneda (ISO 4217)</span>
          <input
            name="currency"
            defaultValue={business.currency}
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium">Zona horaria (IANA)</span>
          <input
            name="timezone"
            defaultValue={business.timezone}
            className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        {canEditGlobalFields ? (
          <label className="flex items-center gap-3 text-base">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={business.isActive}
              className="size-5"
            />
            <span>Tienda activa</span>
          </label>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Guardar cambios
        </button>
      </Form>

      {canEditGlobalFields ? (
        <Form
          method="post"
          onSubmit={(event) => {
            if (
              !window.confirm(
                `¿Eliminar la tienda "${business.name}"? Esta acción no se puede deshacer.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <button
            type="submit"
            className="w-full rounded-xl border border-destructive/40 px-4 py-3 text-base font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            Eliminar tienda
          </button>
        </Form>
      ) : null}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { Form, Link } from "react-router";
import { sileo } from "sileo";
import { SubmitButton } from "~/components/submit-button";
import { Card } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { authContext } from "~/context";
import {
  getBusinessUser,
  setBusinessUserPassword,
  setUserPermissions,
  updateBusinessUserName,
} from "~/features/users/services/user.server";
import { requireBusinessId } from "~/lib/business-context.server";
import {
  grantablePermissions,
  isPermission,
  PERMISSION_LABELS,
  PERMISSIONS,
  RESOURCE_LABELS,
  type Permission,
} from "~/lib/permissions";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import type { Route } from "./+types/dashboard.user";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Permisos del usuario · Gestor de Tienda" }];
}

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "users:manage");

  const businessId = await requireBusinessId(request, auth);
  const user = await getBusinessUser(businessId, params.userId);

  if (!user) {
    throw new Response("Usuario no encontrado.", { status: 404 });
  }

  // Solo se pueden otorgar permisos dentro del alcance del actor.
  const grantable = new Set(grantablePermissions(auth.isSuperadmin));

  const groups = (
    Object.entries(PERMISSIONS) as [
      keyof typeof RESOURCE_LABELS,
      readonly Permission[],
    ][]
  )
    .map(([resource, permissions]) => ({
      resource,
      label: RESOURCE_LABELS[resource],
      permissions: permissions
        .filter((permission) => grantable.has(permission))
        .map((permission) => ({
          key: permission,
          label: PERMISSION_LABELS[permission],
          granted: user.permissions.includes(permission),
        })),
    }))
    .filter((group) => group.permissions.length > 0);

  return { user, groups };
}

export async function action({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "users:manage");

  const businessId = await requireBusinessId(request, auth);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  try {
    if (intent === "update-name") {
      const name = String(form.get("name") ?? "");
      await updateBusinessUserName(businessId, params.userId, name);
      return { ok: true, message: "Nombre actualizado." };
    }

    if (intent === "save-permissions") {
      const grantable = new Set(grantablePermissions(auth.isSuperadmin));

      const selected = form
        .getAll("permissions")
        .map((value) => String(value))
        .filter(isPermission)
        .filter((permission) => grantable.has(permission));

      await setUserPermissions({
        businessId,
        userId: params.userId,
        permissions: selected,
        grantedBy: auth.user.id,
      });

      return { ok: true, message: "Permisos actualizados." };
    }

    if (intent === "set-password") {
      const newPassword = String(form.get("newPassword") ?? "");
      const confirmPassword = String(form.get("confirmPassword") ?? "");

      if (newPassword !== confirmPassword) {
        return { ok: false, error: "Las contraseñas no coinciden." };
      }

      await setBusinessUserPassword({
        businessId,
        userId: params.userId,
        newPassword,
        // Si el admin se cambia su propia contraseña, conserva la sesión.
        revokeSessions: params.userId !== auth.user.id,
      });

      return { ok: true, message: "Contraseña actualizada." };
    }

    return { ok: false, error: "Acción no reconocida." };
  } catch (error) {
    if (error instanceof Response) {
      return {
        ok: false,
        error: (await error.text()) || "No se pudo completar la operación.",
      };
    }
    if (error instanceof Error) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "No se pudo completar la operación." };
  }
}

export default function UserDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, groups } = loaderData;
  const passwordFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!actionData) return;
    if (actionData.ok) {
      sileo.success({ title: actionData.message });
      // Limpia los campos de contraseña tras restablecerla.
      passwordFormRef.current?.reset();
    } else {
      sileo.error({
        title: "Algo salió mal",
        description: actionData.error,
      });
    }
  }, [actionData]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/dashboard/users"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Usuarios
        </Link>
        <h1 className="text-lg font-semibold">{user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Card className="gap-4 p-5">
        <h2 className="text-sm font-semibold">Nombre</h2>
        <Form method="post" className="flex flex-col gap-3 sm:flex-row">
          <input type="hidden" name="intent" value="update-name" />
          <Input
            name="name"
            defaultValue={user.name}
            required
            aria-label="Nombre del usuario"
            className="h-12 flex-1 rounded-xl text-base"
          />
          <SubmitButton
            variant="outline"
            pendingText="Guardando…"
            className="h-12 rounded-xl px-5 text-base"
          >
            Guardar
          </SubmitButton>
        </Form>
      </Card>

      <Card className="gap-4 p-5">
        <h2 className="text-sm font-semibold">Permisos</h2>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="save-permissions" />

          {groups.map((group) => (
            <fieldset
              key={group.resource}
              className="rounded-xl border p-4"
            >
              <legend className="px-1 text-xs font-semibold text-muted-foreground">
                {group.label}
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.permissions.map((permission) => (
                  <Label
                    key={permission.key}
                    className="items-center gap-2.5 text-base font-normal"
                  >
                    <Checkbox
                      name="permissions"
                      value={permission.key}
                      defaultChecked={permission.granted}
                    />
                    <span>{permission.label}</span>
                  </Label>
                ))}
              </div>
            </fieldset>
          ))}

          <SubmitButton
            pendingText="Guardando…"
            className="h-12 rounded-xl px-5 text-base"
          >
            Guardar permisos
          </SubmitButton>
        </Form>
      </Card>

      <Card className="gap-4 p-5">
        <h2 className="text-sm font-semibold">Restablecer contraseña</h2>
        <Form
          method="post"
          ref={passwordFormRef}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <input type="hidden" name="intent" value="set-password" />
          <Input
            name="newPassword"
            type="password"
            placeholder="Nueva contraseña (mínimo 8)"
            required
            minLength={8}
            aria-label="Nueva contraseña"
            className="h-12 rounded-xl text-base"
          />
          <Input
            name="confirmPassword"
            type="password"
            placeholder="Confirmar contraseña"
            required
            minLength={8}
            aria-label="Confirmar contraseña"
            className="h-12 rounded-xl text-base"
          />
          <SubmitButton
            variant="outline"
            pendingText="Actualizando…"
            className="h-12 rounded-xl text-base sm:col-span-2"
          >
            Actualizar contraseña
          </SubmitButton>
        </Form>
        <p className="text-xs text-muted-foreground">
          Al restablecerla se cierran las sesiones activas del usuario para que
          vuelva a iniciar sesión.
        </p>
      </Card>
    </div>
  );
}

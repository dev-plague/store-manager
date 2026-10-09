import { useEffect, useState } from "react";
import { Form, Link } from "react-router";
import { sileo } from "sileo";
import { MoneyInput } from "~/components/money-input";
import { SubmitButton } from "~/components/submit-button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { authContext } from "~/context";
import { getBusinessById } from "~/features/businesses/services/business.server";
import { getCustomerById } from "~/features/customers/services/customer.server";
import {
  correctLedgerEntry,
  createDebt,
  createPayment,
  getCustomerBalance,
  listCustomerLedger,
  voidLedgerEntry,
} from "~/features/ledger/services/ledger.server";
import { requireBusinessId } from "~/lib/business-context.server";
import { formatCurrency, fromCents, toCents } from "~/lib/money";
import { assertAuthenticated, assertPermission } from "~/lib/session.server";
import { DEFAULT_TIMEZONE } from "~/lib/time";
import { formatDate } from "~/lib/utils";
import type { Route } from "./+types/dashboard.customer";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Detalle del cliente · Gestor de Tienda" }];
}

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "customers:read");

  const businessId = await requireBusinessId(request, auth);
  const customer = await getCustomerById(businessId, params.customerId);

  if (!customer) {
    throw new Response("Cliente no encontrado.", { status: 404 });
  }

  const [entries, balance, business] = await Promise.all([
    listCustomerLedger(businessId, customer.id),
    getCustomerBalance(businessId, customer.id),
    getBusinessById(businessId),
  ]);

  const canAdjust =
    auth.isSuperadmin || auth.permissions.has("ledger:adjust");

  const timeZone = business?.timezone ?? DEFAULT_TIMEZONE;

  return { customer, entries, balance, canAdjust, timeZone };
}

export async function action({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<ActionResult> {
  const auth = context.get(authContext);
  assertAuthenticated(auth);

  const businessId = await requireBusinessId(request, auth);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "create");

  try {
    if (intent === "create") {
      const type = String(form.get("type") ?? "");
      const description = String(form.get("description") ?? "").trim();

      if (type !== "DEBT" && type !== "PAYMENT") {
        return { ok: false, error: "Tipo de movimiento inválido." };
      }

      assertPermission(
        auth,
        type === "DEBT" ? "debts:create" : "payments:create",
      );

      const amountCents = parseAmount(String(form.get("amount") ?? ""));
      if (amountCents === null) {
        return { ok: false, error: "El monto no es válido." };
      }

      const input = {
        businessId,
        customerId: params.customerId,
        amountCents,
        description: description || null,
        createdBy: auth.user.id,
      };

      if (type === "DEBT") {
        await createDebt(input);
      } else {
        await createPayment(input);
      }

      return { ok: true, message: "Movimiento registrado." };
    }

    // Anular y corregir requieren el permiso de ajustes del ledger.
    if (intent === "void") {
      assertPermission(auth, "ledger:adjust");
      const entryId = String(form.get("entryId") ?? "");
      await voidLedgerEntry({ businessId, entryId, voidedBy: auth.user.id });
      return { ok: true, message: "Movimiento anulado." };
    }

    if (intent === "correct") {
      assertPermission(auth, "ledger:adjust");
      const entryId = String(form.get("entryId") ?? "");
      const type = String(form.get("type") ?? "");
      const description = String(form.get("description") ?? "").trim();

      if (type !== "DEBT" && type !== "PAYMENT") {
        return { ok: false, error: "Tipo de movimiento inválido." };
      }

      const amountCents = parseAmount(String(form.get("amount") ?? ""));
      if (amountCents === null) {
        return { ok: false, error: "El monto no es válido." };
      }

      await correctLedgerEntry({
        businessId,
        entryId,
        amountCents,
        type,
        description: description || null,
        correctedBy: auth.user.id,
      });

      return { ok: true, message: "Movimiento corregido." };
    }

    return { ok: false, error: "Acción no reconocida." };
  } catch (error) {
    return { ok: false, error: await messageFromError(error) };
  }
}

function parseAmount(raw: string): number | null {
  try {
    const cents = toCents(raw);
    return cents > 0 ? cents : null;
  } catch {
    return null;
  }
}

async function messageFromError(error: unknown): Promise<string> {
  if (error instanceof Response) {
    const text = await error.text();
    return text || "No se pudo completar la operación.";
  }
  if (error instanceof Error) return error.message;
  return "No se pudo completar la operación.";
}

export default function CustomerDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { customer, entries, balance, canAdjust, timeZone } = loaderData;

  // Se incrementa tras registrar un movimiento para remontar el formulario y
  // dejar la UI limpia (el usuario no puede volver a enviar los mismos datos).
  const [createFormKey, setCreateFormKey] = useState(0);

  useEffect(() => {
    if (!actionData) return;
    if (actionData.ok) {
      sileo.success({ title: actionData.message });
      if (actionData.message === "Movimiento registrado.") {
        setCreateFormKey((key) => key + 1);
      }
    } else {
      sileo.error({
        title: "Algo salió mal",
        description: actionData.error,
      });
    }
  }, [actionData]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/dashboard/customers"
            className="text-xs text-muted-foreground"
          >
            ← Clientes
          </Link>
          <h1 className="text-xl font-bold">
            {customer.firstName} {customer.lastName}
          </h1>
          {customer.phone ? (
            <p className="text-sm text-muted-foreground">{customer.phone}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-muted-foreground">
            Deuda pendiente
          </p>
          <p
            className={
              balance.outstandingCents > 0
                ? "text-2xl font-bold text-destructive"
                : "text-2xl font-bold"
            }
          >
            {formatCurrency(balance.outstandingCents)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="space-y-3 lg:sticky lg:top-32 lg:self-start">
          <h2 className="text-base font-semibold">Registrar movimiento</h2>
          <Card className="gap-3 p-4">
            <Form key={createFormKey} method="post" className="space-y-3">
              <input type="hidden" name="intent" value="create" />
              <div className="space-y-1.5">
                <Label
                  htmlFor="movement-type"
                  className="text-base"
                >
                  ¿Qué deseas registrar?
                </Label>
                <Select name="type" defaultValue="DEBT">
                  <SelectTrigger
                    id="movement-type"
                    className="h-12 w-full rounded-xl text-base"
                  >
                    <SelectValue placeholder="Tipo de movimiento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBT">Deuda (fiado)</SelectItem>
                    <SelectItem value="PAYMENT">Abono (pago)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-base">Monto</Label>
                <MoneyInput
                  name="amount"
                  placeholder="0"
                  required
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="movement-description" className="text-base">
                  Descripción (opcional)
                </Label>
                <Input
                  id="movement-description"
                  name="description"
                  className="h-12 rounded-xl text-base"
                />
              </div>
              <SubmitButton
                pendingText="Guardando…"
                className="h-12 w-full rounded-xl text-base"
              >
                Guardar movimiento
              </SubmitButton>
            </Form>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Historial</h2>
          {entries.length === 0 ? (
            <Card className="p-6">
              <p className="text-center text-sm text-muted-foreground">
                Sin movimientos registrados.
              </p>
            </Card>
          ) : (
            <Card className="gap-0 p-0">
              <ul className="divide-y">
                {entries.map((entry) => {
                  const isVoided = Boolean(entry.voidedAt);
                  const isReversal = Boolean(entry.reversalOfId);
                  const canAdjustEntry = canAdjust && !isVoided && !isReversal;

                  return (
                    <li key={entry.id} className="space-y-2 p-4 text-base">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className={
                              isVoided
                                ? "font-medium text-muted-foreground line-through"
                                : "font-medium"
                            }
                          >
                            {entry.type === "DEBT" ? "Deuda" : "Abono"}
                            {isReversal ? " (anulación)" : ""}
                          </p>
                          {entry.description ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {entry.description}
                            </p>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {formatDate(entry.createdAt, timeZone)}
                            {isVoided ? " · anulado" : ""}
                          </p>
                        </div>
                        <span
                          className={
                            isVoided
                              ? "text-muted-foreground line-through"
                              : entry.type === "DEBT"
                                ? "text-destructive"
                                : "text-emerald-600"
                          }
                        >
                          {entry.type === "DEBT" ? "+" : "−"}
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>

                      {canAdjustEntry ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Form
                            method="post"
                            onSubmit={(event) => {
                              if (
                                !window.confirm(
                                  "¿Anular este movimiento? Se registrará un contra-asiento.",
                                )
                              ) {
                                event.preventDefault();
                              }
                            }}
                          >
                            <input type="hidden" name="intent" value="void" />
                            <input
                              type="hidden"
                              name="entryId"
                              value={entry.id}
                            />
                            <SubmitButton
                              variant="outline"
                              size="sm"
                              pendingText="Anulando…"
                            >
                              Anular
                            </SubmitButton>
                          </Form>

                          <details className="w-full">
                            <summary className="cursor-pointer text-xs text-muted-foreground">
                              Corregir
                            </summary>
                            <Form
                              method="post"
                              className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-4"
                            >
                              <input
                                type="hidden"
                                name="intent"
                                value="correct"
                              />
                              <input
                                type="hidden"
                                name="entryId"
                                value={entry.id}
                              />
                              <Select
                                name="type"
                                defaultValue={entry.type}
                              >
                                <SelectTrigger
                                  size="sm"
                                  className="w-full rounded-lg text-sm"
                                  aria-label="Tipo de movimiento"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="DEBT">Deuda</SelectItem>
                                  <SelectItem value="PAYMENT">Abono</SelectItem>
                                </SelectContent>
                              </Select>
                              <MoneyInput
                                name="amount"
                                defaultValue={Math.round(
                                  fromCents(entry.amount),
                                )}
                                required
                                className="rounded-lg text-sm"
                              />
                              <Input
                                name="description"
                                defaultValue={entry.description ?? ""}
                                placeholder="Descripción"
                                className="rounded-lg text-sm"
                              />
                              <SubmitButton
                                size="sm"
                                pendingText="Guardando…"
                              >
                                Guardar corrección
                              </SubmitButton>
                            </Form>
                          </details>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

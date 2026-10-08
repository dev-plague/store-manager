import { useEffect } from "react";
import { Form, Link } from "react-router";
import { sileo } from "sileo";
import { authContext } from "~/context";
import { MoneyInput } from "~/components/money-input";
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
import type { Route } from "./+types/dashboard.customer";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Detalle del cliente · Gestor de Tienda" }];
}

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

// Formatea una fecha de forma determinista (evita desajustes de hidratación).
function formatDate(value: Date): string {
  const date = new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const auth = context.get(authContext);
  assertAuthenticated(auth);
  assertPermission(auth, "customers:read");

  const businessId = await requireBusinessId(request, auth);
  const customer = await getCustomerById(businessId, params.customerId);

  if (!customer) {
    throw new Response("Cliente no encontrado.", { status: 404 });
  }

  const [entries, balance] = await Promise.all([
    listCustomerLedger(businessId, customer.id),
    getCustomerBalance(businessId, customer.id),
  ]);

  const canAdjust =
    auth.isSuperadmin || auth.permissions.has("ledger:adjust");

  return { customer, entries, balance, canAdjust };
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
  const { customer, entries, balance, canAdjust } = loaderData;

  useEffect(() => {
    if (!actionData) return;
    if (actionData.ok) {
      sileo.success({ title: actionData.message });
    } else {
      sileo.error({ title: actionData.error });
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

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Registrar movimiento</h2>
        <Form
          method="post"
          className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
        >
          <input type="hidden" name="intent" value="create" />
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">
              ¿Qué deseas registrar?
            </span>
            <select
              name="type"
              defaultValue="DEBT"
              className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="DEBT">Deuda (fiado)</option>
              <option value="PAYMENT">Abono (pago)</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">Monto</span>
            <MoneyInput
              name="amount"
              placeholder="0"
              required
              className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium">
              Descripción (opcional)
            </span>
            <input
              name="description"
              className="rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            Guardar movimiento
          </button>
        </Form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Historial</h2>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin movimientos registrados.
          </p>
        ) : (
          <ul className="divide-y rounded-xl border">
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
                        {formatDate(entry.createdAt)}
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
                      <Form method="post">
                        <input type="hidden" name="intent" value="void" />
                        <input
                          type="hidden"
                          name="entryId"
                          value={entry.id}
                        />
                        <button
                          type="submit"
                          className="rounded-md border px-2.5 py-1 text-xs font-medium"
                        >
                          Anular
                        </button>
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
                          <select
                            name="type"
                            defaultValue={entry.type}
                            className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="DEBT">Deuda</option>
                            <option value="PAYMENT">Abono</option>
                          </select>
                          <MoneyInput
                            name="amount"
                            defaultValue={Math.round(fromCents(entry.amount))}
                            required
                            className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                          />
                          <input
                            name="description"
                            defaultValue={entry.description ?? ""}
                            placeholder="Descripción"
                            className="rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                          >
                            Guardar corrección
                          </button>
                        </Form>
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "~/db/client.server";
import { customers, ledgerEntries } from "~/db/schema";
import type { CustomerBalance, LedgerEntry, LedgerEntryType } from "~/types";

// Servicio del libro mayor (ledger).
//
// El ledger es INMUTABLE: las entradas nunca se editan ni se borran. Para
// corregir un error se usa un contra-asiento:
//   1. Se marca la entrada original como anulada (`voided_at` / `voided_by`).
//   2. Se inserta una entrada de reverso (tipo opuesto, mismo monto) con
//      `reversal_of_id` apuntando al original.
//   3. (Opcional) Se inserta la entrada corregida.
// Los agregados ignoran las entradas anuladas y sus reversos, de modo que el
// saldo refleja solo la información vigente. El historial completo se conserva.

// Condición que deja solo entradas vigentes (para sumatorias/métricas).
const activeEntry = () =>
  and(isNull(ledgerEntries.voidedAt), isNull(ledgerEntries.reversalOfId));

// Aporte de una entrada al saldo pendiente (deuda - pagos):
// DEBT suma; PAYMENT resta.
function outstandingContribution(
  type: LedgerEntryType,
  amount: number,
): number {
  return type === "DEBT" ? amount : -amount;
}

// Cliente de transacción de Drizzle.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateLedgerEntryInput = {
  businessId: string;
  customerId: string;
  amountCents: number;
  type: LedgerEntryType;
  description?: string | null;
  createdBy: string;
};

// Verifica que el cliente exista y pertenezca a la tienda indicada.
async function assertCustomerInBusiness(
  businessId: string,
  customerId: string,
): Promise<void> {
  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      and(eq(customers.id, customerId), eq(customers.businessId, businessId)),
    )
    .limit(1);

  if (!customer) {
    throw new Response("El cliente no existe en esta tienda.", { status: 404 });
  }
}

// Inserta una entrada contable aplicando las validaciones de negocio.
export async function createLedgerEntry(
  input: CreateLedgerEntryInput,
): Promise<LedgerEntry> {
  // Los montos siempre son positivos y en centavos. La dirección la define `type`.
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Response("El monto debe ser un entero positivo en centavos.", {
      status: 400,
    });
  }

  await assertCustomerInBusiness(input.businessId, input.customerId);

  // Regla de negocio: no se puede abonar más de lo que se debe.
  if (input.type === "PAYMENT") {
    const { outstandingCents } = await getCustomerBalance(
      input.businessId,
      input.customerId,
    );

    if (input.amountCents > outstandingCents) {
      throw new Response(
        "El abono supera la deuda pendiente: no se puede pagar más de lo que se debe.",
        { status: 400 },
      );
    }
  }

  const [entry] = await db
    .insert(ledgerEntries)
    .values({
      businessId: input.businessId,
      customerId: input.customerId,
      amount: input.amountCents,
      type: input.type,
      description: input.description ?? null,
      createdBy: input.createdBy,
    })
    .returning();

  return entry;
}

// Registra una deuda (el cliente adquiere saldo deudor).
export async function createDebt(
  input: Omit<CreateLedgerEntryInput, "type">,
): Promise<LedgerEntry> {
  return createLedgerEntry({ ...input, type: "DEBT" });
}

// Registra un abono (pago total o parcial).
export async function createPayment(
  input: Omit<CreateLedgerEntryInput, "type">,
): Promise<LedgerEntry> {
  return createLedgerEntry({ ...input, type: "PAYMENT" });
}

// Recupera una entrada validando el aislamiento por tienda.
export async function getLedgerEntryById(
  businessId: string,
  entryId: string,
): Promise<LedgerEntry | null> {
  const [entry] = await db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.id, entryId),
        eq(ledgerEntries.businessId, businessId),
      ),
    )
    .limit(1);

  return entry ?? null;
}

// Comprueba que la entrada pueda anularse.
function assertAdjustable(entry: LedgerEntry): void {
  if (entry.voidedAt) {
    throw new Response("El movimiento ya fue anulado.", { status: 400 });
  }
  if (entry.reversalOfId) {
    throw new Response("No se puede anular una anulación.", { status: 400 });
  }
}

// Verifica que anular/corregir no deje el saldo pendiente en negativo.
// `replacement` es la entrada corregida (o null si solo se anula).
async function assertBalanceStaysNonNegative(
  businessId: string,
  entry: LedgerEntry,
  replacement: { type: LedgerEntryType; amountCents: number } | null,
): Promise<void> {
  const { outstandingCents } = await getCustomerBalance(
    businessId,
    entry.customerId,
  );

  const projected =
    outstandingCents -
    outstandingContribution(entry.type, entry.amount) +
    (replacement
      ? outstandingContribution(replacement.type, replacement.amountCents)
      : 0);

  if (projected < 0) {
    throw new Response(
      replacement
        ? "La corrección dejaría un saldo a favor (negativo). Ajusta el monto o el tipo."
        : "Esta anulación dejaría un saldo a favor (negativo). Revisa primero los abonos aplicados.",
      { status: 400 },
    );
  }
}

// Inserta el contra-asiento y marca el original como anulado (dentro de una tx).
async function applyVoid(
  tx: Tx,
  entry: LedgerEntry,
  input: { voidedBy: string; description: string },
): Promise<LedgerEntry> {
  const [reversal] = await tx
    .insert(ledgerEntries)
    .values({
      businessId: entry.businessId,
      customerId: entry.customerId,
      amount: entry.amount,
      // Tipo opuesto: un DEBT se anula con un PAYMENT y viceversa.
      type: entry.type === "DEBT" ? "PAYMENT" : "DEBT",
      description: input.description,
      reversalOfId: entry.id,
      createdBy: input.voidedBy,
    })
    .returning();

  await tx
    .update(ledgerEntries)
    .set({ voidedAt: new Date(), voidedBy: input.voidedBy })
    .where(eq(ledgerEntries.id, entry.id));

  return reversal;
}

// Anula una entrada con un contra-asiento (sin entrada de reemplazo).
export async function voidLedgerEntry(input: {
  businessId: string;
  entryId: string;
  voidedBy: string;
  reason?: string | null;
}): Promise<LedgerEntry> {
  const entry = await getLedgerEntryById(input.businessId, input.entryId);
  if (!entry) {
    throw new Response("Movimiento no encontrado.", { status: 404 });
  }
  assertAdjustable(entry);
  await assertBalanceStaysNonNegative(input.businessId, entry, null);

  return db.transaction((tx) =>
    applyVoid(tx, entry, {
      voidedBy: input.voidedBy,
      description: input.reason?.trim() || "Anulación de movimiento",
    }),
  );
}

// Corrige un movimiento: anula el original y crea la entrada corregida.
export async function correctLedgerEntry(input: {
  businessId: string;
  entryId: string;
  amountCents: number;
  type: LedgerEntryType;
  description?: string | null;
  correctedBy: string;
}): Promise<{ reversal: LedgerEntry; corrected: LedgerEntry }> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Response("El monto debe ser un entero positivo en centavos.", {
      status: 400,
    });
  }

  const entry = await getLedgerEntryById(input.businessId, input.entryId);
  if (!entry) {
    throw new Response("Movimiento no encontrado.", { status: 404 });
  }
  assertAdjustable(entry);
  await assertBalanceStaysNonNegative(input.businessId, entry, {
    type: input.type,
    amountCents: input.amountCents,
  });

  return db.transaction(async (tx) => {
    const reversal = await applyVoid(tx, entry, {
      voidedBy: input.correctedBy,
      description: "Anulación por corrección",
    });

    const [corrected] = await tx
      .insert(ledgerEntries)
      .values({
        businessId: entry.businessId,
        customerId: entry.customerId,
        amount: input.amountCents,
        type: input.type,
        description: input.description?.trim() || "Corrección de movimiento",
        createdBy: input.correctedBy,
      })
      .returning();

    return { reversal, corrected };
  });
}

// Historial completo de movimientos de un cliente (incluye anulados y reversos).
export async function listCustomerLedger(
  businessId: string,
  customerId: string,
): Promise<LedgerEntry[]> {
  return db
    .select()
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.businessId, businessId),
        eq(ledgerEntries.customerId, customerId),
      ),
    )
    .orderBy(desc(ledgerEntries.createdAt));
}

// Calcula el saldo del cliente (solo entradas vigentes):
//   balance    = SUM(PAYMENT) - SUM(DEBT)
//   outstanding = SUM(DEBT) - SUM(PAYMENT)  (deuda pendiente, positiva si debe)
// Los montos se devuelven en centavos.
export async function getCustomerBalance(
  businessId: string,
  customerId: string,
): Promise<CustomerBalance> {
  const [row] = await db
    .select({
      debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.businessId, businessId),
        eq(ledgerEntries.customerId, customerId),
        activeEntry(),
      ),
    );

  const debtCents = Number(row?.debt ?? 0);
  const paymentCents = Number(row?.payment ?? 0);

  return {
    customerId,
    debtCents,
    paymentCents,
    balanceCents: paymentCents - debtCents,
    outstandingCents: debtCents - paymentCents,
  };
}

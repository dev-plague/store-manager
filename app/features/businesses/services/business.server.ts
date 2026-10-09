import {
  asc,
  count,
  eq,
  ne,
  and,
  inArray,
  isNull,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "~/db/client.server";
import {
  businesses,
  customers,
  ledgerEntries,
  users,
} from "~/db/schema";
import type { Business } from "~/types";

// Acceso a tiendas. Usado por las vistas globales del Administrador Global
// y por la gestión de tiendas.

export type BusinessWithMetrics = Business & {
  customerCount: number;
  debtCents: number;
  paymentCents: number;
  balanceCents: number;
  outstandingCents: number;
};

export type CreateBusinessInput = {
  name: string;
  slug: string;
  currency: string;
  timezone: string;
};

export type UpdateBusinessInput = Partial<
  Pick<Business, "name" | "slug" | "currency" | "timezone" | "isActive">
>;

// Lista todas las tiendas con sus totales contables agregados.
export async function listBusinessesWithMetrics(): Promise<
  BusinessWithMetrics[]
> {
  const rows = await db
    .select({
      business: businesses,
      debt: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'DEBT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      payment: sql<string>`coalesce(sum(case when ${ledgerEntries.type} = 'PAYMENT' then ${ledgerEntries.amount} else 0 end), 0)::bigint`,
      customerCount: sql<string>`count(distinct ${ledgerEntries.customerId})`,
    })
    .from(businesses)
    .leftJoin(
      ledgerEntries,
      and(
        eq(ledgerEntries.businessId, businesses.id),
        isNull(ledgerEntries.voidedAt),
        isNull(ledgerEntries.reversalOfId),
      ),
    )
    .groupBy(businesses.id)
    .orderBy(asc(businesses.name));

  return rows.map((row) => {
    const debtCents = Number(row.debt);
    const paymentCents = Number(row.payment);

    return {
      ...row.business,
      customerCount: Number(row.customerCount),
      debtCents,
      paymentCents,
      balanceCents: paymentCents - debtCents,
      outstandingCents: debtCents - paymentCents,
    };
  });
}

export async function getBusinessById(id: string): Promise<Business | null> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, id))
    .limit(1);

  return business ?? null;
}

// Comprueba si un slug ya está en uso (excluyendo la propia tienda al editar).
async function isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const condition: SQL = excludeId
    ? and(eq(businesses.slug, slug), ne(businesses.id, excludeId))!
    : eq(businesses.slug, slug);

  const [row] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(condition)
    .limit(1);

  return Boolean(row);
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<Business> {
  if (await isSlugTaken(input.slug)) {
    throw new Response("Ya existe una tienda con ese identificador (slug).", {
      status: 400,
    });
  }

  const [business] = await db.insert(businesses).values(input).returning();
  return business;
}

export async function updateBusiness(
  id: string,
  changes: UpdateBusinessInput,
): Promise<Business | null> {
  if (changes.slug && (await isSlugTaken(changes.slug, id))) {
    throw new Response("Ya existe una tienda con ese identificador (slug).", {
      status: 400,
    });
  }

  const [business] = await db
    .update(businesses)
    .set(changes)
    .where(eq(businesses.id, id))
    .returning();

  return business ?? null;
}

export async function setBusinessActive(
  id: string,
  isActive: boolean,
): Promise<Business | null> {
  return updateBusiness(id, { isActive });
}

export async function countBusinessUsers(businessId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.businessId, businessId));

  return row?.value ?? 0;
}

// Resumen del impacto de eliminar una tienda (para la confirmación fuerte).
export type BusinessDeletionImpact = {
  customers: number;
  entries: number;
  users: number;
};

export async function getBusinessDeletionImpact(
  id: string,
): Promise<BusinessDeletionImpact> {
  const [customerRows, entryRows, userRows] = await Promise.all([
    db
      .select({ value: count() })
      .from(customers)
      .where(eq(customers.businessId, id)),
    db
      .select({ value: count() })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.businessId, id)),
    db.select({ value: count() }).from(users).where(eq(users.businessId, id)),
  ]);

  return {
    customers: customerRows[0]?.value ?? 0,
    entries: entryRows[0]?.value ?? 0,
    users: userRows[0]?.value ?? 0,
  };
}

// Elimina una tienda con TODO su contenido en cascada: clientes, movimientos,
// permisos y los usuarios asignados (antes se bloqueaba si tenía usuarios).
// Operación destructiva: solo la ejecuta el Administrador Global.
export async function deleteBusiness(id: string): Promise<void> {
  const members = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.businessId, id));
  const memberIds = members.map((member) => member.id);

  // Si algún usuario de la tienda registró movimientos en OTRA tienda, la FK
  // RESTRICT de `ledger_entries.created_by` impediría borrarlo: se avisa.
  if (memberIds.length > 0) {
    const [foreignEntries] = await db
      .select({ value: count() })
      .from(ledgerEntries)
      .where(
        and(
          inArray(ledgerEntries.createdBy, memberIds),
          ne(ledgerEntries.businessId, id),
        ),
      );

    if ((foreignEntries?.value ?? 0) > 0) {
      throw new Response(
        "No se puede eliminar: algún usuario de la tienda registró movimientos en otra tienda.",
        { status: 400 },
      );
    }
  }

  await db.transaction(async (tx) => {
    // `customers`, `ledger_entries` y `user_permissions` caen por CASCADE.
    await tx.delete(businesses).where(eq(businesses.id, id));

    // Los usuarios quedan con `business_id = null` tras el CASCADE: se eliminan
    // explícitamente (sus movimientos ya se borraron con la tienda).
    if (memberIds.length > 0) {
      await tx.delete(users).where(inArray(users.id, memberIds));
    }
  });
}

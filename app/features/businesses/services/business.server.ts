import { asc, count, eq, ne, and, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "~/db/client.server";
import { businesses, ledgerEntries, users } from "~/db/schema";
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

// Elimina una tienda. Se bloquea si tiene usuarios asignados para evitar
// dejar cuentas huérfanas sin tienda.
export async function deleteBusiness(id: string): Promise<void> {
  const assignedUsers = await countBusinessUsers(id);

  if (assignedUsers > 0) {
    throw new Response(
      "No se puede eliminar: la tienda tiene usuarios asignados. Desactívala en su lugar.",
      { status: 400 },
    );
  }

  await db.delete(businesses).where(eq(businesses.id, id));
}

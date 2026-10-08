import { relations } from "drizzle-orm";
import { accounts, sessions, users } from "./auth";
import { businesses } from "./businesses";
import { customers } from "./customers";
import { ledgerEntries } from "./ledger-entries";
import { userPermissions } from "./user-permissions";

// Definiciones de relaciones (Drizzle v1) usadas por las consultas relacionales
// y por el adaptador de Better Auth (joins).

export const businessesRelations = relations(businesses, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  ledgerEntries: many(ledgerEntries),
  userPermissions: many(userPermissions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  business: one(businesses, {
    fields: [users.businessId],
    references: [businesses.id],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  // Dos claves foráneas hacia `users` (userId / grantedBy) exigen `relationName`.
  permissions: many(userPermissions, {
    relationName: "user_permissions_userId",
  }),
  grantedPermissions: many(userPermissions, {
    relationName: "user_permissions_grantedBy",
  }),
  createdCustomers: many(customers),
  createdLedgerEntries: many(ledgerEntries),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  business: one(businesses, {
    fields: [customers.businessId],
    references: [businesses.id],
  }),
  createdByUser: one(users, {
    fields: [customers.createdBy],
    references: [users.id],
  }),
  ledgerEntries: many(ledgerEntries),
}));

export const ledgerEntriesRelations = relations(ledgerEntries, ({ one }) => ({
  business: one(businesses, {
    fields: [ledgerEntries.businessId],
    references: [businesses.id],
  }),
  customer: one(customers, {
    fields: [ledgerEntries.customerId],
    references: [customers.id],
  }),
  createdByUser: one(users, {
    fields: [ledgerEntries.createdBy],
    references: [users.id],
  }),
}));

export const userPermissionsRelations = relations(
  userPermissions,
  ({ one }) => ({
    business: one(businesses, {
      fields: [userPermissions.businessId],
      references: [businesses.id],
    }),
    user: one(users, {
      fields: [userPermissions.userId],
      references: [users.id],
      relationName: "user_permissions_userId",
    }),
    grantedByUser: one(users, {
      fields: [userPermissions.grantedBy],
      references: [users.id],
      relationName: "user_permissions_grantedBy",
    }),
  }),
);

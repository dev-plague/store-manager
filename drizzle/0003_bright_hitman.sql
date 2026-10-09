ALTER TABLE "businesses" ALTER COLUMN "timezone" SET DEFAULT 'America/Bogota';
--> statement-breakpoint
-- Migra las tiendas que quedaron con el valor por defecto anterior (UTC) a la
-- zona de Colombia (UTC-5), ya que la aplicación opera en ese país.
UPDATE "businesses" SET "timezone" = 'America/Bogota' WHERE "timezone" = 'UTC';
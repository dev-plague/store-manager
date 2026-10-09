import { ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Link } from "react-router";
import { ThemeToggle } from "~/components/theme-toggle";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Gestor de Tienda" },
    {
      name: "description",
      content: "Registra clientes, deudas y abonos de tu tienda local.",
    },
  ];
}

const features = [
  {
    icon: Wallet,
    title: "Fiados y abonos",
    description: "Registra deudas y pagos parciales sin perder el detalle.",
  },
  {
    icon: TrendingUp,
    title: "Saldos claros",
    description: "Consulta cuánto te debe cada cliente de un vistazo.",
  },
  {
    icon: ShieldCheck,
    title: "Historial confiable",
    description: "Corrige movimientos sin borrar el historial contable.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Gestión de fiados
        </span>
        <ThemeToggle />
      </div>

      <header className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Gestor de Tienda</h1>
        <p className="text-muted-foreground">
          Controla deudas y créditos de tus clientes de forma precisa.
        </p>
      </header>

      <ul className="space-y-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title}>
              <Card className="flex-row items-start gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {feature.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {feature.description}
                  </span>
                </span>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col gap-3">
        <Button asChild className="h-12 rounded-xl text-base">
          <Link to="/login">Iniciar sesión</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="h-12 rounded-xl text-base"
        >
          <Link to="/dashboard">Ir al panel</Link>
        </Button>
      </div>
    </main>
  );
}

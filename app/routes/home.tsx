import type { LucideIcon } from "lucide-react";
import {
	ArrowDownRight,
	ArrowUpRight,
	Check,
	ShieldCheck,
	Sparkles,
	TrendingUp,
	Wallet,
} from "lucide-react";
import { Link } from "react-router";
import { ThemeToggle } from "~/components/theme-toggle";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
	return [
		{ title: "Gestor de Tienda" },
		{
			name: "description",
			content:
				"Registra clientes, deudas y abonos de tu tienda local y consulta sus saldos.",
		},
	];
}

// Tonos de color para los "chips" de icono (se adaptan a claro/oscuro).
const TONES = {
	emerald:
		"bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
	rose: "bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300",
	amber: "bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
	violet:
		"bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
} as const;

type Tone = keyof typeof TONES;

const features: {
	icon: LucideIcon;
	tone: Tone;
	title: string;
	description: string;
}[] = [
	{
		icon: Wallet,
		tone: "emerald",
		title: "Cuentas y abonos",
		description: "Registra deudas y pagos parciales sin perder el detalle.",
	},
	{
		icon: TrendingUp,
		tone: "amber",
		title: "Saldos claros",
		description: "Consulta cuánto te debe cada cliente de un vistazo.",
	},
	{
		icon: ShieldCheck,
		tone: "violet",
		title: "Historial confiable",
		description: "Corrige movimientos sin borrar el historial contable.",
	},
];

const activity = [
	{
		name: "Juan Pérez",
		label: "Abono · hoy",
		amount: "−$ 220.000",
		debt: false,
	},
	{
		name: "María Gómez",
		label: "Deuda · ayer",
		amount: "+$ 80.000",
		debt: true,
	},
	{
		name: "Carlos Rodríguez",
		label: "Abono · ayer",
		amount: "−$ 10.000",
		debt: false,
	},
];

export default function Home() {
	return (
		<main className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6 sm:py-8">
			<header className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
						ST
					</span>
					<div className="leading-tight">
						<p className="text-sm font-bold tracking-tight">Gestor de Tienda</p>
						<p className="text-xs text-muted-foreground">Cuentas y abonos</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<ThemeToggle />
					<Button asChild className="hidden rounded-xl sm:inline-flex">
						<Link to="/login">Iniciar sesión</Link>
					</Button>
				</div>
			</header>

			<section className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-2 lg:gap-14 lg:py-14">
				<div className="space-y-6">
					<Badge className="gap-1.5">
						<Sparkles className="size-3.5" /> Gestión de cuentas
					</Badge>

					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
						Lleva las cuentas de tu negocio{" "}
						<span className="text-primary">al día</span>
					</h1>

					<p className="max-w-md text-lg text-muted-foreground">
						Registra deudas y abonos, consulta cuánto te debe cada cliente y
						corrige movimientos sin perder el historial.
					</p>

					<div className="flex flex-col gap-3 sm:flex-row">
						<Button asChild size="lg" className="rounded-xl text-base">
							<Link to="/login">Iniciar sesión</Link>
						</Button>
						<Button
							asChild
							variant="outline"
							size="lg"
							className="rounded-xl text-base"
						>
							<Link to="/dashboard">Ir al panel</Link>
						</Button>
					</div>

					<ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-muted-foreground">
						{["Sin instalar", "Multi-tienda", "Historial inmutable"].map(
							(item) => (
								<li key={item} className="inline-flex items-center gap-1.5">
									<Check className="size-4 text-primary" aria-hidden />
									{item}
								</li>
							),
						)}
					</ul>
				</div>

				{/* Mock del producto (estilo fintech). */}
				<div className="relative mx-auto w-full max-w-sm lg:max-w-md">
					<div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-xl shadow-black/5">
						<div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
							<div className="pointer-events-none absolute -top-8 -right-6 size-32 rounded-full bg-white/10" />
							<p className="text-sm text-white/80">Deuda pendiente</p>
							<p className="mt-1 text-4xl font-bold tracking-tight">
								$ 134.000
							</p>
							<div className="mt-4 flex gap-2">
								<span className="rounded-2xl bg-white/15 px-3 py-1.5 text-xs font-medium">
									3 deudores
								</span>
								<span className="rounded-2xl bg-white/15 px-3 py-1.5 text-xs font-medium">
									4 clientes
								</span>
							</div>
						</div>

						<div className="space-y-1 p-4">
							<p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">
								Actividad reciente
							</p>
							<ul className="divide-y divide-border/60">
								{activity.map((row) => (
									<li key={row.name} className="flex items-center gap-3 py-2.5">
										<span
											className={cn(
												"grid size-9 shrink-0 place-items-center rounded-full",
												row.debt ? TONES.rose : TONES.emerald,
											)}
										>
											{row.debt ? (
												<ArrowUpRight className="size-4" aria-hidden />
											) : (
												<ArrowDownRight className="size-4" aria-hidden />
											)}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-semibold">
												{row.name}
											</span>
											<span className="block truncate text-xs text-muted-foreground">
												{row.label}
											</span>
										</span>
										<span
											className={cn(
												"shrink-0 text-sm font-semibold",
												row.debt ? "text-rose-600" : "text-emerald-600",
											)}
										>
											{row.amount}
										</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>

			<section className="grid gap-4 pb-6 sm:grid-cols-3">
				{features.map((feature) => {
					const Icon = feature.icon;
					return (
						<Card key={feature.title} className="gap-3 p-5">
							<span
								className={cn(
									"grid size-11 place-items-center rounded-2xl",
									TONES[feature.tone],
								)}
							>
								<Icon className="size-5" aria-hidden />
							</span>
							<div className="space-y-1">
								<h2 className="text-base font-semibold">{feature.title}</h2>
								<p className="text-sm text-muted-foreground">
									{feature.description}
								</p>
							</div>
						</Card>
					);
				})}
			</section>
		</main>
	);
}

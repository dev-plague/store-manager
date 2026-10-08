import type { Config } from "@react-router/dev/config";

export default {
	// Renderizado en servidor (SSR) por defecto.
	// Para modo SPA cambiar a `false`.
	ssr: true,
	allowedActionOrigins: [
		"store-manager-web-qqcp7m-5fc9ac-185-2-102-54.sslip.io",
		"store.codehive.com.co",
	],
} satisfies Config;

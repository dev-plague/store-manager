// Ruta de recurso que responde a la petición automática que Chrome DevTools
// hace a /.well-known/appspecific/com.chrome.devtools.json.
// Sin esta ruta, React Router registra un error "No route matches URL" en cada
// arranque del navegador (no fatal, pero ruidoso en desarrollo).
export function loader() {
  return new Response(null, { status: 204 });
}

import { useEffect } from "react";
import { useSearchParams } from "react-router";
import { sileo } from "sileo";

// Muestra una notificación de éxito a partir de `?flash=...` en la URL y luego
// limpia el parámetro. Se usa tras un redirect (p. ej. al crear un registro).
export function FlashToast() {
  const [searchParams, setSearchParams] = useSearchParams();
  const flash = searchParams.get("flash");

  useEffect(() => {
    if (!flash) return;

    sileo.success({ title: flash });

    const next = new URLSearchParams(window.location.search);
    next.delete("flash");
    setSearchParams(next, { replace: true });
  }, [flash, setSearchParams]);

  return null;
}

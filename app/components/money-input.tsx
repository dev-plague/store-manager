import { useState } from "react";

// Entrada de dinero con formato visual de miles (convención Colombia: punto).
//
// - El usuario escribe solo dígitos; visualmente se muestra "20.000".
// - El formulario envía el valor SIN separadores (p. ej. "20000"), de modo que
//   la base de datos y el servidor reciben el número limpio.
type MoneyInputProps = {
  name: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
};

// Deja únicamente dígitos (sin puntos, comas ni signos).
function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Inserta el separador de miles: 20000 -> 20.000.
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function MoneyInput({
  name,
  defaultValue = "",
  placeholder,
  required,
  className,
  ariaLabel,
}: MoneyInputProps) {
  const [digits, setDigits] = useState(() =>
    onlyDigits(String(defaultValue ?? "")),
  );

  return (
    <>
      {/* Campo visible: formateado, sin `name` (no se envía). */}
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={groupThousands(digits)}
        onChange={(event) => setDigits(onlyDigits(event.target.value))}
        placeholder={placeholder}
        required={required}
        aria-label={ariaLabel ?? placeholder ?? name}
        className={className}
      />
      {/* Campo real enviado al servidor: solo dígitos. */}
      <input type="hidden" name={name} value={digits} />
    </>
  );
}

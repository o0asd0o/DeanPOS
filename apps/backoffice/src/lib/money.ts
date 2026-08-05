// One money formatter for every catalog surface (Direction prohibition 9).
// Integer arithmetic only — no float division (ADR-0005).
export function formatCentavos(centavos: number): string {
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const fraction = abs % 100;
  const whole = (abs - fraction) / 100;
  const wholeGrouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}₱${wholeGrouped}.${fraction.toString().padStart(2, "0")}`;
}

export function centavosToEditorString(centavos: number): string {
  const abs = Math.abs(centavos);
  const fraction = abs % 100;
  const whole = (abs - fraction) / 100;
  return `${centavos < 0 ? "-" : ""}${whole}.${fraction.toString().padStart(2, "0")}`;
}

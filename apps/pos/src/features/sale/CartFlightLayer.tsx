import { createPortal } from "react-dom";

export type CartFlight = {
  id: string;
  label: string;
  sourceX: number;
  sourceY: number;
  deltaX: number;
  deltaY: number;
};

type Props = {
  flights: CartFlight[];
  onComplete: (id: string) => void;
};

export function CartFlightLayer({ flights, onComplete }: Props) {
  if (flights.length === 0) return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50" aria-hidden="true">
      {flights.map((flight) => (
        <span
          key={flight.id}
          data-testid="cart-flight"
          className="cart-flight"
          ref={(element) => {
            element?.style.setProperty("left", `${flight.sourceX}px`);
            element?.style.setProperty("top", `${flight.sourceY}px`);
            element?.style.setProperty("--cart-flight-dx", `${flight.deltaX}px`);
            element?.style.setProperty("--cart-flight-dy", `${flight.deltaY}px`);
          }}
          onAnimationEnd={() => onComplete(flight.id)}
        >
          {flight.label}
        </span>
      ))}
    </div>,
    document.body,
  );
}

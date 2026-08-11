import type { DeviceIdentity } from "./device-token.ts";

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const ORDER_SEQUENCE_KEY_PREFIX = "deanpos.order-sequence.";

// POS operation permits one active browser tab per Device. localStorage does
// not provide a cross-tab atomic increment.

export const ORDER_SEQUENCE_EXHAUSTED_MESSAGE =
  "This Device cannot assign another Order number. Contact an administrator.";

type ReservableOrder = {
  deviceSequence?: number;
  orderNumber?: string;
  orderDeviceId?: string;
};

export function assignOrderNumber<T extends object>(
  order: T,
  identity: DeviceIdentity,
): T & Required<ReservableOrder> {
  const reservation = order as T & ReservableOrder;
  if (
    reservation.deviceSequence &&
    reservation.orderNumber &&
    reservation.orderDeviceId === identity.deviceId
  ) {
    return order as T & Required<ReservableOrder>;
  }
  if (reservation.deviceSequence || reservation.orderNumber || reservation.orderDeviceId) {
    throw new Error(ORDER_SEQUENCE_EXHAUSTED_MESSAGE);
  }

  const key = `${ORDER_SEQUENCE_KEY_PREFIX}${identity.deviceId}`;
  const raw = localStorage.getItem(key);
  const current = raw === null ? 0 : Number(raw);
  if (!Number.isInteger(current) || current < 0 || current >= POSTGRES_INTEGER_MAX) {
    throw new Error(ORDER_SEQUENCE_EXHAUSTED_MESSAGE);
  }

  const deviceSequence = current + 1;
  localStorage.setItem(key, String(deviceSequence));
  return {
    ...order,
    orderDeviceId: identity.deviceId,
    deviceSequence,
    orderNumber: `${identity.code}-${String(deviceSequence).padStart(4, "0")}`,
  };
}

import { authContract } from "./routes/auth/contract.ts";
import { catalogContract } from "./routes/catalog/contract.ts";
import { deviceContract } from "./routes/device/contract.ts";
import { overrideContract } from "./routes/override/contract.ts";
import { paymentMethodContract } from "./routes/payment-method/contract.ts";
import { pingContract } from "./routes/ping/contract.ts";
import { platformAdminContract } from "./routes/platform-admin/contract.ts";
import { settingsContract } from "./routes/settings/contract.ts";
import { storeContract } from "./routes/store/contract.ts";
import { terminalContract } from "./routes/terminal/contract.ts";
import { userContract } from "./routes/user/contract.ts";

// Re-export all schemas so existing deep imports (`contract/src/contract.ts`)
// continue to resolve without changes.
export * from "./routes/index.ts";

export const contract = {
  ping: pingContract,
  store: storeContract,
  user: userContract,
  paymentMethod: paymentMethodContract,
  catalog: catalogContract,
  settings: settingsContract,
  platformAdmin: platformAdminContract,
  auth: authContract,
  device: deviceContract,
  terminal: terminalContract,
  override: overrideContract,
};

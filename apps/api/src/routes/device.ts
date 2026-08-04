import { implement } from "@orpc/server";
import type { Ctx } from "backend/src/common/ctx.ts";
import { handler as cancelCodeHandler } from "backend/src/device/handlers/cancel-code.ts";
import { handler as enrolHandler } from "backend/src/device/handlers/enrol.ts";
import { handler as generateCodeHandler } from "backend/src/device/handlers/generate-code.ts";
import { handler as heartbeatHandler } from "backend/src/device/handlers/heartbeat.ts";
import { handler as listDevicesHandler } from "backend/src/device/handlers/list-devices.ts";
import { handler as listPendingCodesHandler } from "backend/src/device/handlers/list-pending-codes.ts";
import { handler as meHandler } from "backend/src/device/handlers/me.ts";
import { handler as pinSyncHandler } from "backend/src/device/handlers/pin-sync.ts";
import { handler as renameDeviceHandler } from "backend/src/device/handlers/rename-device.ts";
import { handler as revokeDeviceHandler } from "backend/src/device/handlers/revoke-device.ts";
import { handler as setAssignedUserHandler } from "backend/src/device/handlers/set-assigned-user.ts";
import { contract } from "contract/src/index.ts";

// Only transport-aware code for `device.*`/`terminal.*` (ADR-0008 rule 5).
const os = implement(contract).$context<Ctx>();

export const deviceListRoute = os.device.list.handler(({ context }) =>
  listDevicesHandler({ ctx: context, input: undefined }),
);
export const devicePendingCodesRoute = os.device.pendingCodes.handler(({ context }) =>
  listPendingCodesHandler({ ctx: context, input: undefined }),
);
export const deviceGenerateCodeRoute = os.device.generateCode.handler(({ context, input }) =>
  generateCodeHandler({ ctx: context, input }),
);
export const deviceCancelCodeRoute = os.device.cancelCode.handler(({ context, input }) =>
  cancelCodeHandler({ ctx: context, input }),
);
export const deviceRenameRoute = os.device.rename.handler(({ context, input }) =>
  renameDeviceHandler({ ctx: context, input }),
);
export const deviceRevokeRoute = os.device.revoke.handler(({ context, input }) =>
  revokeDeviceHandler({ ctx: context, input }),
);
export const deviceSetAssignedUserRoute = os.device.setAssignedUser.handler(({ context, input }) =>
  setAssignedUserHandler({ ctx: context, input }),
);

export const terminalEnrolRoute = os.terminal.enrol.handler(({ context, input }) =>
  enrolHandler({ ctx: context, input }),
);
export const terminalMeRoute = os.terminal.me.handler(({ context }) =>
  meHandler({ ctx: context, input: undefined }),
);
export const terminalHeartbeatRoute = os.terminal.heartbeat.handler(({ context }) =>
  heartbeatHandler({ ctx: context, input: undefined }),
);
export const terminalPinSyncRoute = os.terminal.pinSync.handler(({ context }) =>
  pinSyncHandler({ ctx: context, input: undefined }),
);

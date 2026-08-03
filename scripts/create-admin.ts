import { createDb } from "../packages/backend/src/db/client.ts";
import { handler, inputSchema } from "../packages/backend/src/platform-admin/handlers/provision-tenant.ts";

// Local convenience: provisions a Tenant and its first admin User through the
// same handler the platform-admin route calls, with no HTTP and no session.
// `bun run scripts/create-admin.ts <email> <password> [tenantName]`
const [adminEmail, adminPassword, tenantName = "Dev Tenant"] = process.argv.slice(2);
if (!adminEmail || !adminPassword) {
  console.error("usage: bun run scripts/create-admin.ts <email> <password> [tenantName]");
  process.exit(1);
}

const db = createDb({ databaseUrl: process.env.APP_DATABASE_URI! });
const result = await handler({
  ctx: { db, clientIp: "cli", kind: "platform-admin", platformAdmin: { platformAdminId: "cli" } },
  input: inputSchema.parse({ tenantName, adminEmail, adminPassword }),
});

console.log(result);
await db.destroy();

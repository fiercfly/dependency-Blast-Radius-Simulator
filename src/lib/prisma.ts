import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

// Use ws WebSocket polyfill only in Node.js (local dev).
// In serverless/edge environments (Vercel), native WebSocket is available.
if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const getPrismaInstance = () => {
  const connectionString = process.env.DATABASE_URL || "";
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
};

export const prisma = globalForPrisma.prisma ?? getPrismaInstance();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

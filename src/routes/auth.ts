import type { Router } from "express";

import { getPool } from "../db/pool";

export function createAuthRoutes(router: Router): void {
  router.get("/auth/verify", async (_req, res) => {
    try {
      await getPool().query("SELECT 1");
      res.status(200).json({ ok: true, database: "connected" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(200).json({
        ok: true,
        database: "disconnected",
        database_error: message,
      });
    }
  });
}

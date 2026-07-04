import type { Router } from "express";

import type { PlatformConfig } from "../config";
import { ChannelRepository } from "../db/repositories/channels";
import { getPool } from "../db/pool";
import {
  clearAuthCookie,
  readAuthCookie,
  setAuthCookie,
} from "../utils/auth-cookie";

function parseLoginBody(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object");
  }
  const token = (body as Record<string, unknown>).token;
  if (typeof token !== "string" || token.trim() === "") {
    throw new Error("token is required");
  }
  return token.trim();
}

async function buildSessionPayload(
  encryptionKey: string,
): Promise<{
  ok: true;
  database: "connected" | "disconnected";
  database_error?: string;
  channels: Array<{ id: string; name: string }>;
}> {
  let database: "connected" | "disconnected" = "connected";
  let database_error: string | undefined;
  let channels: Array<{ id: string; name: string }> = [];

  try {
    await getPool().query("SELECT 1");
    const repo = new ChannelRepository(encryptionKey);
    const list = await repo.listAll();
    channels = list.map((channel) => ({
      id: channel.id,
      name: channel.name,
    }));
  } catch (error) {
    database = "disconnected";
    database_error = error instanceof Error ? error.message : String(error);
  }

  return { ok: true, database, database_error, channels };
}

export function createPublicAuthRoutes(
  app: import("express").Express,
  platform: PlatformConfig,
): void {
  app.post("/api/auth/login", async (req, res) => {
    try {
      const token = parseLoginBody(req.body);
      if (token !== platform.authToken) {
        res.status(401).json({ error: "Wrong token" });
        return;
      }

      setAuthCookie(res, token);
      const payload = await buildSessionPayload(platform.encryptionKey);
      res.status(200).json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearAuthCookie(res);
    res.status(200).json({ ok: true });
  });

  app.get("/api/auth/session", async (req, res) => {
    const cookieToken = readAuthCookie(req);
    if (!cookieToken || cookieToken !== platform.authToken) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = await buildSessionPayload(platform.encryptionKey);
    res.status(200).json(payload);
  });
}

export function createAuthRoutes(router: Router, platform: PlatformConfig): void {
  router.get("/auth/verify", async (_req, res) => {
    const payload = await buildSessionPayload(platform.encryptionKey);
    res.status(200).json(payload);
  });
}

import type { NextFunction, Request, Response } from "express";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

function buildKey(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const proxyIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0];
  const ip = proxyIp?.trim() || request.ip || request.socket.remoteAddress || "unknown";

  return `${ip}:write`;
}

export function createWriteRateLimit(input: {
  windowMs: number;
  maxRequests: number;
}) {
  const records = new Map<string, RateLimitRecord>();

  return function writeRateLimit(request: Request, response: Response, next: NextFunction) {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) {
      next();
      return;
    }

    const now = Date.now();

    if (records.size > 1_000) {
      for (const [key, value] of records.entries()) {
        if (value.resetAt <= now) {
          records.delete(key);
        }
      }
    }

    const key = buildKey(request);
    const current = records.get(key);
    const record =
      !current || current.resetAt <= now
        ? {
            count: 0,
            resetAt: now + input.windowMs
          }
        : current;

    record.count += 1;
    records.set(key, record);

    const remaining = Math.max(input.maxRequests - record.count, 0);
    response.setHeader("X-RateLimit-Limit", String(input.maxRequests));
    response.setHeader("X-RateLimit-Remaining", String(remaining));
    response.setHeader("X-RateLimit-Reset", new Date(record.resetAt).toISOString());

    if (record.count > input.maxRequests) {
      response.status(429).json({
        error: "Rate limit exceeded for write requests.",
        retryAfterMs: Math.max(record.resetAt - now, 0)
      });
      return;
    }

    next();
  };
}

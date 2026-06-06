import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Redis } from "ioredis";
import crypto from "crypto";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret";
const TOKEN_EXPIRY = 3600;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900;

interface TokenPayload {
  userId: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
}

interface AuthResult {
  success: boolean;
  userId?: string;
  role?: string;
  error?: string;
}

export async function validateToken(token: string): Promise<AuthResult> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return { success: false, error: "Token has been revoked" };
    }
    const sessionExists = await redis.get(`session:${decoded.sessionId}`);
    if (!sessionExists) {
      return { success: false, error: "Session expired" };
    }
    return { success: true, userId: decoded.userId, role: decoded.role };
  } catch (error) {
    return { success: false, error: "Invalid token" };
  }
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, 60);
  }
  return attempts <= 10;
}

export async function trackFailedLogin(
  userId: string,
): Promise<{ locked: boolean; attempts: number }> {
  const key = `failed:${userId}`;
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, LOCKOUT_DURATION);
  }
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    await redis.set(`locked:${userId}`, "1", "EX", LOCKOUT_DURATION);
    return { locked: true, attempts };
  }
  return { locked: false, attempts };
}

export async function revokeToken(token: string): Promise<void> {
  const decoded = jwt.decode(token) as TokenPayload;
  if (decoded?.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redis.set(`blacklist:${token}`, "1", "EX", ttl);
    }
  }
}

export async function generateSession(
  userId: string,
  role: string,
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const token = jwt.sign({ userId, role, sessionId }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
  await redis.set(`session:${sessionId}`, userId, "EX", TOKEN_EXPIRY);
  return token;
}

export function authMiddleware(requiredRole?: string) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 },
      );
    }
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "No token provided" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const result = await validateToken(token);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    if (requiredRole && result.role !== requiredRole) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 },
      );
    }
    return NextResponse.next();
  };
}

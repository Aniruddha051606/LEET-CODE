import "server-only";

import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { cookies } from "next/headers";

import { env, isProduction } from "@/lib/env";

/**
 * Admin authentication.
 *
 * A single shared administrator credential, which is what a college challenge actually
 * needs — no user table, no password reset flow, no third-party identity provider.
 *
 * The password is never stored: `ADMIN_PASSWORD_HASH` holds a salted scrypt hash and
 * comparison is constant-time. The session is a signed, httpOnly cookie; there is no
 * server-side session store to go stale or leak.
 *
 * It fails closed. If either secret is missing, every login is rejected and every
 * protected route stays locked, rather than the admin area falling open.
 */

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SESSION_COOKIE = "lc_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Produces the value stored in ADMIN_PASSWORD_HASH. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;

  const salt = Buffer.from(parts[1] as string, "hex");
  const expected = Buffer.from(parts[2] as string, "hex");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  const derived = await scrypt(password, salt, KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function createToken(secret: string, now: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

function isTokenValid(token: string, secret: string, now: number): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, secret))) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      exp?: number;
    };
    return typeof decoded.exp === "number" && decoded.exp > now;
  } catch {
    return false;
  }
}

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "NOT_CONFIGURED" | "INVALID_CREDENTIALS" };

export async function login(password: string): Promise<LoginResult> {
  const hash = env.adminPasswordHash;
  const secret = env.adminSessionSecret;

  if (!hash || !secret) return { ok: false, reason: "NOT_CONFIGURED" };
  if (!(await verifyPassword(password, hash))) return { ok: false, reason: "INVALID_CREDENTIALS" };

  const store = await cookies();
  store.set(SESSION_COOKIE, createToken(secret, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** True when the caller holds a valid admin session. */
export async function isAdminAuthenticated(): Promise<boolean> {
  const secret = env.adminSessionSecret;
  if (!secret) return false;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;

  return isTokenValid(token, secret, Date.now());
}

export class AdminAuthError extends Error {
  constructor() {
    super("Admin authentication required");
    this.name = "AdminAuthError";
  }
}

/** Throws `AdminAuthError` unless the caller is an authenticated admin. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthenticated())) throw new AdminAuthError();
}

export function isAdminConfigured(): boolean {
  return env.adminConfigured;
}

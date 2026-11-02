import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { UserModel, type UserDocument } from "@/lib/models/User";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "trainai_session";
const SESSION_DAYS = 30;
const KEY_LENGTH = 64;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "Thiếu AUTH_SECRET (ít nhất 32 ký tự) trong web/.env.local. Xem README.",
    );
  }
  return secret;
}

// ---------------------------------------------------------------- mật khẩu

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------- phiên

function sign(payload: string): string {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

/** "<userId>.<expiresAt>.<signature>" */
export function createSessionToken(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + SESSION_DAYS * 24 * 60 * 60 * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): string | null {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return null;
  const [userId, expires, signature] = parts;
  const expected = Buffer.from(sign(`${userId}.${expires}`));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  if (!(Number(expires) > now) || !mongoose.isValidObjectId(userId)) return null;
  return userId;
}

export function setSessionCookie(response: NextResponse, userId: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

/** Người đang đăng nhập, hoặc null. */
export async function getCurrentUser(): Promise<UserDocument | null> {
  const userId = readSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  await connectDB();
  return UserModel.findById(userId);
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Phiên đăng nhập đã hết. Hãy đăng nhập lại." },
    { status: 401 },
  );
}

// ---------------------------------------------------------------- chống dò mật khẩu

const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 10 * 60 * 1000;

/** Sau 5 lần sai trong 10 phút thì khóa email đó 10 phút. */
export function isLockedOut(email: string, now = Date.now()): boolean {
  const entry = attempts.get(email);
  return Boolean(entry && entry.count >= MAX_ATTEMPTS && entry.until > now);
}

export function recordFailedLogin(email: string, now = Date.now()): void {
  const entry = attempts.get(email);
  const fresh = !entry || entry.until <= now;
  attempts.set(email, {
    count: fresh ? 1 : entry.count + 1,
    until: now + LOCK_MS,
  });
}

export function clearFailedLogins(email: string): void {
  attempts.delete(email);
}

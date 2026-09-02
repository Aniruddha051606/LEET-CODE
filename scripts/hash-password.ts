/**
 * Generates the admin secrets.
 *
 *   npm run admin:hash -- "your-password"   -> prints ADMIN_PASSWORD_HASH
 *   npm run admin:hash -- --secret          -> prints ADMIN_SESSION_SECRET
 *   npm run admin:hash -- "your-password" --secret  -> prints both
 *
 * The plaintext password is never stored anywhere: only the scrypt hash goes into the
 * environment, and it cannot be reversed back into the password.
 */

import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const wantsSecret = args.includes("--secret");
  const password = args.find((arg) => !arg.startsWith("--"));

  if (!password && !wantsSecret) {
    console.error(
      [
        "Usage:",
        '  npm run admin:hash -- "your-password"    Generate ADMIN_PASSWORD_HASH',
        "  npm run admin:hash -- --secret           Generate ADMIN_SESSION_SECRET",
        "",
        "Pass both to generate both values at once.",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  if (password) {
    if (password.length < 10) {
      console.error("Refusing to hash a password shorter than 10 characters.\n");
      process.exitCode = 1;
      return;
    }
    console.log(`ADMIN_PASSWORD_HASH="${await hashPassword(password)}"`);
  }

  if (wantsSecret) {
    console.log(`ADMIN_SESSION_SECRET="${randomBytes(32).toString("hex")}"`);
  }

  console.log("\nCopy these into .env (or your hosting provider's environment settings).");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

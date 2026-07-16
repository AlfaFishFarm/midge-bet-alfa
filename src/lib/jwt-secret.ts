// Single source of truth for loading/validating the JWT secret. Both
// src/lib/auth.ts (Node runtime) and middleware.ts (Edge runtime) import
// this instead of each rolling their own check - a flagged finding from the
// security review was that middleware.ts previously had a weaker check than
// auth.ts, which would have let a too-short secret still verify tokens even
// though auth.ts would have refused to sign new ones with it.

const MIN_SECRET_LENGTH = 32; // ~256 bits if reasonably random

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET is missing or too short (need >= ${MIN_SECRET_LENGTH} chars). ` +
        "Set a long random value in .env before running this app."
    );
  }
  return new TextEncoder().encode(secret);
}

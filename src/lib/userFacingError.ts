import { Prisma } from "@prisma/client";

/**
 * The message to show a user for an error caught in a route.
 *
 * Errors the app raises itself are written for people ("That Letterboxd
 * account doesn't exist") and are passed through. Anything thrown by the
 * database layer is not: its messages name tables, columns and query
 * internals, which mean nothing to the reader and shouldn't be shown to
 * them, so those are replaced with `fallback` (and logged for the owner).
 */
export function userFacingError(error: unknown, fallback: string): string {
  const isDatabaseError =
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientValidationError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError;
  if (isDatabaseError || !(error instanceof Error) || !error.message) {
    console.error(fallback, error);
    return fallback;
  }
  return error.message;
}

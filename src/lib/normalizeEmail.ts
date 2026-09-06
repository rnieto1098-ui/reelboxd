// Email addresses are case-insensitive in practice, but User.email is a
// plain unique String and SQLite/libsql can't do a case-insensitive
// findUnique (Prisma's `mode: "insensitive"` is Postgres/Mongo only). So
// every read and write of an email has to agree on one canonical form, or
// they silently stop matching each other: signing up as "Bob@x.com" and
// then asking for a password reset as "bob@x.com" looked like success and
// sent nothing. Normalize at every boundary, never per call site.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

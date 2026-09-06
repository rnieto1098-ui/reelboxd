-- Canonicalize existing emails to lowercase so they match the normalized
-- form every read and write now uses (see src/lib/normalizeEmail.ts).
-- Before this, an account created as "Bob@x.com" could not be found by the
-- password-reset flow, which lowercases before looking up.
--
-- The NOT EXISTS guard skips any row whose lowercase form is already taken
-- by a different account. That pair can only exist because signup used to
-- compare case-sensitively, and lowercasing it here would violate the
-- unique index and fail the deploy. Those rows keep working via exact-case
-- sign-in; there is nothing safe to do about them automatically.
UPDATE "User"
SET "email" = LOWER("email")
WHERE "email" <> LOWER("email")
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS other
    WHERE other."id" <> "User"."id"
      AND other."email" = LOWER("User"."email")
  );

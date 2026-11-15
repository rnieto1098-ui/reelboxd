import { del } from "@vercel/blob";

/**
 * Removes uploaded images from blob storage, best effort.
 *
 * Passes the read-write token explicitly, the same way every upload in the
 * app does: when a deployment also has an OIDC token present, the Blob SDK
 * prefers it, and a stale one made deletes fail while uploads (which named
 * the token) kept working. Failures are logged rather than thrown, because a
 * leftover file is clutter, not a reason to fail the request that replaced
 * or removed it, but they are no longer silent.
 */
export async function deleteBlobs(urls: string | null | undefined | (string | null | undefined)[]) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(
    (url): url is string => !!url && url.includes(".blob.vercel-storage.com")
  );
  if (list.length === 0) return;
  try {
    await del(list, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (error) {
    console.error(`Could not delete ${list.length} uploaded file(s) from blob storage:`, error);
  }
}

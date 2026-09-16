/**
 * Object storage behind one provider-neutral surface (blueprint D7).
 *
 * Callers store what `put()` returns and hand stored references back to
 * `resolve()` when they need something a browser can load. Whether a
 * reference is an object key or an absolute URL, which bucket it lives in and
 * how long a presigned link stays valid are the adapter's business — no caller
 * inspects a reference itself.
 *
 * Declared as an abstract class so it doubles as the Nest injection token.
 */
export abstract class StorageAdapter {
  /** True when a storage backend is configured; every operation below throws 503 otherwise. */
  abstract readonly isEnabled: boolean

  /** Stores a file and returns the reference to persist. */
  abstract put(buffer: Buffer, filename: string, mimetype: string): Promise<string>

  /**
   * Turns stored references into loadable URLs, in order. Absolute `http(s)`
   * references pass through untouched; object keys are presigned.
   */
  abstract resolve(refs: readonly string[], expirySeconds?: number): Promise<string[]>

  /** Presigned URL for one object key. */
  abstract presign(key: string, expirySeconds: number): Promise<string>

  /**
   * Deletes one stored object. Takes an object key only — callers decide
   * whether a reference is theirs to delete (not an absolute URL, not still
   * referenced elsewhere) before calling. Deleting a key that no longer
   * exists is not an error.
   */
  abstract remove(key: string): Promise<void>
}

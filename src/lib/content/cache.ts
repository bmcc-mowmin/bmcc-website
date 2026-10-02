import "server-only";

// Small in-memory cache for things every page reads but admins rarely change (site text edits,
// settings, photo slots). An admin save calls invalidate() so this server shows the change at once;
// other server instances pick it up within the TTL. Kept on globalThis so every module copy
// (and dev hot reload) shares it.

type Entry = { value: unknown; at: number };
const g = globalThis as unknown as { __bmccCache?: Map<string, Entry>; __bmccLoading?: Map<string, Promise<unknown>> };
const store = (g.__bmccCache ??= new Map());
const loading = (g.__bmccLoading ??= new Map());

export async function cached<T>(name: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(name);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  let pending = loading.get(name) as Promise<T> | undefined;
  if (!pending) {
    pending = load()
      .then((value) => {
        store.set(name, { value, at: Date.now() });
        return value;
      })
      .finally(() => loading.delete(name));
    loading.set(name, pending);
  }
  return pending;
}

export function invalidate(name: string) {
  store.delete(name);
}

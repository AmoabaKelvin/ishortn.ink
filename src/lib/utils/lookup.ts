/** Read a runtime-provided key from a static table without indexing prototype members. */
export function lookup<V>(table: Record<string, V>, key: string): V | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined;
}

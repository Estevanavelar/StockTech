export function normalizeStockTechRole(role: string): string {
  return role === 'admin' ? 'user' : role;
}

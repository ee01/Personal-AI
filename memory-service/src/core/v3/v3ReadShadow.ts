/**
 * Dual-read v3 shadow harness (P2 §11.7). Off unless MEMORY_READ_V3_RECALL_SHADOW
 * is explicitly enabled — passive recall volume makes default-on too expensive.
 */
export function isV3ReadShadowEnabled(): boolean {
  const raw = process.env.MEMORY_READ_V3_RECALL_SHADOW?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

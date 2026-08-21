/**
 * Quarter backfill for Roadmap JQL import.
 *
 * RingCentral team JQL puts the quarter filter on the *parent* layer:
 *
 *   issueFunction in portfolioChildrenOf('project = INIT AND …
 *     AND "Target Delivery Quarter" in (2026-Q3, 2026-Q4)') and issuetype = Epic
 *
 * The rows we import are the children (Epics), and those Epics normally leave
 * their own `Target Delivery Quarter` empty — the quarter lives on the parent
 * Initiative reached through Parent Link. Without a backfill every imported row
 * lands in the Backlog's no-quarter group, and an overwrite import can no
 * longer match rows by quarter.
 *
 * Deriving the quarter from Target dates is *not* a valid substitute: an Epic
 * with Target 2026-07-01 → 2026-09-30 can sit under a 2026-Q4 Initiative.
 */

export type QuarterBackfillRow = {
  key: string;
  quarter?: string;
};

/** Jira `search` page size is capped; keep parent lookups well under it. */
export const PARENT_LOOKUP_BATCH = 50;

/**
 * Parent keys worth one lookup: only for rows that still have no quarter, and
 * deduplicated because many Epics share one Initiative.
 */
export function parentKeysNeedingQuarter(
  rows: QuarterBackfillRow[],
  parentKeyByRow: Map<string, string>,
): string[] {
  const wanted = new Set<string>();
  for (const row of rows) {
    if (row.quarter) continue;
    const parent = parentKeyByRow.get(row.key);
    if (parent) wanted.add(parent);
  }
  return [...wanted];
}

export function chunk<T>(items: T[], size = PARENT_LOOKUP_BATCH): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Copy each parent's quarter onto its children. Rows that already carry their
 * own quarter win — an Epic that really is scheduled for another quarter than
 * its Initiative must keep what Jira says. Returns how many rows were filled.
 */
export function applyParentQuarters(
  rows: QuarterBackfillRow[],
  parentKeyByRow: Map<string, string>,
  quarterByParent: Map<string, string>,
): number {
  let filled = 0;
  for (const row of rows) {
    if (row.quarter) continue;
    const parent = parentKeyByRow.get(row.key);
    if (!parent) continue;
    const quarter = quarterByParent.get(parent);
    if (!quarter) continue;
    row.quarter = quarter;
    filled += 1;
  }
  return filled;
}

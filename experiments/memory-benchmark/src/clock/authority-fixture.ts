/** Local authority fixtures keyed by virtual day (historical replay — no live ticket APIs). */
export interface AuthorityRecord {
  entity_key: string;
  status: string;
  as_of_day: string;
  note?: string;
}

export interface AuthorityFixture {
  records: AuthorityRecord[];
}

export class AuthorityFixtureStore {
  constructor(private readonly fixture: AuthorityFixture) {}

  query(entityKey: string, virtualNow: string): AuthorityRecord | null {
    const day = virtualNow.slice(0, 10);
    const dayMs = Date.parse(`${day}T23:59:59.999Z`);
    let best: AuthorityRecord | null = null;
    let bestMs = -1;
    for (const rec of this.fixture.records) {
      if (rec.entity_key !== entityKey) continue;
      const recMs = Date.parse(`${rec.as_of_day}T23:59:59.999Z`);
      if (recMs <= dayMs && recMs > bestMs) {
        best = rec;
        bestMs = recMs;
      }
    }
    return best;
  }
}

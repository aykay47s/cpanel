import { sql } from './db';
import type { AuthUser } from './auth';

export async function logEvent(leadId: number, eventType: string, actor: AuthUser | null, fromStatus: string | null, toStatus: string | null, meta: Record<string, unknown> = {}) {
  await sql`INSERT INTO lead_events (lead_id, event_type, actor_id, actor_role, from_status, to_status, meta)
    VALUES (${leadId}, ${eventType}, ${actor?.id || null}, ${actor?.role || null}, ${fromStatus}, ${toStatus}, ${sql.json(meta)})`;
}

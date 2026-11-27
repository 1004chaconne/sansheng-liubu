import type { ChatSession } from '../types';

/**
 * A sidebar-level grouping of chat sessions that belong to one digital employee
 * (or one team). The chat sidebar lists one row per employee and keeps the
 * individual sessions ("档") folded underneath, so users navigate by person
 * instead of scrolling a flat list of every past question.
 */
export type SessionGroup = {
  /** Stable grouping key: `team:<id>` | `agent:<id>` | `solo:<sessionId>`. */
  key: string;
  /** `null` for team groups and for sessions whose agent no longer exists. */
  agentId: string | null;
  /** `null` for employee sessions. */
  teamId: string | null;
  /** Newest first. Always contains at least one session. */
  sessions: ChatSession[];
  /** The session a click on the employee row should open. */
  latest: ChatSession;
  /** How many sessions in this group carry an unread reply. */
  unreadCount: number;
  /** Total sessions in this group (the "N 档" badge). */
  count: number;
};

function groupKeyFor(session: ChatSession): string {
  if (session.team_id) return `team:${session.team_id}`;
  if (session.agent_id) return `agent:${session.agent_id}`;
  return `solo:${session.id}`;
}

function updatedAtMs(session: ChatSession): number {
  const ms = Date.parse(session.updated_at || '');
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Collapse a flat session list into one group per employee / team.
 *
 * Ordering: groups by their newest session (desc), sessions inside a group by
 * `updated_at` (desc). Sessions without `agent_id` and `team_id` stay solo rows
 * so nothing silently disappears from the sidebar.
 */
export function groupSessionsByEmployee(
  sessions: ChatSession[],
  options: { isUnread?: (session: ChatSession) => boolean } = {},
): SessionGroup[] {
  const isUnread = options.isUnread ?? (() => false);
  const buckets = new Map<string, ChatSession[]>();

  for (const session of sessions) {
    const key = groupKeyFor(session);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(session);
    else buckets.set(key, [session]);
  }

  const groups: SessionGroup[] = [];
  for (const [key, bucket] of buckets) {
    const sorted = [...bucket].sort((a, b) => updatedAtMs(b) - updatedAtMs(a));
    const latest = sorted[0];
    groups.push({
      key,
      agentId: latest.team_id ? null : latest.agent_id || null,
      teamId: latest.team_id || null,
      sessions: sorted,
      latest,
      unreadCount: sorted.filter((item) => isUnread(item)).length,
      count: sorted.length,
    });
  }

  return groups.sort((a, b) => updatedAtMs(b.latest) - updatedAtMs(a.latest));
}

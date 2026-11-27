import { describe, expect, it } from 'vitest';

import type { ChatSession } from '@/types';

import { groupSessionsByEmployee } from './sessionGroups';

function session(id: string, agentId: string, updatedAt: string, extra: Partial<ChatSession> = {}): ChatSession {
  return {
    id,
    tenant_id: 'tenant-demo',
    agent_id: agentId,
    status: 'completed',
    updated_at: updatedAt,
    ...extra,
  };
}

describe('groupSessionsByEmployee', () => {
  it('collapses one employee history into a single group', () => {
    const groups = groupSessionsByEmployee([
      session('s1', 'agent-doc', '2026-11-25T10:00:00Z', { title: '46 CFR 541' }),
      session('s2', 'agent-doc', '2026-11-26T10:00:00Z', { title: '免用箱天数' }),
      session('s3', 'agent-doc', '2026-11-24T10:00:00Z', { title: '堆场不让提柜' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('agent:agent-doc');
    expect(groups[0].count).toBe(3);
    expect(groups[0].latest.id).toBe('s2');
    expect(groups[0].sessions.map((item) => item.id)).toEqual(['s2', 's1', 's3']);
  });

  it('orders groups by their newest session', () => {
    const groups = groupSessionsByEmployee([
      session('finance-1', 'agent-finance', '2026-11-20T10:00:00Z'),
      session('doc-1', 'agent-doc', '2026-11-26T10:00:00Z'),
      session('finance-2', 'agent-finance', '2026-11-25T10:00:00Z'),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['agent:agent-doc', 'agent:agent-finance']);
  });

  it('keeps team sessions in their own group even when a TL agent is attached', () => {
    const groups = groupSessionsByEmployee([
      session('tl-1', 'agent-tl', '2026-11-26T10:00:00Z', { team_id: 'team-1', team_name: '增长团队' }),
      session('tl-2', 'agent-tl', '2026-11-25T10:00:00Z', { team_id: 'team-1', team_name: '增长团队' }),
      session('solo-tl', 'agent-tl', '2026-11-24T10:00:00Z'),
    ]);

    expect(groups.map((group) => group.key)).toEqual(['team:team-1', 'agent:agent-tl']);
    expect(groups[0].agentId).toBeNull();
    expect(groups[0].teamId).toBe('team-1');
  });

  it('keeps sessions without an agent as solo rows instead of dropping them', () => {
    const groups = groupSessionsByEmployee([
      { id: 'orphan', tenant_id: 'tenant-demo', status: 'completed', updated_at: '2026-11-26T10:00:00Z' },
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('solo:orphan');
    expect(groups[0].agentId).toBeNull();
  });

  it('counts unread sessions per group', () => {
    const groups = groupSessionsByEmployee(
      [
        session('a1', 'agent-doc', '2026-11-26T10:00:00Z'),
        session('a2', 'agent-doc', '2026-11-25T10:00:00Z'),
        session('b1', 'agent-finance', '2026-11-24T10:00:00Z'),
      ],
      { isUnread: (item) => item.id === 'a1' || item.id === 'a2' },
    );

    expect(groups.find((group) => group.key === 'agent:agent-doc')?.unreadCount).toBe(2);
    expect(groups.find((group) => group.key === 'agent:agent-finance')?.unreadCount).toBe(0);
  });
});

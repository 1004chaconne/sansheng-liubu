// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryRouter } from 'react-router-dom';

import { I18nProvider } from '@/i18n';
import { SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { AgentProfileRead, ChatSession, TeamRead } from '@/types';

import AppSidebar from './AppSidebar';

const product = vi.hoisted(() => ({ frameworkManagement: true }));
vi.mock('@/lib/productFeatures', () => ({
  get FRAMEWORK_MANAGEMENT_INCLUDED() { return product.frameworkManagement; },
}));

const agent: AgentProfileRead = {
  id: 'agent-1',
  tenant_id: 'tenant_demo',
  name: '小艾',
  is_overall: false,
  status: 'active',
  metadata: {},
  resources: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

const team: TeamRead = {
  id: 'team-1',
  tenant_id: 'tenant_demo',
  name: '增长团队',
  description: '',
  owner_user_id: 'user-1',
  config: {},
  status: 'active',
  members: [],
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

function stubRadixPointerApis() {
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

function renderSidebar(props: {
  isAdmin?: boolean;
  selectedAgentId: string;
  onSelectAgent?: (value: string) => void;
  scopeTeams?: TeamRead[];
}) {
  return render(
    <I18nProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar
            selected="/enterprise/dashboard"
            onNavigate={() => {}}
            isAdmin={props.isAdmin ?? false}
            scopeAgents={[agent]}
            scopeTeams={props.scopeTeams ?? [team]}
            selectedAgentId={props.selectedAgentId}
            onSelectAgent={props.onSelectAgent ?? (() => {})}
            onOpenChat={() => {}}
          />
        </SidebarProvider>
      </TooltipProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  product.frameworkManagement = true;
  cleanup();
  vi.unstubAllGlobals();
});

it('customer builds omit the framework console but keep business management navigation', () => {
  product.frameworkManagement = false;
  renderSidebar({ selectedAgentId: agent.id, isAdmin: true });
  expect(screen.queryByText('管理后台')).toBeNull();
  expect(screen.getAllByText('账号管理').length).toBeGreaterThan(0);
  expect(screen.getAllByText('模型配置').length).toBeGreaterThan(0);
  expect(screen.getAllByText('我的数字员工').length).toBeGreaterThan(0);
});

it('operator builds retain the framework console', () => {
  renderSidebar({ selectedAgentId: agent.id, isAdmin: true });
  expect(screen.getAllByText('管理后台').length).toBeGreaterThan(0);
});

beforeEach(() => {
  stubRadixPointerApis();
});

describe('AppSidebar agent switcher team group', () => {
  it('lists teams under a team group and emits the team scope value on select', async () => {
    const user = userEvent.setup();
    const onSelectAgent = vi.fn();
    renderSidebar({ selectedAgentId: 'agent-1', onSelectAgent });

    await user.click(screen.getByLabelText('切换当前员工'));
    const menu = await screen.findByRole('menu');
    // 分组标签与团队项上的 Badge 都写作「团队」。
    expect(within(menu).getAllByText('团队').length).toBeGreaterThanOrEqual(2);
    const teamItem = within(menu)
      .getAllByRole('menuitem')
      .find((item) => item.textContent?.includes('增长团队'));
    expect(teamItem).toBeTruthy();

    await user.click(teamItem!);
    expect(onSelectAgent).toHaveBeenCalledWith('team:team-1');
  });

  it('shows the team name and team caption when a team scope is selected', () => {
    renderSidebar({ selectedAgentId: 'team:team-1' });

    const trigger = screen.getByLabelText('切换当前员工');
    expect(within(trigger).getByText('当前团队')).toBeTruthy();
    expect(within(trigger).getByText('增长团队')).toBeTruthy();
  });

  it('falls back to a bare team label when the selected team is unknown', () => {
    renderSidebar({ selectedAgentId: 'team:missing', scopeTeams: [team] });

    const trigger = screen.getByLabelText('切换当前员工');
    expect(within(trigger).getByText('当前团队')).toBeTruthy();
    expect(within(trigger).getByText('团队')).toBeTruthy();
  });
});

describe('AppSidebar chat variant group conversations', () => {
  const leaderAgent: AgentProfileRead = { ...agent, id: 'agent-tl', name: '队长' };
  const teamWithLeader: TeamRead = {
    ...team,
    members: [
      {
        id: 'member-1',
        team_id: 'team-1',
        agent_id: 'agent-tl',
        role: 'leader',
        agent_name: '队长',
        created_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'member-2',
        team_id: 'team-1',
        agent_id: 'agent-1',
        role: 'member',
        agent_name: '小艾',
        created_at: '2026-08-01T00:00:00Z',
      },
    ],
  };

  function renderChatSidebar(
    scopeTeams: TeamRead[] = [teamWithLeader],
    sessions: ChatSession[] = [
      {
        id: 'session-tl',
        tenant_id: 'tenant_demo',
        agent_id: 'agent-tl',
        team_id: 'team-1',
        title: '团队 增长团队 · TL 对话',
        status: 'active',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'session-member',
        tenant_id: 'tenant_demo',
        agent_id: 'agent-1',
        title: '写公告',
        status: 'active',
        updated_at: '2026-08-01T00:00:00Z',
      },
    ],
    onArchiveHistory?: (agentId: string, agentName: string, count: number) => void,
  ) {
    return render(
      <MemoryRouter>
        <I18nProvider>
          <TooltipProvider>
            <SidebarProvider>
              <AppSidebar
                variant="chat"
                sessions={sessions}
                agents={[agent, leaderAgent]}
                scopeTeams={scopeTeams}
                sessionFilter="all"
                onSessionFilterChange={() => {}}
                sessionFilterOptions={[{ value: 'all', label: '全部员工 · 2' }]}
                isSessionUnread={() => false}
                onOpenSession={() => {}}
                onOpenGallery={() => {}}
                onRenameSession={() => {}}
                onDeleteSession={() => {}}
                onOpenAdmin={() => {}}
                onArchiveHistory={onArchiveHistory}
              />
            </SidebarProvider>
          </TooltipProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
  }

  it('renders employee sessions and team groups as different conversation types', () => {
    renderChatSidebar();

    // 团队行：标题是团队名，副标题是成员数与团队群聊标识。
    const groupRow = screen.getByText('增长团队').closest('[role="button"]');
    expect(groupRow?.textContent).toContain('2 位成员 · 团队群聊');
    // 员工行：标题是员工名，副标题是最近一档的问题。
    const employeeRow = screen.getByText('小艾').closest('[role="button"]');
    expect(employeeRow?.textContent).toContain('写公告');
    expect(employeeRow?.textContent).not.toContain('群聊');
  });

  it('collapses several sessions of one employee into a single row', () => {
    renderChatSidebar([teamWithLeader], [
      {
        id: 'session-member-old',
        tenant_id: 'tenant_demo',
        agent_id: 'agent-1',
        title: '写公告',
        status: 'active',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'session-member-new',
        tenant_id: 'tenant_demo',
        agent_id: 'agent-1',
        title: '改公告',
        status: 'active',
        updated_at: '2026-08-02T00:00:00Z',
      },
    ]);

    expect(screen.getAllByText('小艾')).toHaveLength(1);
    expect(screen.getByText('2 档')).toBeTruthy();
    const employeeRow = screen.getByText('小艾').closest('[role="button"]');
    expect(employeeRow?.textContent).toContain('改公告');
    // 旧档默认折叠，点开才出现。
    expect(screen.queryByText('写公告')).toBeNull();
  });

  it('unfolds the older sessions of an employee on demand', async () => {
    const user = userEvent.setup();
    renderChatSidebar([teamWithLeader], [
      {
        id: 'session-member-old',
        tenant_id: 'tenant_demo',
        agent_id: 'agent-1',
        title: '写公告',
        status: 'active',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'session-member-new',
        tenant_id: 'tenant_demo',
        agent_id: 'agent-1',
        title: '改公告',
        status: 'active',
        updated_at: '2026-08-02T00:00:00Z',
      },
    ]);

    await user.click(screen.getByLabelText('展开 2 档历史'));

    expect(screen.getByText('写公告')).toBeTruthy();
    // 最新一档同时出现在员工行副标题与展开的叶子行里。
    expect(screen.getAllByText('改公告').length).toBeGreaterThanOrEqual(1);
  });

  it('offers to archive older 档 of an employee with the current count', async () => {
    const user = userEvent.setup();
    const onArchiveHistory = vi.fn();
    const rows: ChatSession[] = [0, 1, 2, 3].map((index) => ({
      id: `session-old-${index}`,
      tenant_id: 'tenant_demo',
      agent_id: 'agent-1',
      title: `公告 ${index}`,
      status: 'active',
      updated_at: `2026-08-0${index + 1}T00:00:00Z`,
    }));
    renderChatSidebar([teamWithLeader], rows, onArchiveHistory);

    await user.click(screen.getByLabelText('展开 4 档历史'));
    await user.click(screen.getByText('整理历史（隐藏旧档，可恢复）'));

    expect(onArchiveHistory).toHaveBeenCalledWith('agent-1', '小艾', 4);
  });

  it('keeps a group label while the team roster is still loading', () => {
    renderChatSidebar([]);

    expect(screen.getByText('增长团队')).toBeTruthy();
    expect(screen.getByText('团队群聊')).toBeTruthy();
  });
});

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import EmployeeAvatar from '../components/EmployeeAvatar';
import { loadEmployeeDirectory } from '../api/employee-directory';
import { EnterpriseRoute } from '../enums/routes';
import type { AgentProfileRead } from '../types';
import { applyTheme, readTheme, THEMES, type ThemeKey } from '../lib/theme';

type Ministry = {
  slug: string;
  name: string;
  duty: string;
  motto: string;
  keywords: string[];
};

/** 六部：把现有员工按职能归入衙门，不改后端数据 */
const MINISTRIES: Ministry[] = [
  { slug: 'li', name: '吏部', duty: '人事', motto: '掌任免、考绩、名籍', keywords: ['人事', '招聘', '考绩', '培训', '员工'] },
  { slug: 'hu', name: '户部', duty: '财务', motto: '掌钱粮、账册、度支', keywords: ['财务', '商务', '采购', '报价', '成本', '结算'] },
  { slug: 'li2', name: '礼部', duty: '宾客', motto: '掌宾客、教化、礼仪', keywords: ['行政', '市场', '销售', '渠道', '客服', '知识'] },
  { slug: 'bing', name: '兵部', duty: '军务', motto: '掌调度、征发、驿传', keywords: ['单证', '项目', '调度', '运输', '物流', '订舱', '报关'] },
  { slug: 'xing', name: '刑部', duty: '法务', motto: '掌刑名、律令、审计', keywords: ['法务', '合规', '审计', '风控', '合同'] },
  { slug: 'gong', name: '工部', duty: '营造', motto: '掌百工、技艺、器用', keywords: ['IT', '研发', '技术', '工程', '数据', '运维'] },
];

const ZH_MONTH = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const ZH_DAY = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

function chineseDate(d: Date): string {
  return `${ZH_MONTH[d.getMonth()]}月${ZH_DAY[d.getDate() - 1]}`;
}

function ministryOf(agent: AgentProfileRead): string {
  const text = `${agent.name} ${agent.description || ''}`;
  const hit = MINISTRIES.find((m) => m.keywords.some((k) => text.includes(k)));
  return hit ? hit.slug : 'shangshu';
}

export default function CourtPage({ onLogout }: { onLogout?: () => void }) {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentProfileRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<ThemeKey>(readTheme);

  const switchTheme = (key: ThemeKey) => {
    applyTheme(key);
    setTheme(key);
  };

  useEffect(() => {
    // 不用 AbortController：loadEmployeeDirectory 带共享缓存，取消会连累其他消费者。
    // 只标记本组件是否已卸载，避免卸载后 setState。
    let cancelled = false;
    loadEmployeeDirectory()
      .then((rows) => {
        if (!cancelled) setAgents(rows.filter((a) => !a.is_overall));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(
    () =>
      MINISTRIES.map((m) => ({
        ...m,
        members: agents.filter((a) => ministryOf(a) === m.slug),
      })),
    [agents],
  );

  const unassigned = useMemo(() => agents.filter((a) => ministryOf(a) === 'shangshu'), [agents]);

  const seatedCount = agents.filter((a) => a.status !== 'archived').length;

  return (
    <>
      <AppHeader onLogout={onLogout} className="h-[60px] shrink-0 px-[32px]" />

      <div className="content">
        <div className="mx-auto flex max-w-[1180px] flex-col">
          <div className="mb-[20px] flex items-end justify-between">
            <div>
              <h1 className="text-[28px] leading-none text-foreground">政事堂</h1>
              <p className="mt-[10px] text-[13px] tracking-[0.04em] text-muted-foreground">
                三省总其成，六部分其职。
              </p>
            </div>
            <div className="text-right">
              <div
                className="text-[13px] tracking-[0.3em] text-foreground"
                style={{ fontFamily: 'var(--font-song)' }}
              >
                {chineseDate(new Date())}
              </div>
              <div className="mt-[6px] text-[11px] tracking-[0.16em] text-muted-foreground">
                在朝 {seatedCount} 员 · {loading ? '点卯中' : `${groups.filter((g) => g.members.length > 0).length} 部有人`}
              </div>
              <div className="mt-[12px] flex items-center justify-end gap-[6px]">
                {THEMES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => switchTheme(t.key)}
                    title={`${t.label} · ${t.hint}`}
                    className={`flex items-center gap-[5px] rounded-[2px] border px-[7px] py-[3px] text-[10.5px] transition-colors ${
                      theme === t.key
                        ? 'border-[var(--accent)] text-foreground'
                        : 'border-transparent text-muted-foreground hover:border-border'
                    }`}
                  >
                    <span
                      className="size-[9px] rounded-[1px] border"
                      style={{ background: t.swatch, borderColor: t.ring }}
                    />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px w-full bg-[var(--line)]" />

          <div className="mt-[20px] grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
            {groups.map((m) => {
              const active = m.members.length > 0;
              return (
                <section
                  key={m.slug}
                  className="flex min-h-[146px] flex-col rounded-[3px] border border-border bg-card px-[18px] pt-[16px] pb-[14px] transition-colors hover:border-[var(--border-strong)]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-baseline gap-[9px]">
                        <h2
                          className="text-[19px] leading-none text-foreground"
                          style={{ fontFamily: 'var(--font-song)', letterSpacing: '0.1em' }}
                        >
                          {m.name}
                        </h2>
                        <span className="text-[11px] tracking-[0.24em] text-muted-foreground">
                          {m.duty}
                        </span>
                      </div>
                      <p className="mt-[7px] text-[11px] tracking-[0.06em] text-[var(--muted-soft)]">
                        {m.motto}
                      </p>
                    </div>
                    <div
                      className="text-[26px] leading-none"
                      style={{
                        fontFamily: 'var(--font-song)',
                        color: active ? 'var(--accent)' : 'var(--muted-soft)',
                      }}
                    >
                      {loading ? '·' : m.members.length}
                    </div>
                  </div>

                  <div className="mt-[16px] flex items-center gap-[10px]">
                    {active ? (
                      m.members.slice(0, 5).map((agent) => (
                        <div key={agent.id} className="flex flex-col items-center gap-[5px]">
                          <EmployeeAvatar agent={agent} width={34} height={38} radius={2} />
                          <span className="max-w-[52px] truncate text-[10px] text-muted-foreground">
                            {agent.name}
                          </span>
                        </div>
                      ))
                    ) : (
                      <span className="text-[11px] tracking-[0.1em] text-[var(--muted-soft)]">
                        虚位以待
                      </span>
                    )}
                    {m.members.length > 5 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{m.members.length - 5}
                      </span>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {unassigned.length > 0 && (
            <section className="mt-[14px] rounded-[3px] border border-dashed border-[var(--border)] px-[18px] py-[14px]">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-[9px]">
                  <h2
                    className="text-[16px] leading-none text-foreground"
                    style={{ fontFamily: 'var(--font-song)', letterSpacing: '0.1em' }}
                  >
                    尚书省直辖
                  </h2>
                  <span className="text-[11px] tracking-[0.2em] text-muted-foreground">
                    未入六部
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">{unassigned.length} 员</span>
              </div>
              <div className="mt-[12px] flex flex-wrap gap-[14px]">
                {unassigned.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-[7px]">
                    <EmployeeAvatar agent={agent} width={26} height={30} radius={2} />
                    <span className="text-[11.5px] text-muted-foreground">{agent.name}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-[22px] flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => navigate(EnterpriseRoute.Agents)}
              className="h-[32px] rounded-[3px] border border-border px-[14px] text-[12.5px] tracking-[0.08em] text-foreground transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              调阅百官
            </button>
            <button
              type="button"
              onClick={() => navigate(EnterpriseRoute.Dashboard)}
              className="h-[32px] rounded-[3px] border border-border px-[14px] text-[12.5px] tracking-[0.08em] text-foreground transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              官牒档案
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

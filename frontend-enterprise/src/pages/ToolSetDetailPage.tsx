import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api, TENANT_ID } from '../api/client';
import AppHeader from '../components/AppHeader';
import { Switch } from '../components/ui';
import { notify } from '../components/ui/app-toast';
import { Button as UIButton } from '../components/ui/button';
import { countEnabled } from '../lib/toolGrouping';
import { makeToolPutter, setGroupEnabled, type ToolLike } from '../lib/toolEnablement';
import type { MCPServerRead, ToolRead } from '../types';

/**
 * 工具集详情：点进某个 MCP 服务器（工具集）后，逐个启用/停用组内工具。
 * 语义与工具页、广场一致：改的是 tools.enabled（真停用，员工侧同步失效）。
 */
export default function ToolSetDetailPage({ onLogout }: { onLogout?: () => void }) {
  const { serverId = '' } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<MCPServerRead | null>(null);
  const [tools, setTools] = useState<ToolRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!serverId) return;
    setLoading(true);
    try {
      const [servers, rows] = await Promise.all([
        api.get<MCPServerRead[]>(`/api/enterprise/mcp-servers?tenant_id=${TENANT_ID}`).catch(() => []),
        api.get<ToolRead[]>(`/api/enterprise/tools?tenant_id=${TENANT_ID}`),
      ]);
      setServer(servers.find((item) => item.id === serverId) || null);
      setTools(rows.filter((row) => row.mcp_server_id === serverId));
    } catch (error) {
      notify.error(error instanceof Error ? error.message : '加载工具集失败');
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => countEnabled(tools), [tools]);
  const title = server ? server.display_name || server.name : '工具集';

  async function apply(rows: ToolRead[], next: boolean, label: string) {
    if (!rows.length) {
      notify.error(`「${label}」下没有工具`);
      return;
    }
    const result = await setGroupEnabled(rows as unknown as ToolLike[], next, makeToolPutter(''));
    if (result.failed.length) {
      notify.error(
        `「${label}」${result.succeeded}/${result.total} 成功，失败：${result.failed
          .slice(0, 3)
          .map((item) => item.name)
          .join('、')}`,
      );
    } else {
      notify.success(`「${label}」已${next ? '启用' : '停用'} ${result.succeeded} 个工具`);
    }
    await load();
  }

  async function toggleOne(row: ToolRead, next: boolean) {
    setBusyKey(row.id);
    try {
      await apply([row], next, row.display_name || row.name);
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleAll(next: boolean) {
    setBusyKey('__all__');
    try {
      await apply(tools, next, title);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="min-h-full px-[48px] pt-[32px] pb-[43px] max-[900px]:px-[16px]">
      <AppHeader
        onLogout={onLogout}
        left={
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => navigate('/enterprise/tools')}
              className="text-[12px] text-[#757f9c] hover:text-[#18181a]"
            >
              ← 返回工具页
            </button>
            <span className="text-[15px] font-medium text-[#18181a]">{title}</span>
            {server && <span className="text-[12px] text-[#858b9c]">{server.name}</span>}
          </div>
        }
      />

      <div className="mt-[24px] flex flex-wrap items-center justify-between gap-[16px] rounded-[14px] border-[0.5px] border-[#e3e7f1] bg-white px-[20px] py-[16px]">
        <div className="flex items-center gap-[10px]">
          <Switch
            checked={stats.allEnabled}
            disabled={busyKey === '__all__' || tools.length === 0}
            onCheckedChange={(next) => void toggleAll(next)}
            aria-label="工具集总开关"
          />
          <span className="text-[13px] text-[#464c5e]">
            已启用 {stats.enabled}/{stats.total}
          </span>
          <span className="text-[12px] text-[#858b9c]">
            {stats.allEnabled ? '整个工具集可用' : '部分或全部工具已停用'}
          </span>
        </div>
        <UIButton variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          刷新
        </UIButton>
      </div>

      <div className="mt-[16px] overflow-hidden rounded-[14px] border-[0.5px] border-[#e3e7f1] bg-white">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b border-[#eef1f6] text-[12px] text-[#858b9c]">
              <th className="px-[16px] py-[10px] font-normal">工具</th>
              <th className="w-[160px] px-[16px] py-[10px] font-normal">桶</th>
              <th className="w-[120px] px-[16px] py-[10px] font-normal">状态</th>
              <th className="w-[110px] px-[16px] py-[10px] font-normal">启用</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((row) => (
              <tr key={row.id} className="border-b border-[#f4f6fa] last:border-0">
                <td className="px-[16px] py-[12px]">
                  <div className="truncate text-[13px] text-[#18181a]">{row.display_name || row.name}</div>
                  <div className="truncate text-[11px] text-[#858b9c]">{row.name}</div>
                </td>
                <td className="px-[16px] py-[12px] text-[12px] text-[#464c5e]">{row.bucket || '未分桶'}</td>
                <td className="px-[16px] py-[12px] text-[12px]">
                  <span className={row.enabled ? 'text-[#0f9d58]' : 'text-[#858b9c]'}>
                    {row.enabled ? '已启用' : '已停用'}
                  </span>
                </td>
                <td className="px-[16px] py-[12px]">
                  <Switch
                    size="sm"
                    checked={row.enabled}
                    disabled={busyKey === row.id}
                    onCheckedChange={(next) => void toggleOne(row, next)}
                    aria-label={`${row.display_name || row.name} 启用开关`}
                  />
                </td>
              </tr>
            ))}
            {!tools.length && (
              <tr>
                <td colSpan={4} className="px-[16px] py-[28px] text-center text-[12px] text-[#858b9c]">
                  {loading ? '加载中…' : '该工具集下还没有工具（可在工具页点「发现/同步」）'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

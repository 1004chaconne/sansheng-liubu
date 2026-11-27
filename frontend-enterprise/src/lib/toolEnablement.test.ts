import { describe, expect, it, vi } from 'vitest';

import {
  buildToolEnablePayload,
  setGroupEnabled,
  type ToolLike,
} from './toolEnablement';

function tool(partial: Partial<ToolLike>): ToolLike {
  return {
    id: 'tool_1',
    tenant_id: 'tenant_demo',
    name: 'wechat-reader.list_sessions',
    display_name: '列微信会话',
    description: '只读',
    bucket: '微信',
    tool_type: 'mcp',
    method: 'POST',
    url: 'mcp://wechat-reader/list_sessions',
    headers: {},
    auth: {},
    mcp_config: {},
    input_schema: { type: 'object' },
    output_schema: {},
    allowed_skills: [],
    capability_scope: 'general',
    enabled: true,
    ...partial,
  };
}

describe('buildToolEnablePayload', () => {
  it('保留原字段并只改 enabled', () => {
    const row = tool({});
    const payload = buildToolEnablePayload(row, false);
    expect(payload.enabled).toBe(false);
    expect(payload.name).toBe(row.name);
    expect(payload.bucket).toBe('微信');
    expect(payload.url).toBe(row.url);
    expect(payload.tool_type).toBe('mcp');
  });

  it('缺少 mcp_config 时补空对象（后端要求必填）', () => {
    const row = tool({ mcp_config: undefined });
    expect(buildToolEnablePayload(row, true).mcp_config).toEqual({});
  });
});

describe('setGroupEnabled', () => {
  it('逐个调用 putter，并返回成功数量', async () => {
    const putter = vi.fn().mockResolvedValue(undefined);
    const rows = [tool({ id: 'a' }), tool({ id: 'b' }), tool({ id: 'c' })];

    const result = await setGroupEnabled(rows, false, putter);

    expect(putter).toHaveBeenCalledTimes(3);
    expect(putter.mock.calls[0]?.[0]?.enabled).toBe(false);
    expect(result).toEqual({ total: 3, succeeded: 3, failed: [] });
  });

  it('单个失败不影响其它，并汇总失败项', async () => {
    const putter = vi.fn(async (payload: { name: string }) => {
      if (payload.name.endsWith('b')) throw new Error('boom');
    });
    const rows = [
      tool({ id: 'a', name: 'x.a' }),
      tool({ id: 'b', name: 'x.b' }),
      tool({ id: 'c', name: 'x.c' }),
    ];

    const result = await setGroupEnabled(rows, true, putter);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]?.id).toBe('b');
    expect(result.failed[0]?.message).toContain('boom');
  });

  it('空组直接返回，不调用 putter', async () => {
    const putter = vi.fn();
    const result = await setGroupEnabled([], true, putter);
    expect(putter).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, succeeded: 0, failed: [] });
  });
});

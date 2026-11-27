import { api } from '../api/client';

/** 工具页/广场用得到的最小字段集（与后端 ToolRead 对齐） */
export type ToolLike = {
  id: string;
  tenant_id: string;
  name: string;
  display_name?: string | null;
  description?: string | null;
  bucket?: string;
  tool_type: string;
  method: string;
  url: string;
  headers?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  mcp_config?: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  allowed_skills?: string[];
  capability_scope?: string;
  enabled: boolean;
};

export type ToolEnablePayload = {
  tenant_id: string;
  name: string;
  display_name: string | null;
  description: string | null;
  bucket: string;
  tool_type: string;
  method: string;
  url: string;
  headers: Record<string, unknown>;
  auth: Record<string, unknown>;
  mcp_config: Record<string, unknown>;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  allowed_skills: string[];
  capability_scope: string;
  enabled: boolean;
};

/**
 * 由现有工具行构造「只改启用状态」的更新载荷。
 * 后端 PUT /tools/{id} 要求 ToolCreateRequest 的必填字段齐全，缺一个就会 422，
 * 所以这里显式补齐（尤其 mcp_config）。name 不能改（后端会校验）。
 */
export function buildToolEnablePayload(row: ToolLike, enabled: boolean): ToolEnablePayload {
  return {
    tenant_id: row.tenant_id,
    name: row.name,
    display_name: row.display_name ?? null,
    description: row.description ?? null,
    bucket: row.bucket || '未分桶',
    tool_type: row.tool_type,
    method: row.method,
    url: row.url,
    headers: row.headers ?? {},
    auth: row.auth ?? {},
    mcp_config: row.mcp_config ?? {},
    input_schema: row.input_schema ?? {},
    output_schema: row.output_schema ?? {},
    allowed_skills: row.allowed_skills ?? [],
    capability_scope: row.capability_scope ?? 'general',
    enabled,
  };
}

export type ToolPutter = (payload: ToolEnablePayload, row: ToolLike) => Promise<unknown>;

export type GroupEnableResult = {
  total: number;
  succeeded: number;
  failed: { id: string; name: string; message: string }[];
};

/**
 * 组级开关：把一组工具逐个设成同一个 enabled。
 * - 并发 4，59 个工具也在几秒内完成；
 * - 单个失败不中断其它，最后汇总失败项（界面必须显式提示，不能假成功）。
 */
export async function setGroupEnabled(
  rows: ToolLike[],
  enabled: boolean,
  putter: ToolPutter,
  concurrency = 4,
): Promise<GroupEnableResult> {
  const failed: GroupEnableResult['failed'] = [];
  let succeeded = 0;
  let index = 0;

  async function worker() {
    while (index < rows.length) {
      const row = rows[index];
      index += 1;
      try {
        await putter(buildToolEnablePayload(row, enabled), row);
        succeeded += 1;
      } catch (error) {
        failed.push({
          id: row.id,
          name: row.display_name || row.name,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, rows.length) }, () => worker());
  await Promise.all(workers);

  return { total: rows.length, succeeded, failed };
}

/** 默认的写库实现：走平台现有 PUT /tools/{id}（会同步员工绑定状态） */
export function makeToolPutter(agentQuery = ''): ToolPutter {
  return (payload, row) =>
    api.put(`/api/enterprise/tools/${row.id}${agentQuery}`, payload);
}

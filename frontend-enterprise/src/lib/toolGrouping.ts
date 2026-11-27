/** 工具分组与计数（纯函数，便于测试） */

export type GroupableTool = { id: string; bucket?: string; enabled?: boolean };

export type ToolBucketGroup<T extends GroupableTool> = {
  bucket: string;
  tools: T[];
  total: number;
  enabled: number;
  allEnabled: boolean;
};

/**
 * 按 bucket（工具集）分组，保持首次出现顺序——工具页/广场都用它，
 * 保证「同一个桶在两处顺序一致」，不会跳来跳去。
 */
export function groupToolsByBucket<T extends GroupableTool>(rows: T[]): ToolBucketGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = (row.bucket || '').trim() || '未分桶';
    if (!map.has(bucket)) {
      map.set(bucket, []);
      order.push(bucket);
    }
    map.get(bucket)!.push(row);
  }
  return order.map((bucket) => {
    const tools = map.get(bucket)!;
    const counts = countEnabled(tools);
    return { bucket, tools, ...counts };
  });
}

export function countEnabled(rows: GroupableTool[]): {
  total: number;
  enabled: number;
  allEnabled: boolean;
} {
  const total = rows.length;
  const enabled = rows.filter((row) => row.enabled === true).length;
  return { total, enabled, allEnabled: total > 0 && enabled === total };
}

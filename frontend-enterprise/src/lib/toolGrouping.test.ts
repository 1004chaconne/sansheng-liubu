import { describe, expect, it } from 'vitest';

import { countEnabled, groupToolsByBucket } from './toolGrouping';

type Row = { id: string; bucket?: string; enabled: boolean };

describe('groupToolsByBucket', () => {
  it('按桶分组并保持桶的首次出现顺序', () => {
    const rows: Row[] = [
      { id: '1', bucket: '微信', enabled: true },
      { id: '2', bucket: '桌面操作（RPA）', enabled: false },
      { id: '3', bucket: '微信', enabled: false },
    ];
    const groups = groupToolsByBucket(rows);
    expect(groups.map((g) => g.bucket)).toEqual(['微信', '桌面操作（RPA）']);
    expect(groups[0]?.tools.map((t) => t.id)).toEqual(['1', '3']);
  });

  it('缺少 bucket 归入「未分桶」', () => {
    const groups = groupToolsByBucket([{ id: 'x', enabled: true }]);
    expect(groups[0]?.bucket).toBe('未分桶');
  });

  it('空输入返回空数组', () => {
    expect(groupToolsByBucket([])).toEqual([]);
  });
});

describe('countEnabled', () => {
  it('统计启用数与总数', () => {
    const rows: Row[] = [
      { id: '1', enabled: true },
      { id: '2', enabled: false },
      { id: '3', enabled: true },
    ];
    expect(countEnabled(rows)).toEqual({ total: 3, enabled: 2, allEnabled: false });
  });

  it('空数组时 allEnabled 为 false（避免空组显示为已开）', () => {
    expect(countEnabled([])).toEqual({ total: 0, enabled: 0, allEnabled: false });
  });
});

/**
 * 六部归属：把员工映射到"吏户礼兵刑工"。
 *
 * 🔴 这份映射是**唯一真相源**：宋官署主题下的名臣头像（`EmployeeAvatar`）与
 * 对话框旁的角标（`Composer`）都从这里取关键词，不许各写一套。
 * 分成两处写的后果是「角标写着中书、头像画着兵部」——这种错位没人会去查，
 * 但每个人都会觉得别扭。
 *
 * 划分口径（按货代实际职能，不是照搬历史官职）：
 * - 吏部：人事、招聘、考绩、培训
 * - 户部：财务、商务、采购、报价、结算、成本
 * - 礼部：行政、市场、销售、渠道、客服、知识
 * - 兵部：单证、项目、调度、物流、订舱、报关、运输
 * - 刑部：法务、合规、审计、风控、合同
 * - 工部：IT、研发、技术、数据、运维、工程
 */

export type Ministry = '吏部' | '户部' | '礼部' | '兵部' | '刑部' | '工部';

export const MINISTRY_RULES: Array<{ ministry: Ministry; keys: string[] }> = [
  { ministry: '吏部', keys: ['人事', '招聘', '考绩', '培训'] },
  { ministry: '户部', keys: ['财务', '商务', '采购', '报价', '结算', '成本'] },
  { ministry: '礼部', keys: ['行政', '市场', '销售', '渠道', '客服', '知识'] },
  { ministry: '兵部', keys: ['单证', '项目', '调度', '物流', '订舱', '报关', '运输'] },
  { ministry: '刑部', keys: ['法务', '合规', '审计', '风控', '合同'] },
  { ministry: '工部', keys: ['IT', '研发', '技术', '数据', '运维', '工程'] },
];

/** 按员工名 + 描述判断属于哪一部；判不出返回 null（此时头像也不会换成名臣，两边一致）。 */
export function ministryOf(text?: string | null): Ministry | null {
  const haystack = (text || '').trim();
  if (!haystack) return null;
  const hit = MINISTRY_RULES.find((rule) => rule.keys.some((k) => haystack.includes(k)));
  return hit ? hit.ministry : null;
}

/**
 * 角标文案：`兵部 · 单证员`。
 * 判不出部别时只显示岗位——**不硬塞一个部**，因为头像此时也是普通形象，
 * 硬塞会让两者对不上。
 */
export function departmentLabel(agentText?: string | null, roleName?: string | null): string {
  const role = (roleName || '').trim();
  const ministry = ministryOf(agentText);
  if (ministry && role) return `${ministry} · ${role}`;
  if (ministry) return ministry;
  return role;
}

import AppHeader from '@/components/AppHeader';
import { cn } from '@/lib/utils';
import type { EnterpriseAuthUser } from '../auth';

type Props = {
  currentUser?: EnterpriseAuthUser | null;
  onLogout?: () => void;
};

const LAYERS = [
  {
    tag: '脑',
    where: '就是这个平台（三省六部）',
    what: '判断、决策、编排、验收',
    note: '想清楚该怎么做，产出方案与工单',
  },
  {
    tag: '手',
    where: '微信副驾 / 浏览器插件 / 邮件',
    what: '收发消息、查外部系统、发出去',
    note: '只执行，不自己做判断',
  },
  {
    tag: '记忆',
    where: '鑫淼 + 平台知识库',
    what: '订单、运价、费用、规则、手册',
    note: '一处权威，别处只引用',
  },
];

const ROUTES = [
  {
    kind: '查事实',
    example: '这票到哪了、今天什么价',
    who: '系统直接查',
    delay: '几秒',
  },
  {
    kind: '按规则判',
    example: '这个价还能不能报、信息够不够',
    who: '门下省（校验）',
    delay: '几秒',
  },
  {
    kind: '要跑流程',
    example: '缺价要找代理、报价要组方案',
    who: '中书省起草 + 尚书省推进',
    delay: '几分钟到几小时',
  },
  {
    kind: '要担责任',
    example: '折扣、保舱、倒签、赔偿',
    who: '人',
    delay: '不自动',
  },
];

const WAITS = [
  { state: '等代理回价', who: '代理', limit: '约 2 小时', then: '催办，再超时换人或转你' },
  { state: '等客户补资料', who: '客户', limit: '约 24 小时', then: '提醒一次，三天后挂起' },
  { state: '等内部口径', who: '同事', limit: '约 30 分钟', then: '升级给部门负责人' },
  { state: '等你审批', who: '你', limit: '按金额分级', then: '超时上报上一级' },
];

const FAQ = [
  {
    q: '为什么它不直接发微信给我？',
    a: '有一条硬规矩：AI 零发送。所有对外消息都要经过人点一次确认。这不是没做，是故意不做——发错一条价，比不发要贵得多。',
  },
  {
    q: '为什么它有时候说"要确认"，不直接给个价？',
    a: '两种原因：一是查到的价已经过期（船开走价就作废），二是它没有可靠来源。宁可说"要确认"，也不给一个看起来合理但没依据的数。',
  },
  {
    q: '为什么它敢说"查不到"？',
    a: '因为它被要求分清三种"查不到"：没接上数据源、表里没这个仓、确实没有有效报价。这三种该说的话完全不同，混成一句"查不到"就没法排查。',
  },
  {
    q: '为什么不能全自动，非要我点一下？',
    a: '涉及钱和责任的环节留人工，是这套系统的设计前提。数字员工替代的是"动作"，不是"责任"。',
  },
  {
    q: '它卡住了是不是坏了？',
    a: '大多数情况是"在等"。等代理回价、等客户补资料，这些都在上面的等待表里，有明确时限和催办规则。真正的故障会显示错误原因。',
  },
];

function Section({
  index,
  title,
  desc,
  children,
}: {
  index: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-tertiary bg-background-primary p-5">
      <div className="flex items-baseline gap-3">
        <span className="text-xs font-medium tabular-nums text-text-tertiary">{index}</span>
        <h2 className="text-[15px] font-medium text-text-primary">{title}</h2>
      </div>
      {desc ? <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{desc}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function HandbookPage({ currentUser, onLogout }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AppHeader onLogout={onLogout} userName={currentUser?.username} title="使用手册" />
      <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="rounded-xl border border-border-tertiary bg-background-secondary p-5">
            <h1 className="text-[17px] font-medium text-text-primary">这套系统是怎么运转的</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
              一句话：<span className="text-text-primary">它像公司一样分工。</span>
              有负责想和判的、有负责跑的、有负责记的。想清楚这套分工，你就能判断
              「这事该谁管、它为什么卡住、我该做什么」。
            </p>
          </div>

          <Section
            index="01"
            title="三个角色：脑、手、记忆"
            desc="任何时候出问题，先问一句：这是脑子判错了、手没执行，还是记忆里的数据不对。这三件事的修法完全不同。"
          >
            <div className="flex flex-col gap-2">
              {LAYERS.map((l) => (
                <div
                  key={l.tag}
                  className="flex flex-col gap-1 rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3 md:flex-row md:items-center md:gap-4"
                >
                  <span className="w-10 shrink-0 text-[13px] font-medium text-text-primary">{l.tag}</span>
                  <span className="w-44 shrink-0 text-[13px] text-text-secondary">{l.where}</span>
                  <span className="w-48 shrink-0 text-[13px] text-text-secondary">{l.what}</span>
                  <span className="text-[12px] text-text-tertiary">{l.note}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section
            index="02"
            title="一件事进来，先归类再看谁管"
            desc="不需要每次讨论「这个该谁做」。四类事情，归属和时效都是定死的。"
          >
            <div className="overflow-hidden rounded-lg border border-border-tertiary">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-background-secondary text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">事情类型</th>
                    <th className="px-3 py-2 font-medium">例子</th>
                    <th className="px-3 py-2 font-medium">谁负责</th>
                    <th className="px-3 py-2 font-medium">多久有结果</th>
                  </tr>
                </thead>
                <tbody className="text-text-primary">
                  {ROUTES.map((r) => (
                    <tr key={r.kind} className="border-t border-border-tertiary">
                      <td className="px-3 py-2 font-medium">{r.kind}</td>
                      <td className="px-3 py-2 text-text-secondary">{r.example}</td>
                      <td className="px-3 py-2 text-text-secondary">{r.who}</td>
                      <td className="px-3 py-2 tabular-nums text-text-secondary">{r.delay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            index="03"
            title="三省：起草、把关、派活"
            desc="对应到你的日常：有人给方案，有人挑毛病，有人盯着进度。三者不能是同一个人。"
          >
            <div className="grid gap-2 md:grid-cols-3">
              {[
                { n: '中书省', d: '起草', x: '出报价方案、询价单、回复草稿', cls: 'text-text-primary' },
                { n: '门下省', d: '把关', x: '逐条校验，能否决退回', cls: 'text-text-primary' },
                { n: '尚书省', d: '派活', x: '派单、催办、推进、收口', cls: 'text-text-primary' },
              ].map((s) => (
                <div key={s.n} className="rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3">
                  <div className={cn('text-[13px] font-medium', s.cls)}>
                    {s.n}
                    <span className="ml-2 text-[12px] font-normal text-text-tertiary">{s.d}</span>
                  </div>
                  <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">{s.x}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section
            index="04"
            title="它「卡住」多半是在等，不是坏了"
            desc="等待是正常状态，不是失败。每种等待都有时限，到点会自动催办或升级。"
          >
            <div className="overflow-hidden rounded-lg border border-border-tertiary">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-background-secondary text-text-secondary">
                  <tr>
                    <th className="px-3 py-2 font-medium">在等什么</th>
                    <th className="px-3 py-2 font-medium">等谁</th>
                    <th className="px-3 py-2 font-medium">时限</th>
                    <th className="px-3 py-2 font-medium">超时后</th>
                  </tr>
                </thead>
                <tbody className="text-text-primary">
                  {WAITS.map((w) => (
                    <tr key={w.state} className="border-t border-border-tertiary">
                      <td className="px-3 py-2 font-medium">{w.state}</td>
                      <td className="px-3 py-2 text-text-secondary">{w.who}</td>
                      <td className="px-3 py-2 tabular-nums text-text-secondary">{w.limit}</td>
                      <td className="px-3 py-2 text-text-secondary">{w.then}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-text-tertiary">
              注：时限是初始值，会按实际情况调整。你觉得某个等待太长，直接说，改配置就行。
            </p>
          </Section>

          <Section
            index="05"
            title="为什么总要你点一下"
            desc="有两条硬红线，不是能力不足，是故意不做。"
          >
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3">
                <div className="text-[13px] font-medium text-text-primary">AI 零发送</div>
                <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                  任何对外消息都要人确认后才发。发错一条价，比不发贵得多。
                </div>
              </div>
              <div className="rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3">
                <div className="text-[13px] font-medium text-text-primary">钱不进模型</div>
                <div className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                  加价和总价由固定的规则算，不让 AI 拍数字。AI 可以把方案组好，但金额的算法是写死的。
                </div>
              </div>
            </div>
          </Section>

          <Section index="06" title="常见疑问" desc="这些都是同事真实问过的。">
            <div className="flex flex-col gap-2">
              {FAQ.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-lg border border-border-tertiary bg-background-secondary px-4 py-3"
                >
                  <summary className="cursor-pointer list-none text-[13px] font-medium text-text-primary">
                    <span className="mr-2 text-text-tertiary transition-transform group-open:rotate-90 inline-block">
                      ›
                    </span>
                    {f.q}
                  </summary>
                  <p className="mt-2 pl-4 text-[12px] leading-relaxed text-text-secondary">{f.a}</p>
                </details>
              ))}
            </div>
          </Section>

          <div className="rounded-xl border border-dashed border-border-tertiary px-5 py-4">
            <div className="text-[13px] font-medium text-text-primary">这页还会继续长</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-text-secondary">
              后续会按「怎么建一个员工」「怎么写一条 SOP」「怎么看执行记录」逐节补进来。
              你遇到看不懂的地方，直接说，比猜快。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

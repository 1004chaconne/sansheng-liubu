import type { CSSProperties } from 'react';

import {
  DEFAULT_AVATAR_PRESET,
  employeeAvatarImage,
  employeeProfile,
  type EmployeeProfile,
} from '../employee';
import type { AgentProfileRead } from '../types';
import { useEmployeeAvatar } from '../hooks/useEmployeeAvatar';
import { useTheme } from '../lib/theme';
import { ministryOf, type Ministry } from '../lib/six-ministries';
import ministerPersonnel from '../assets/ministers/minister-personnel.png';
import ministerRevenue from '../assets/ministers/minister-revenue.png';
import ministerRites from '../assets/ministers/minister-rites.png';
import ministerWar from '../assets/ministers/minister-war.png';
import ministerJustice from '../assets/ministers/minister-justice.png';
import ministerWorks from '../assets/ministers/minister-works.png';

/**
 * 宋官署主题下的名臣形象：按职能把员工换成对应的人物。
 * 吏部张居正 / 户部萧何 / 礼部孔子 / 兵部诸葛亮 / 刑部包拯 / 工部沈括
 */
const MINISTER_IMAGE: Record<Ministry, string> = {
  吏部: ministerPersonnel,
  户部: ministerRevenue,
  礼部: ministerRites,
  兵部: ministerWar,
  刑部: ministerJustice,
  工部: ministerWorks,
};

function ministerFor(agent?: AgentProfileRead | null): string | null {
  if (!agent) return null;
  // 🔴 关键词只在 six-ministries.ts 定义一份，这里不再复制，避免角标与头像错位
  const ministry = ministryOf(`${agent.name} ${agent.description || ''}`);
  return ministry ? MINISTER_IMAGE[ministry] : null;
}

type AvatarProfile = Pick<EmployeeProfile, 'avatarKind' | 'avatarImage' | 'avatarPreset' | 'avatarText' | 'avatarTone'>;

type EmployeeAvatarProps = {
  agent?: AgentProfileRead | null;
  /** Pre-resolved profile. When omitted it is derived from `agent`. */
  profile?: AvatarProfile;
  /** Square shorthand for width/height (px). Used when width/height are not provided. */
  size?: number;
  /** Explicit width in px. Falls back to `size`. */
  width?: number;
  /** Explicit height in px. Falls back to `size`. */
  height?: number;
  /** Border radius override (px or any CSS length). */
  radius?: number | string;
  /** How the image fills the box. `cover` fills the frame without distortion. */
  fit?: CSSProperties['objectFit'];
  /** Alignment of the image within the box, e.g. `center bottom`. */
  objectPosition?: CSSProperties['objectPosition'];
  className?: string;
  style?: CSSProperties;
};

export default function EmployeeAvatar({
  agent,
  profile: profileOverride,
  size = 54,
  width,
  height,
  radius,
  fit = 'cover',
  objectPosition = 'center',
  className = '',
  style,
}: EmployeeAvatarProps) {
  const profile = profileOverride || employeeProfile(agent);
  const theme = useTheme();
  const presetSource = useEmployeeAvatar(employeeAvatarImage(profile));
  // 宋官署主题下换成名臣形象；显式传入 profile（如编辑预览）时不替换
  const ministerSource = theme === 'amber' && !profileOverride ? ministerFor(agent) : null;
  const source = ministerSource || presetSource;

  const className_ = [
    'employee-avatar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const boxStyle: CSSProperties = {
    width: width ?? size,
    height: height ?? size,
    ...(radius != null ? { borderRadius: radius } : null),
    ...style,
  };

  // Lock the image to the box at any width/height: `cover` fills without distortion,
  // while resetting transform/max-width neutralizes per-context overrides.
  const imageStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    maxWidth: 'none',
    objectFit: fit,
    objectPosition,
    transform: 'none',
    // 名臣图是白底，乘算混合让白底融进纸色，只留线条与色块
    ...(ministerSource ? { mixBlendMode: 'multiply' as const } : null),
  };

  return (
    <span
      className={className_}
      style={boxStyle}
      aria-label={`${profile.avatarText || '员'}员工头像`}
    >
      <img src={source || employeeAvatarImage({ ...profile, avatarKind: 'preset' })} alt="" style={imageStyle} />
    </span>
  );
}

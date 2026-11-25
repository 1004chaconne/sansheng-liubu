export type ThemeKey = 'amber' | 'azure';

export const THEMES: { key: ThemeKey; label: string; hint: string; swatch: string; ring: string }[] = [
  { key: 'amber', label: '宋官署', hint: '米纸 · 墨 · 朱砂', swatch: '#f1e4cd', ring: '#a32b1e' },
  { key: 'azure', label: '青白', hint: '浅灰 · 白 · 青', swatch: '#f4f6f7', ring: '#0f766e' },
];

const STORAGE_KEY = 'sansheng_theme';

export function applyTheme(theme: ThemeKey): void {
  const root = document.documentElement;
  if (theme === 'amber') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 隐私模式下不可写，忽略即可
  }
}

export function readTheme(): ThemeKey {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'azure' || saved === 'amber') return saved;
  } catch {
    // ignore
  }
  return 'amber';
}

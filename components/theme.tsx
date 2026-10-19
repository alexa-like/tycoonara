'use client';
import { useSyncExternalStore } from 'react';
function subscribe(callback: () => void) { window.addEventListener('themechange',callback); return () => window.removeEventListener('themechange',callback); }
const snapshot = () => document.documentElement.dataset.theme === 'dark';
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe,snapshot,() => false);
  function toggle() { const value = dark ? 'light' : 'dark'; document.documentElement.dataset.theme = value; try { localStorage.setItem('tycoonara-theme',value); } catch {} window.dispatchEvent(new Event('themechange')); }
  return <button onClick={toggle} aria-label={dark ? 'Use light mode' : 'Use dark mode'} aria-pressed={dark} className="theme">{dark ? '☀ Light' : '☾ Dark'}</button>;
}

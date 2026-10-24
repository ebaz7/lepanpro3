import { Capacitor } from '@capacitor/core';

export type AppPlatform = 'desktop' | 'android' | 'web';

/**
 * Checks if the current app environment is running inside Tauri (Windows / Mac / Linux desktop).
 */
export const isTauriDesktop = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI__ ||
    (window as any).__TAURI_IPC__ ||
    (window as any).__TAURI_METADATA__ ||
    navigator.userAgent.toLowerCase().includes('tauri')
  );
};

/**
 * Checks if the current app environment is running on mobile (Android / iOS Capacitor).
 */
export const isMobileApp = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform() || /android|iphone|ipad|ipod/i.test(navigator.userAgent);
  } catch {
    return false;
  }
};

/**
 * Checks if running as standard web browser app (not Tauri and not mobile container).
 */
export const isWebApp = (): boolean => {
  return !isTauriDesktop() && !isMobileApp();
};

/**
 * Get current platform key
 */
export const getPlatform = (): AppPlatform => {
  if (isTauriDesktop()) return 'desktop';
  if (isMobileApp()) return 'android';
  return 'web';
};

/**
 * Human-readable Persian platform badge title
 */
export const getPlatformBadgeLabel = (): { title: string; subtitle: string; iconType: 'desktop' | 'mobile' | 'web'; colorClass: string } => {
  if (isTauriDesktop()) {
    return {
      title: 'نسخه دسکتاپ ویندوز',
      subtitle: 'دلکام کلاینت بومی',
      iconType: 'desktop',
      colorClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    };
  }
  if (isMobileApp()) {
    return {
      title: 'نسخه اندروید',
      subtitle: 'اپلیکیشن موبایل',
      iconType: 'mobile',
      colorClass: 'text-purple-400 border-purple-500/30 bg-purple-500/10'
    };
  }
  return {
    title: 'نسخه تحت وب',
    subtitle: 'مرورگر ابری',
    iconType: 'web',
    colorClass: 'text-amber-400 border-amber-500/30 bg-amber-500/10'
  };
};

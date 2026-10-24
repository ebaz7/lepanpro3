import { getEffectiveApiUrl } from './apiService';
import { isTauriDesktop, isMobileApp, isWebApp } from '../utils/platformDetection';

export interface AppVersionInfo {
  version: string;
  buildNumber: string;
  title?: string;
  releaseNotes?: string;
  timestamp?: number;
  downloadUrl?: string;
  androidDownloadUrl?: string;
}

// Current client build embedded in the bundle
export const CURRENT_CLIENT_BUILD: AppVersionInfo = {
  version: '1.3.2',
  buildNumber: '20260901.103',
  title: 'نسخه جاری',
  releaseNotes: 'نسخه پایدار سامانه مالی و بازرگانی'
};

// Helper: compare semantic versions (e.g. "1.3.2" vs "1.3.3")
export function compareSemVer(v1: string, v2: string): number {
  const p1 = (v1 || '').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '').replace(/[^0-9.]/g, '').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// Detect if running inside Android Capacitor Native Shell
export function isCapacitorAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as any;
  return Boolean(
    (win.Capacitor?.isNativePlatform?.() && win.Capacitor?.getPlatform?.() === 'android') ||
    (win.Capacitor?.platform === 'android') ||
    (isMobileApp() && /android/i.test(navigator.userAgent))
  );
}

// Dismiss an update so it does not keep showing up in current session
export function dismissUpdate(serverInfo?: AppVersionInfo | null): void {
  if (typeof window === 'undefined') return;
  const serverVer = serverInfo?.version || '';
  const serverBuild = serverInfo?.buildNumber || serverVer;
  const serverTimestamp = Number(serverInfo?.timestamp) || 0;
  const sig = `${serverVer}_${serverBuild}_${serverTimestamp}`;
  try {
    sessionStorage.setItem('dismissed_update_sig', sig);
    localStorage.setItem('dismissed_update_sig', sig);
  } catch (_) {}
}

// Check for updates by querying /api/version and /api/desktop/check-update
export async function checkServerUpdate(): Promise<{ hasUpdate: boolean; serverInfo: AppVersionInfo | null }> {
  try {
    const versionApiUrl = getEffectiveApiUrl(`/api/version?t=${Date.now()}`);
    let data: AppVersionInfo | null = null;
    let desktopDownloadUrl = '';
    let androidDownloadUrl = '';

    try {
      const res = await fetch(versionApiUrl, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        data = await res.json();
        if (data?.androidDownloadUrl) {
          androidDownloadUrl = data.androidDownloadUrl;
        }
      }
    } catch (e) {
      console.debug('Failed fetching /api/version:', e);
    }

    // If on Desktop, also query desktop specific endpoint
    const isDesktop = isTauriDesktop();
    if (isDesktop) {
      try {
        const desktopApiUrl = getEffectiveApiUrl(`/api/desktop/check-update?t=${Date.now()}`);
        const desktopRes = await fetch(desktopApiUrl, {
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (desktopRes.ok) {
          const desktopData = await desktopRes.json();
          if (desktopData) {
            desktopDownloadUrl = desktopData.directDownloadUrl || desktopData.updateUrl || '';
            if (!data || !data.version) {
              data = {
                version: desktopData.latestVersion || '1.3.2',
                buildNumber: desktopData.latestVersion || '20260901.103',
                releaseNotes: desktopData.releaseNotes || 'به‌روزرسانی نرم‌افزار دسکتاپ',
                title: 'نسخه جدید سامانه'
              };
            }
          }
        }
      } catch (e) {
        console.debug('Failed fetching /api/desktop/check-update:', e);
      }
    }

    if (!data || (!data.version && !data.buildNumber)) {
      return { hasUpdate: false, serverInfo: null };
    }

    const defaultAndroidUrl = getEffectiveApiUrl('/downloads/dlkam-android-latest.apk');
    const defaultDesktopUrl = getEffectiveApiUrl('/downloads/dlkam-desktop-setup.msi');

    data.androidDownloadUrl = androidDownloadUrl || data.androidDownloadUrl || defaultAndroidUrl;

    if (isCapacitorAndroid()) {
      data.downloadUrl = data.androidDownloadUrl;
    } else if (isDesktop) {
      data.downloadUrl = data.downloadUrl || desktopDownloadUrl || defaultDesktopUrl;
    } else {
      // Pure Web: no file download URL needed, update is web-based reload/cache clear
      data.downloadUrl = '';
    }

    const serverBuild = data.buildNumber || data.version;
    const serverVer = data.version || data.buildNumber;
    const serverTimestamp = Number(data.timestamp) || 0;

    if (typeof window === 'undefined') {
      return { hasUpdate: false, serverInfo: data };
    }

    // Compare server version against client embedded version and baseline/applied signatures
    const clientBuild = CURRENT_CLIENT_BUILD.buildNumber;
    const clientVer = CURRENT_CLIENT_BUILD.version;
    const currentServerSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;

    // 1. Check if user dismissed this exact update in current session
    const dismissedSig = sessionStorage.getItem('dismissed_update_sig') || localStorage.getItem('dismissed_update_sig');
    if (dismissedSig && dismissedSig === currentServerSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    // 2. Check if user already applied this exact server release signature
    const lastAppliedSig = localStorage.getItem('last_applied_release_sig');
    if (lastAppliedSig && lastAppliedSig === currentServerSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    // 3. Check if this exact server version and build were already applied
    const appliedVer = localStorage.getItem('applied_server_version');
    const appliedBuild = localStorage.getItem('applied_server_build');
    if (appliedVer === serverVer && appliedBuild === serverBuild) {
      return { hasUpdate: false, serverInfo: data };
    }

    // 4. Compare version semantically
    const semVerComp = compareSemVer(serverVer, clientVer);
    const baselineBuild = localStorage.getItem('baseline_server_build');
    const baselineTimestamp = Number(localStorage.getItem('baseline_server_timestamp')) || 0;

    // If server version is strictly older than client bundle version, no update
    if (semVerComp < 0) {
      return { hasUpdate: false, serverInfo: data };
    }

    // If server version is strictly newer than client bundle version
    if (semVerComp > 0) {
      // If user already applied this server build, no update
      if (baselineBuild && baselineBuild === serverBuild) {
        return { hasUpdate: false, serverInfo: data };
      }
      return { hasUpdate: true, serverInfo: data };
    }

    // When semVer is equal (e.g. 1.3.2 == 1.3.2), check build number or timestamp
    if (serverBuild !== clientBuild && baselineBuild !== serverBuild) {
      if (serverTimestamp > 0 && baselineTimestamp > 0) {
        if (serverTimestamp > baselineTimestamp) {
          return { hasUpdate: true, serverInfo: data };
        }
      } else if (serverBuild > clientBuild) {
        return { hasUpdate: true, serverInfo: data };
      }
    }

    return {
      hasUpdate: false,
      serverInfo: data
    };
  } catch (error) {
    console.debug('Update check failed (offline or network error):', error);
    return { hasUpdate: false, serverInfo: null };
  }
}

// Publish a new update to all clients
export async function publishApplicationUpdate(payload: {
  version: string;
  title?: string;
  releaseNotes?: string;
  sendToBots?: boolean;
}): Promise<{ success: boolean; data?: AppVersionInfo; error?: string }> {
  try {
    const publishUrl = getEffectiveApiUrl('/api/version/publish');
    const res = await fetch(publishUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'خطا در انتشار به‌روزرسانی' };
    }

    // Notify window components immediately and reset baseline so clients detect it as new
    if (typeof window !== 'undefined') {
      localStorage.removeItem('last_applied_release_sig');
      localStorage.removeItem('applied_server_version');
      localStorage.removeItem('applied_server_build');
      sessionStorage.removeItem('dismissed_update_sig');
      localStorage.removeItem('dismissed_update_sig');
      localStorage.setItem('baseline_server_build', 'old_version_baseline');
      localStorage.setItem('baseline_server_timestamp', '0');
      window.dispatchEvent(new CustomEvent('app:update-published', { detail: data }));
    }

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message || 'خطا در برقراری ارتباط با سرور' };
  }
}

// Apply update: clear caches, instruct SW to skip waiting, download APK if Android, and reload
export async function applyApplicationUpdate(serverInfo?: AppVersionInfo | null): Promise<void> {
  const isAndroid = isCapacitorAndroid();
  const isDesktop = isTauriDesktop();
  const isWeb = !isAndroid && !isDesktop;

  try {
    // 1. Send automated backup to bots asynchronously with strict 1.5s timeout (never hang the update)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const backupUrl = getEffectiveApiUrl('/api/backups/send-to-bot');
      fetch(backupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: `پشتیبان خودکار ${isAndroid ? 'اندروید' : isDesktop ? 'دسکتاپ' : 'تحت‌وب'} قبل از بروزرسانی به نسخه ${serverInfo?.version || serverInfo?.buildNumber || 'جدید'}`
        }),
        signal: controller.signal
      }).catch(() => {}).finally(() => clearTimeout(timeoutId));
    } catch (_) {}

    // 2. Mark update signature immediately in localStorage
    if (serverInfo) {
      const serverBuild = serverInfo.buildNumber || serverInfo.version;
      const serverVer = serverInfo.version || serverBuild;
      const serverTimestamp = Number(serverInfo.timestamp) || 0;
      const serverSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;
      localStorage.setItem('last_applied_release_sig', serverSig);
      localStorage.setItem('applied_server_version', serverVer);
      localStorage.setItem('applied_server_build', serverBuild);
      localStorage.setItem('baseline_server_build', serverBuild);
      localStorage.setItem('baseline_server_timestamp', serverTimestamp.toString());
      sessionStorage.removeItem('dismissed_update_sig');
      localStorage.removeItem('dismissed_update_sig');
    }

    // 3. Android platform: Trigger direct download/installation of APK
    if (isAndroid) {
      const apkUrl = serverInfo?.androidDownloadUrl || getEffectiveApiUrl('/downloads/dlkam-android-latest.apk');
      try {
        window.open(apkUrl, '_system');
        const link = document.createElement('a');
        link.href = apkUrl;
        link.target = '_blank';
        link.download = `dlkam-android-v${serverInfo?.version || 'latest'}.apk`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        window.open(apkUrl, '_blank');
      }
      return;
    }

    // 4. Desktop Tauri platform: trigger native updater or installer download
    if (isDesktop) {
      const win = window as any;
      if (win.__TAURI__?.updater?.installUpdate) {
        try {
          await win.__TAURI__.updater.installUpdate();
          if (win.__TAURI__?.process?.relaunch) {
            await win.__TAURI__.process.relaunch();
            return;
          }
        } catch (e) {
          console.warn('Tauri updater failed, checking desktop download URL:', e);
        }
      }

      if (serverInfo?.downloadUrl) {
        const link = document.createElement('a');
        link.href = serverInfo.downloadUrl;
        link.target = '_blank';
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }

    // 5. Web Browser Platform: Purge caches, instruct ServiceWorker, and hard-refresh
    if (isWeb) {
      // Clear CacheStorage (excluding login session and shown notifications)
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys.map(key => {
              if (key !== 'auth-session-v1' && key !== 'shown-notifications-v1') {
                return caches.delete(key);
              }
              return Promise.resolve(true);
            })
          );
        } catch (e) {
          console.warn('Failed clearing caches:', e);
        }
      }

      // Tell Service Worker to skip waiting and force update
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            try {
              await reg.update();
            } catch (_) {}
          }
        } catch (_) {}
      }
    }
  } catch (e) {
    console.error('Error during applyApplicationUpdate:', e);
  } finally {
    // For Web, perform a clean hard reload with cache-buster parameter
    if (!isAndroid) {
      setTimeout(() => {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(`${cleanUrl}?v=${Date.now()}`);
      }, 300);
    }
  }
}

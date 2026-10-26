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
  version: '1.0.6',
  buildNumber: '10006',
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

// Dismiss an update so it does not keep showing up in current session only
export function dismissUpdate(serverInfo?: AppVersionInfo | null): void {
  if (typeof window === 'undefined') return;
  const serverVer = serverInfo?.version || '';
  const serverBuild = serverInfo?.buildNumber || serverVer;
  const serverTimestamp = Number(serverInfo?.timestamp) || 0;
  const sig = `${serverVer}_${serverBuild}_${serverTimestamp}`;
  try {
    sessionStorage.setItem('dismissed_update_sig', sig);
  } catch (_) {}
}

// Get native client version asynchronously if running on Tauri or Android Capacitor
export async function getNativeClientVersion(): Promise<{ version: string; buildNumber: string }> {
  if (typeof window === 'undefined') {
    return { version: CURRENT_CLIENT_BUILD.version, buildNumber: CURRENT_CLIENT_BUILD.buildNumber };
  }

  const win = window as any;

  // 1. Check Tauri app.getVersion()
  try {
    if (win.__TAURI__?.app?.getVersion) {
      const ver = await win.__TAURI__.app.getVersion();
      if (ver) {
        const bestVer = compareSemVer(CURRENT_CLIENT_BUILD.version, ver) > 0 ? CURRENT_CLIENT_BUILD.version : ver;
        return { version: bestVer, buildNumber: CURRENT_CLIENT_BUILD.buildNumber || bestVer };
      }
    }
  } catch (_) {}

  // 2. Check Capacitor App.getInfo()
  try {
    if (win.Capacitor?.Plugins?.App?.getInfo) {
      const info = await win.Capacitor.Plugins.App.getInfo();
      if (info?.version) {
        const bestVer = compareSemVer(CURRENT_CLIENT_BUILD.version, info.version) > 0 ? CURRENT_CLIENT_BUILD.version : info.version;
        return { version: bestVer, buildNumber: String(info.build || CURRENT_CLIENT_BUILD.buildNumber || bestVer) };
      }
    }
  } catch (_) {}

  return { version: CURRENT_CLIENT_BUILD.version, buildNumber: CURRENT_CLIENT_BUILD.buildNumber };
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
                version: desktopData.latestVersion || '',
                buildNumber: desktopData.latestVersion || '',
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

    // Determine actual native client version (Tauri, Capacitor, or Web baseline)
    const nativeClient = await getNativeClientVersion();
    const clientBuild = nativeClient.buildNumber;
    const clientVer = nativeClient.version;
    const currentServerSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;

    const isAndroid = isCapacitorAndroid();

    // 1. Check if user dismissed this exact update in current session
    const dismissedSig = sessionStorage.getItem('dismissed_update_sig');
    if (dismissedSig && dismissedSig === currentServerSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    // 2. Compare version semantically against actual installed/bundled version
    const semVerComp = compareSemVer(serverVer, clientVer);

    // On Native Android or Tauri Desktop, if server version is strictly higher than installed app version,
    // ALWAYS notify the user (until they actually install the new APK/MSI which updates clientVer)
    if ((isAndroid || isDesktop) && semVerComp > 0) {
      return { hasUpdate: true, serverInfo: data };
    }

    // 3. For Web (or same-version rebuilds), check if user already applied this exact server release signature
    const lastAppliedSig = localStorage.getItem('last_applied_release_sig');
    if (lastAppliedSig && lastAppliedSig === currentServerSig) {
      return { hasUpdate: false, serverInfo: data };
    }

    const appliedVer = localStorage.getItem('applied_server_version');
    const appliedBuild = localStorage.getItem('applied_server_build');
    if (!isAndroid && !isDesktop && appliedVer === serverVer && appliedBuild === serverBuild) {
      return { hasUpdate: false, serverInfo: data };
    }

    const baselineBuild = localStorage.getItem('baseline_server_build');
    const baselineTimestamp = Number(localStorage.getItem('baseline_server_timestamp')) || 0;

    // If server version is strictly older than client version, no update
    if (semVerComp < 0) {
      return { hasUpdate: false, serverInfo: data };
    }

    // If server version is strictly newer than client version
    if (semVerComp > 0) {
      return { hasUpdate: true, serverInfo: data };
    }

    // When semVer is equal (e.g. 1.0.0 == 1.0.0), check build number or timestamp if server was updated
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

// Apply update: clear caches, instruct SW to skip waiting, download APK if Android, download MSI if Desktop
export async function applyApplicationUpdate(serverInfo?: AppVersionInfo | null): Promise<void> {
  const isAndroid = isCapacitorAndroid();
  const isDesktop = isTauriDesktop();
  const isWeb = !isAndroid && !isDesktop;
  const win = typeof window !== 'undefined' ? (window as any) : {};

  try {
    // 1. Send automated backup to bots asynchronously with strict 1.5s timeout
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

    // 2. Mark update signature in localStorage (for Web reload; on Android/Desktop, session dismissal only until actual installer is run)
    if (serverInfo) {
      const serverBuild = serverInfo.buildNumber || serverInfo.version;
      const serverVer = serverInfo.version || serverBuild;
      const serverTimestamp = Number(serverInfo.timestamp) || 0;
      const serverSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;
      if (isWeb) {
        localStorage.setItem('last_applied_release_sig', serverSig);
        localStorage.setItem('applied_server_version', serverVer);
        localStorage.setItem('applied_server_build', serverBuild);
        localStorage.setItem('baseline_server_build', serverBuild);
        localStorage.setItem('baseline_server_timestamp', serverTimestamp.toString());
      }
      sessionStorage.removeItem('dismissed_update_sig');
      localStorage.removeItem('dismissed_update_sig');
    }

    // 3. Android platform: Trigger direct download/installation of APK
    if (isAndroid) {
      let rawApk = serverInfo?.androidDownloadUrl || serverInfo?.downloadUrl || '/downloads/dlkam-android-latest.apk';
      if (!rawApk.startsWith('http://') && !rawApk.startsWith('https://')) {
        rawApk = getEffectiveApiUrl(rawApk);
      }
      const apkUrl = rawApk.includes('?') ? `${rawApk}&t=${Date.now()}` : `${rawApk}?t=${Date.now()}`;

      // 3a. Try Capacitor Browser Plugin
      try {
        if (win.Capacitor?.Plugins?.Browser?.open) {
          await win.Capacitor.Plugins.Browser.open({ url: apkUrl });
          return;
        }
      } catch (_) {}

      // 3b. Trigger location navigation to start download in Android system
      try {
        window.location.href = apkUrl;
      } catch (_) {}

      // 3c. Programmatic fallback link invocation
      setTimeout(() => {
        try {
          const a = document.createElement('a');
          a.href = apkUrl;
          a.download = `dlkam-android-v${serverInfo?.version || 'latest'}.apk`;
          a.target = '_self';
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (_) {
          window.open(apkUrl, '_blank');
        }
      }, 300);

      return;
    }

    // 4. Desktop Tauri platform: trigger native updater or open download URL
    if (isDesktop) {
      let rawDesktop = serverInfo?.downloadUrl || '/downloads/dlkam-desktop-setup.msi';
      if (!rawDesktop.startsWith('http://') && !rawDesktop.startsWith('https://')) {
        rawDesktop = getEffectiveApiUrl(rawDesktop);
      }
      const downloadUrl = rawDesktop.includes('?') ? `${rawDesktop}&t=${Date.now()}` : `${rawDesktop}?t=${Date.now()}`;

      // 4a. If Tauri built-in auto-updater is active
      if (win.__TAURI__?.updater?.installUpdate) {
        try {
          await win.__TAURI__.updater.installUpdate();
          if (win.__TAURI__?.process?.relaunch) {
            await win.__TAURI__.process.relaunch();
            return;
          }
        } catch (e) {
          console.warn('Tauri updater failed, falling back to direct browser download:', e);
        }
      }

      // 4b. Open download link using Tauri shell API
      let openedByTauri = false;
      try {
        if (win.__TAURI__?.shell?.open) {
          await win.__TAURI__.shell.open(downloadUrl);
          openedByTauri = true;
        } else if (win.__TAURI_IPC__) {
          const { invoke } = win.__TAURI__?.tauri || win.__TAURI__ || {};
          if (invoke) {
            await invoke('tauri', {
              __tauriModule: 'Shell',
              message: { cmd: 'openWith', path: downloadUrl }
            });
            openedByTauri = true;
          }
        }
      } catch (err) {
        console.warn('Tauri shell.open failed:', err);
      }

      // 4c. Direct location navigation for WebView2 installer download
      if (!openedByTauri) {
        try {
          window.location.href = downloadUrl;
        } catch (_) {
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.target = '_self';
          link.download = 'dlkam-desktop-setup.msi';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }

      return;
    }

    // 5. Web Browser Platform: Purge caches, instruct ServiceWorker, and hard-refresh
    if (isWeb) {
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
    if (isWeb) {
      setTimeout(() => {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.location.replace(`${cleanUrl}?v=${Date.now()}`);
      }, 300);
    }
  }
}

import { getEffectiveApiUrl } from './apiService';

export interface AppVersionInfo {
  version: string;
  buildNumber: string;
  title?: string;
  releaseNotes?: string;
  timestamp?: number;
  downloadUrl?: string;
}

// Current client build embedded in the bundle
export const CURRENT_CLIENT_BUILD: AppVersionInfo = {
  version: '1.3.1',
  buildNumber: '20260831.101',
  title: 'نسخه جاری',
  releaseNotes: 'نسخه پایدار سامانه مالی و بازرگانی'
};

// Check for updates by querying /api/version and /api/desktop/check-update
export async function checkServerUpdate(): Promise<{ hasUpdate: boolean; serverInfo: AppVersionInfo | null }> {
  try {
    const versionApiUrl = getEffectiveApiUrl(`/api/version?t=${Date.now()}`);
    const desktopApiUrl = getEffectiveApiUrl(`/api/desktop/check-update?t=${Date.now()}`);

    let data: AppVersionInfo | null = null;
    let desktopDownloadUrl = '';

    try {
      const res = await fetch(versionApiUrl, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (e) {
      console.debug('Failed fetching /api/version:', e);
    }

    try {
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
              releaseNotes: desktopData.releaseNotes || 'به‌روزرسانی نرم‌افزار',
              title: 'نسخه جدید سامانه'
            };
          }
        }
      }
    } catch (e) {
      console.debug('Failed fetching /api/desktop/check-update:', e);
    }

    if (!data || (!data.version && !data.buildNumber)) {
      return { hasUpdate: false, serverInfo: null };
    }

    const downloadUrl = data.downloadUrl || desktopDownloadUrl || getEffectiveApiUrl('/downloads/sayan-desktop-setup.msi');
    data.downloadUrl = downloadUrl;

    const serverBuild = data.buildNumber || data.version;
    const serverVer = data.version || data.buildNumber;
    const serverTimestamp = Number(data.timestamp) || 0;
    const serverSig = `${serverVer}_${serverBuild}_${serverTimestamp}`;

    if (typeof window === 'undefined') {
      return { hasUpdate: false, serverInfo: data };
    }

    // Compare server version against client embedded version and baseline
    const clientBuild = CURRENT_CLIENT_BUILD.buildNumber;
    const clientVer = CURRENT_CLIENT_BUILD.version;
    const baselineTimestamp = Number(localStorage.getItem('baseline_server_timestamp')) || 0;

    // Is server strictly newer than embedded client build OR baseline timestamp?
    const isNewerThanClientVer = serverVer !== clientVer && serverVer > clientVer;
    const isNewerThanClientBuild = serverBuild !== clientBuild;
    const isNewerThanTimestamp = serverTimestamp > 0 && serverTimestamp > baselineTimestamp;

    const hasUpdate = isNewerThanClientVer || isNewerThanClientBuild || isNewerThanTimestamp;

    return {
      hasUpdate,
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
      localStorage.setItem('baseline_server_build', 'old_version_baseline');
      localStorage.setItem('baseline_server_timestamp', '0');
      window.dispatchEvent(new CustomEvent('app:update-published', { detail: data }));
    }

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message || 'خطا در برقراری ارتباط با سرور' };
  }
}

// Apply update: clear caches, instruct SW to skip waiting, and reload/download
export async function applyApplicationUpdate(serverInfo?: AppVersionInfo | null): Promise<void> {
  try {
    // If a direct setup/installer download URL exists (e.g. for Tauri desktop setup)
    if (serverInfo?.downloadUrl && typeof window !== 'undefined') {
      try {
        const link = document.createElement('a');
        link.href = serverInfo.downloadUrl;
        link.target = '_blank';
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (e) {
        window.open(serverInfo.downloadUrl, '_blank');
      }
    }

    // 1. Tell Service Worker to skip waiting
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        try {
          await reg.update();
        } catch (e) {}
      }
    }

    // 2. Clear stale cache storage
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

    // 3. Send automated backup to bots before applying update
    try {
      const backupUrl = getEffectiveApiUrl('/api/backups/send-to-bot');
      await fetch(backupUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: `پشتیبان خودکار قبل از بروزرسانی به نسخه ${serverInfo?.version || serverInfo?.buildNumber || 'جدید'}` })
      });
    } catch (botErr) {
      console.warn('Backup to bot before update note:', botErr);
    }

    // 4. Mark update signature
    if (serverInfo) {
      const serverBuild = serverInfo.buildNumber || serverInfo.version;
      const serverTimestamp = Number(serverInfo.timestamp) || Date.now();
      const serverSig = `${serverInfo.version || serverBuild}_${serverBuild}_${serverTimestamp}`;
      localStorage.setItem('last_applied_release_sig', serverSig);
      localStorage.setItem('baseline_server_build', serverBuild);
      localStorage.setItem('baseline_server_timestamp', serverTimestamp.toString());
    }
  } catch (e) {
    console.error('Error during applyApplicationUpdate:', e);
  } finally {
    // 5. Force hard reload with cache-buster parameter
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(`${cleanUrl}?_update=${Date.now()}`);
  }
}

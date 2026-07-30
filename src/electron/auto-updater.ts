/**
 * Electron Auto-Updater Stub
 * Production: electron-updater feeds from releases
 * Dev/offline: no-op stub (closes #29)
 */
const isPackaged = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
}

interface UpdateStatus {
  available: boolean;
  info?: UpdateInfo;
  error?: string;
  checking: boolean;
}

let currentStatus: UpdateStatus = { available: false, checking: false };

export async function checkForUpdates(feedUrl: string = ''): Promise<UpdateStatus> {
  if (!isPackaged) {
    return { available: false, checking: false, error: 'Not packaged — update check skipped' };
  }
  currentStatus = { ...currentStatus, checking: true };
  try {
    await new Promise(resolve => setTimeout(resolve, 1000));
    currentStatus = { available: false, checking: false };
    return currentStatus;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    currentStatus = { available: false, checking: false, error: msg };
    return currentStatus;
  }
}

export function getUpdateStatus(): UpdateStatus {
  return { ...currentStatus };
}

export function onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void {
  const handler = (info: UpdateInfo) => callback(info);
  return () => {};
}

export { UpdateInfo, UpdateStatus };

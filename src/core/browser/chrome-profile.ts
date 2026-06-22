import { existsSync, readFileSync } from 'fs';
import { homedir, platform } from 'os';
import { join } from 'path';

export interface ChromeProfile {
  executablePath: string;
  userDataDir: string;
  profileDir: string;
  profileName: string;
  isRunning: boolean;
}

function detectLinuxChrome(): ChromeProfile | null {
  const executables = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];

  const executablePath = executables.find((p) => existsSync(p));
  if (!executablePath) return null;

  const userDataDir = join(homedir(), '.config', 'google-chrome');
  const profileDir = join(userDataDir, 'Default');

  if (!existsSync(userDataDir)) {
    const chromiumDataDir = join(homedir(), '.config', 'chromium');
    if (existsSync(chromiumDataDir)) {
      return {
        executablePath,
        userDataDir: chromiumDataDir,
        profileDir: join(chromiumDataDir, 'Default'),
        profileName: 'Default',
        isRunning: false,
      };
    }
    return null;
  }

  const isRunning = existsSync(join(userDataDir, 'SingletonLock')) ||
                    existsSync(join(userDataDir, 'SingletonSocket'));

  return {
    executablePath,
    userDataDir,
    profileDir,
    profileName: 'Default',
    isRunning,
  };
}

function detectWindowsChrome(): ChromeProfile | null {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local');
  const executables = [
    join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(localAppData, 'Chromium', 'Application', 'chrome.exe'),
    join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.ProgramFiles || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];

  const executablePath = executables.find((p) => existsSync(p));
  if (!executablePath) return null;

  const userDataDir = join(homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
  const profileDir = join(userDataDir, 'Default');

  if (!existsSync(userDataDir)) return null;

  const isRunning = existsSync(join(userDataDir, 'SingletonLock'));

  return {
    executablePath,
    userDataDir,
    profileDir,
    profileName: 'Default',
    isRunning,
  };
}

function detectMacChrome(): ChromeProfile | null {
  const executables = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];

  const executablePath = executables.find((p) => existsSync(p));
  if (!executablePath) return null;

  const userDataDir = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  const profileDir = join(userDataDir, 'Default');

  if (!existsSync(userDataDir)) return null;

  const isRunning = existsSync(join(userDataDir, 'SingletonLock'));

  return {
    executablePath,
    userDataDir,
    profileDir,
    profileName: 'Default',
    isRunning,
  };
}

export function detectChromeProfile(): ChromeProfile | null {
  const os = platform();
  switch (os) {
    case 'linux':
      return detectLinuxChrome();
    case 'win32':
      return detectWindowsChrome();
    case 'darwin':
      return detectMacChrome();
    default:
      return null;
  }
}

export function getAvailableChromeProfiles(userDataDir: string): string[] {
  const profiles: string[] = ['Default'];
  if (!existsSync(userDataDir)) return profiles;

  const entries = ['Profile 1', 'Profile 2', 'Profile 3', 'Profile 4', 'Profile 5', 'Profile 10', 'Profile 11', 'Profile 12', 'Profile 16', 'Profile 17', 'Profile 21', 'Profile 22'];
  for (const entry of entries) {
    const profilePath = join(userDataDir, entry);
    if (existsSync(profilePath) && existsSync(join(profilePath, 'Preferences'))) {
      profiles.push(entry);
    }
  }

  return profiles;
}

export function getProfileNameFromPreferences(userDataDir: string, profileName: string): string {
  try {
    const prefsPath = join(userDataDir, profileName, 'Preferences');
    if (!existsSync(prefsPath)) return profileName;

    const prefs = JSON.parse(readFileSync(prefsPath, 'utf-8'));
    return prefs?.profile?.name || profileName;
  } catch {
    return profileName;
  }
}

export function checkChromeCdpAvailability(port = 9222): Promise<boolean> {
  const url = `http://127.0.0.1:${port}/json/version`;
  return fetch(url, { signal: AbortSignal.timeout(2000) })
    .then((r) => r.ok)
    .catch(() => false);
}

import { openUrl } from '@tauri-apps/plugin-opener';

export const APP_VERSION = '1.0.0';

/**
 * Configure your GitHub repository here once created (format: "username/flow-frame").
 * Users can also override it in localStorage under 'flowframe_github_repo'.
 */
export const DEFAULT_GITHUB_REPO = 'Ward-Milan/flow-frame';

export interface UpdateInfo {
    available: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseNotes: string;
    downloadUrl: string;
    releasePageUrl: string;
    assetName: string | null;
    platform: 'android' | 'macos' | 'other';
}

function detectPlatform(): 'android' | 'macos' | 'other' {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('mac')) return 'macos';
    return 'other';
}

function compareSemver(a: string, b: string): number {
    const cleanA = a.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const cleanB = b.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
        const diff = (cleanA[i] || 0) - (cleanB[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

export function getConfiguredGithubRepo(): string {
    try {
        const stored = localStorage.getItem('flowframe_github_repo')?.trim();
        if (stored) return stored;
    } catch {
        // ignore storage errors
    }
    return DEFAULT_GITHUB_REPO.trim();
}

export function setConfiguredGithubRepo(repo: string): void {
    try {
        localStorage.setItem('flowframe_github_repo', repo.trim());
    } catch {
        // ignore
    }
}

export async function checkForGithubUpdate(repoOverride?: string): Promise<UpdateInfo | null> {
    const repo = (repoOverride ?? getConfiguredGithubRepo()).trim();
    if (!repo || !repo.includes('/')) {
        return null;
    }

    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: {
            Accept: 'application/vnd.github+json'
        }
    });

    if (!res.ok) {
        throw new Error(`GitHub API ${res.status}`);
    }

    const data = await res.json();
    const latestTag: string = data.tag_name || data.name || APP_VERSION;
    const latestVersion = latestTag.replace(/^v/i, '');
    const platform = detectPlatform();
    const assets: Array<{ name: string; browser_download_url: string }> = Array.isArray(data.assets)
        ? data.assets
        : [];

    let matchedAsset: { name: string; browser_download_url: string } | undefined;
    if (platform === 'android') {
        matchedAsset = assets.find(a => a.name.toLowerCase().endsWith('.apk'));
    } else if (platform === 'macos') {
        matchedAsset = assets.find(a => a.name.toLowerCase().endsWith('.dmg'));
    }

    return {
        available: compareSemver(latestVersion, APP_VERSION) > 0,
        currentVersion: APP_VERSION,
        latestVersion,
        releaseNotes: data.body || '',
        downloadUrl: matchedAsset?.browser_download_url || data.html_url || '',
        releasePageUrl: data.html_url || '',
        assetName: matchedAsset?.name || null,
        platform
    };
}

export async function launchUpdateDownload(url: string): Promise<void> {
    if (!url) return;
    try {
        await openUrl(url);
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

// 🔴 TON Connect (optional — fails silently if blocked)
(async () => {
  try {
    const { TonConnectUI } = await import('@tonconnect/ui');

    const tonConnectUI = new TonConnectUI({
      manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
      uiPreferences: { theme: 'DARK' },
    });

    (window as any).tonConnectUI = tonConnectUI;
    console.log('[tonconnect] initialized');
  } catch (e: any) {
    console.warn('[tonconnect] init failed (network?):', e.message);
    (window as any).tonConnectUI = null;
  }
})();

// 🔴 Svelte 5 mount
const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
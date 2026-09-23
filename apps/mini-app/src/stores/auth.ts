import { writable } from 'svelte/store';
import { api } from '../lib/api';

export interface User {
  id: number;
  telegram_id: number;
  username: string;
  display_name: string;
  language: string;
  avatar_id?: string;
}

export interface UserStats {
  handsWon: number;        // real money only
  handsPlayedReal: number; // real money only
  totalWon: number;        // USD won on real tables
  totalHands: number;      // all hands
  trophies: number;
}

export interface FreeChips {
  chips: string;
  total_hands: number;
  free_hands?: number;
  free_won?: number;
  free_hands_won?: number;
}

export interface LoyaltyVoucher {
  id: number;
  amount: number;
  minRake: number;
  currentRake: number;
  used: boolean;
  expiresAt: string;
  progressPct: number;
}

export interface LoyaltySeed {
  type: 'bronze' | 'silver' | 'gold' | 'platinum';
  label: string;
  icon: string;
  amount: number;
  claimed: boolean;
  claimedAt: string | null;
  eligible: boolean;
  progress: {
    freeHands: number;
    freeWins: number;
    minFreeHands: number;
    minFreeWins: number;
  };
}

export interface Loyalty {
  lifetimeXp: number;
  claimedXp: number;
  availableXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  tier: 'welcome' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  tierLabel: string;
  tierIcon: string;
  tierColor: string;
  lifetimeRake: number;
  rakebackPct: number;
  nextTier: { name: string; label: string; minRake: number } | null;
  progressToNextTier: number;
  rakePaidLifetime: number;
  rakebackEarned: number;
  vouchers: LoyaltyVoucher[];
  seeds: LoyaltySeed[];
}

export interface AuthState {
  user: User | null;
  wallet: { balance_usd: string; locked_usd: string } | null;
  freeChips: FreeChips | null;
  stats: UserStats | null;
  loyalty: Loyalty | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    wallet: null,
    freeChips: null,
    stats: null,
    loyalty: null,
    token: null,
    loading: true,
    error: null,
  });

  return {
    subscribe,

    async init() {
      update((s) => ({ ...s, error: null }));

      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        tg.expand();
        if (tg.setHeaderColor) tg.setHeaderColor('#0a0e1a');
        if (tg.setBackgroundColor) tg.setBackgroundColor('#0a0e1a');
      }

      const tgInitData = tg?.initData;
      let authPayload: string;

      if (tgInitData && tgInitData.length > 0) {
        authPayload = tgInitData;
      } else {
        const params = new URLSearchParams(window.location.search);
        const urlUid = params.get('uid');
        const urlName = params.get('name');

        let devUid: number;
        let devName: string;

        if (urlUid) {
          devUid = Number(urlUid);
          devName = urlName || `User${devUid}`;
          localStorage.setItem('dev_uid', String(devUid));
          localStorage.setItem('dev_name', devName);
        } else {
          const storedUid = localStorage.getItem('dev_uid');
          if (storedUid) {
            devUid = Number(storedUid);
            devName = localStorage.getItem('dev_name') || `User${devUid}`;
          } else {
            devUid = Math.floor(100000 + Math.random() * 900000);
            devName = `User${devUid}`;
            localStorage.setItem('dev_uid', String(devUid));
            localStorage.setItem('dev_name', devName);
          }
        }

        const userJson = JSON.stringify({
          id: devUid,
          first_name: devName,
          username: devName.toLowerCase().replace(/\s/g, ''),
          language_code: 'en',
        });

        authPayload = `user=${encodeURIComponent(userJson)}&auth_date=9999999999&hash=dev`;
      }

      try {
        const res = await api.authTelegram(authPayload);
        if (!res.ok || !res.data) {
          update((s) => ({ ...s, loading: false, error: res.error || 'auth_failed' }));
          return false;
        }

        localStorage.setItem('token', res.data.token);
        update((s) => ({ ...s, token: res.data!.token, user: res.data!.user }));

        await this.refresh();
        return true;
      } catch (e: any) {
        update((s) => ({ ...s, loading: false, error: e.message || 'network_error' }));
        return false;
      }
    },

    async refresh() {
      const res = await api.me();
      if (res.ok && res.data) {
        const data = res.data as any;
        update((s) => ({
          ...s,
          user: data.user,
          wallet: data.wallet,
          freeChips: data.free_chips,
          stats: data.stats ?? null,
          loyalty: data.loyalty ?? null,
          loading: false,
          error: null,
        }));
      } else {
        update((s) => ({ ...s, loading: false, error: res.error || 'refresh_failed' }));
      }
    },

    logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('dev_uid');
      localStorage.removeItem('dev_name');
      set({
        user: null,
        wallet: null,
        freeChips: null,
        stats: null,
        loyalty: null,
        token: null,
        loading: false,
        error: null,
      });
    },
  };
}

export const auth = createAuthStore();

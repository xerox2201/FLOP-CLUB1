const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'request_failed' };
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e.message || 'network_error' };
  }
}

export const api = {
  authTelegram: (initData: string) =>
    request<{ token: string; user: any }>('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    }),

  me: () => request<{ user: any; wallet: any; free_chips: any }>('/api/me'),

  updateAvatar: (avatar_id: string) =>
    request<{ ok: boolean; avatar_id: string }>('/api/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar_id }),
    }),

  tables: () => request<{ tables: any[] }>('/api/tables'),

  leaderboardCurrent: () =>
    request<{ period: any; entries: any[]; livePrizePool: number; liveTotalRake: number }>(
      '/api/leaderboard/current'
    ),
  leaderboardMe: () =>
    request<{ entry: any; liveRank: number }>('/api/leaderboard/me'),

  events: () => request<{ events: any[] }>('/api/events'),
  event: (id: number) =>
    request<{ event: any; registrations: any[]; results: any[] }>(`/api/events/${id}`),

  registerEvent: (id: number) =>
    request<{ ok: boolean; already?: boolean }>(
      `/api/events/${id}/register`,
      { method: 'POST', body: JSON.stringify({}) }
    ),

  unregisterEvent: (id: number) =>
    request<{ ok: boolean }>(
      `/api/events/${id}/register`,
      { method: 'DELETE' }
    ),

  health: () => request('/health'),
};

export { API_URL };
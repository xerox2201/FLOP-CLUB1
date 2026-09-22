export const API_URL = '';

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  async request<T = any>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const token = this.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });

      let data: any = null;
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        return {
          ok: false,
          error: data?.error || `HTTP ${res.status}`,
          status: res.status,
        };
      }

      return { ok: true, data, status: res.status };
    } catch (e: any) {
      return { ok: false, error: e.message || 'network_error' };
    }
  }

  // ============================================================
  // Auth
  // ============================================================
  async authTelegram(initData: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request('/api/auth/telegram', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
  }

  async me(): Promise<ApiResponse<{ user: any; wallet: any; free_chips: any }>> {
    return this.request('/api/me');
  }

  async updateAvatar(avatarId: string): Promise<ApiResponse<{ ok: boolean; avatar_id: string }>> {
    return this.request('/api/me/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar_id: avatarId }),
    });
  }

  // ============================================================
  // Tables
  // ============================================================
  async tables(): Promise<ApiResponse<{ tables: any[] }>> {
    return this.request('/api/tables');
  }

  async getTables(): Promise<ApiResponse<{ tables: any[] }>> {
    return this.request('/api/tables');
  }

  // ============================================================
  // Leaderboard / Events
  // ============================================================
  async leaderboard(period: string = 'all'): Promise<ApiResponse<any>> {
    return this.request(`/api/leaderboard?period=${period}`);
  }

  async getLeaderboard(period: string = 'all'): Promise<ApiResponse<any>> {
    return this.request(`/api/leaderboard?period=${period}`);
  }

  async getSeasonLeaderboard(): Promise<ApiResponse<any>> {
    return this.request('/api/leaderboard/season');
  }

  async getMySeasonRank(): Promise<ApiResponse<any>> {
    return this.request('/api/leaderboard/season/me');
  }

  async getMyTournaments(filter: string = 'all', limit: number = 50): Promise<ApiResponse<any>> {
    return this.request(`/api/my/tournaments?filter=${filter}&limit=${limit}`);
  }

  async events(): Promise<ApiResponse<any>> {
    return this.request('/api/events');
  }

  async getEvents(): Promise<ApiResponse<any>> {
    return this.request('/api/events');
  }

  // ============================================================
  // Hands
  // ============================================================
  async getRecentHands(limit = 20, offset = 0): Promise<ApiResponse<{ hands: any[] }>> {
    return this.request(`/api/hands/recent?limit=${limit}&offset=${offset}`);
  }

  async getHandDetail(handId: number): Promise<ApiResponse<{ hand: any; events: any[] }>> {
    return this.request(`/api/hands/${handId}`);
  }

  async getHandReplay(
    handId: number,
  ): Promise<ApiResponse<{ hand: any; initialSnapshot: any; events: any[] }>> {
    return this.request(`/api/hands/${handId}/replay`);
  }

  // ============================================================
  // Wallet
  // ============================================================
  async walletBalance(): Promise<ApiResponse<any>> {
    return this.request('/api/wallet/balance');
  }

  async walletDepositInfo(): Promise<ApiResponse<any>> {
    return this.request('/api/wallet/deposit-info');
  }

  async walletHistory(): Promise<ApiResponse<any>> {
    return this.request('/api/wallet/history');
  }

  async walletWithdraw(amountTon: number, toAddress: string): Promise<ApiResponse<any>> {
    return this.request('/api/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amountTon, toAddress }),
    });
  }

  // ============================================================
  // Tournaments
  // ============================================================
  async listTournaments(filter?: {
    status?: string;
    variant?: string;
    mode?: string;
  }): Promise<ApiResponse<{ tournaments: any[] }>> {
    const qs = new URLSearchParams();
    if (filter?.status) qs.set('status', filter.status);
    if (filter?.variant) qs.set('variant', filter.variant);
    if (filter?.mode) qs.set('mode', filter.mode);
    const q = qs.toString();
    return this.request(`/api/tournaments${q ? '?' + q : ''}`);
  }

  async getTournament(id: number): Promise<ApiResponse<any>> {
    return this.request(`/api/tournaments/${id}`);
  }

  async createTournament(body: any): Promise<ApiResponse<{ ok: boolean; tournamentId: number }>> {
    return this.request('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async registerTournament(id: number): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(`/api/tournaments/${id}/register`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async unregisterTournament(id: number): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(`/api/tournaments/${id}/unregister`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async startTournament(id: number): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(`/api/tournaments/${id}/start`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async listBlindStructures(): Promise<ApiResponse<{ structures: any[] }>> {
    return this.request('/api/blind-structures');
  }

  // ============================================================
  // Broadcasts / Notifications
  // ============================================================
  async getBroadcasts(): Promise<
    ApiResponse<{
      broadcasts: Array<{
        id: number;
        title: string;
        message: string;
        target: string;
        severity: 'info' | 'warning' | 'success' | 'danger';
        createdAt: string;
      }>;
    }>
  > {
    return this.request('/api/broadcasts');
  }

  async markBroadcastRead(id: number): Promise<ApiResponse<{ ok: boolean }>> {
    return this.request(`/api/broadcasts/${id}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }
}

export const api = new ApiClient(API_URL);

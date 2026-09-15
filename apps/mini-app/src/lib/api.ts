 export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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

  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
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
  // Tables — با alias برای سازگاری
  // ============================================================
  async tables(): Promise<ApiResponse<{ tables: any[] }>> {
    return this.request('/api/tables');
  }

  async getTables(): Promise<ApiResponse<{ tables: any[] }>> {
    return this.request('/api/tables');
  }

  // ============================================================
  // Leaderboard — با alias
  // ============================================================
  async leaderboard(period: string = 'all'): Promise<ApiResponse<any>> {
    return this.request(`/api/leaderboard?period=${period}`);
  }

  async getLeaderboard(period: string = 'all'): Promise<ApiResponse<any>> {
    return this.request(`/api/leaderboard?period=${period}`);
  }

  // ============================================================
  // Events — با alias
  // ============================================================
  async events(): Promise<ApiResponse<any>> {
    return this.request('/api/events');
  }

  async getEvents(): Promise<ApiResponse<any>> {
    return this.request('/api/events');
  }

  // ============================================================
  // Hands API (Phase C)
  // ============================================================
  async getRecentHands(limit = 20, offset = 0): Promise<ApiResponse<{ hands: any[] }>> {
    return this.request(`/api/hands/recent?limit=${limit}&offset=${offset}`);
  }

  async getHandDetail(handId: number): Promise<ApiResponse<{ hand: any; events: any[] }>> {
    return this.request(`/api/hands/${handId}`);
  }

  async getHandReplay(handId: number): Promise<ApiResponse<{ hand: any; initialSnapshot: any; events: any[] }>> {
    return this.request(`/api/hands/${handId}/replay`);
  }
}

export const api = new ApiClient(API_URL);
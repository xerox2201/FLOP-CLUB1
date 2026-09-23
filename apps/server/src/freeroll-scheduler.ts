import { Pool } from 'pg';
import { FreerollService } from './freeroll-service.js';

export class FreerollScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private db: Pool,
    private svc: FreerollService,
  ) {}

  start(intervalMs = 5 * 60 * 1000): void {
    console.log(
      `[freeroll] scheduler running (every ${Math.round(intervalMs / 60000)}m)`,
    );
    this.tick().catch((e) => console.error('[freeroll] tick error:', e.message));
    this.timer = setInterval(() => {
      this.tick().catch((e) =>
        console.error('[freeroll] tick error:', e.message),
      );
    }, intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    const cfg = await this.svc.getConfig();
    if (!cfg.enabled) return;

    const hasUpcoming = await this.svc.hasUpcomingFreeroll();
    if (hasUpcoming) return;

    const now = new Date();
    const next = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        Number(cfg.schedule_hour_utc),
        Number(cfg.schedule_minute_utc),
        0,
        0,
      ),
    );
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    await this.svc.createDailyFreeroll(next);
  }
}
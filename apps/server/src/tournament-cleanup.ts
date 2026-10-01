import { Pool } from 'pg';
import { gameManager } from './game-manager.js';

/**
 * Periodic job: finds stale running tournaments and cancels them.
 * Runs every 10 minutes.
 */
export class TournamentCleanupJob {
  private timer: NodeJS.Timeout | null = null;

  constructor(private db: Pool) {}

  start(intervalMs = 10 * 60 * 1000): void {
    console.log(
      `[cleanup] 🧹 stale tournament cleanup running (every ${Math.round(intervalMs / 60000)}m)`,
    );
    this.tick().catch((e) => console.error('[cleanup] tick error:', e.message));
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('[cleanup] tick error:', e.message));
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
    try {
      // Find running tournaments that are stale:
      // - started > 4h ago
      // - OR have 0 active players for more than 15 minutes
      const stale = await this.db.query(
        `SELECT t.id, t.name
         FROM tournaments t
         WHERE t.status IN ('running', 'final_table')
           AND (
             t.started_at < NOW() - INTERVAL '4 hours'
             OR (
               (SELECT COUNT(*) FROM tournament_players tp
                WHERE tp.tournament_id = t.id AND tp.status = 'active') = 0
             )
           )`,
      );

      if (stale.rows.length === 0) return;

      console.log(`[cleanup] 🧹 cancelling ${stale.rows.length} stale tournament(s)`);
      for (const s of stale.rows) {
        console.log(`[cleanup]   #${s.id} "${s.name}"`);
        await this.db.query(
          `UPDATE tournaments SET status = 'cancelled', finished_at = NOW() WHERE id = $1`,
          [s.id],
        );
        await this.db.query(
          `UPDATE tournament_players SET status = 'eliminated', eliminated_at = NOW()
           WHERE tournament_id = $1 AND status = 'active'`,
          [s.id],
        );
        // Destroy in-memory room if exists
        const room = gameManager.getRoom(1_000_000 + s.id * 1000 + 1);
        if (room) {
          console.log(`[cleanup]   destroying room for #${s.id}`);
        }
      }
    } catch (e: any) {
      console.error('[cleanup] tick error:', e.message);
    }
  }
}

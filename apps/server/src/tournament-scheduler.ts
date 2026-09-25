import { Pool } from 'pg';
import { TournamentManager } from './tournament-manager.js';

export interface TemplateRow {
  id: number;
  name: string;
  variant: string;
  mode: string;
  format: string;
  speed: string;
  buy_in: string;
  fee: string;
  starting_stack: string;
  min_players: number;
  max_players: number;
  guaranteed: string;
  late_reg_min: number;
  late_reg_level: number;
  allow_re_entry: boolean;
  max_re_entries: number;
  is_bounty: boolean;
  bounty_amount: string;
  satellite_target_id: number | null;
  seats_awarded: number;
  blind_structure_id: number;
  schedule_type: 'hourly' | 'daily' | 'weekly';
  schedule_time: string;
  schedule_day: number;
  is_active: boolean;
  next_run_at: Date | null;
  last_run_at: Date | null;
  created_by: number | null;
  allow_rebuy: boolean;
  max_rebuys: number;
  rebuy_amount: string;
  rebuy_stack: string;
  rebuy_until_level: number;
  allow_addon: boolean;
  addon_amount: string;
  addon_stack: string;
  addon_at_level: number;
}

export class TournamentScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private db: Pool,
    private tm: TournamentManager,
  ) {}

  /**
   * Compute next_run_at from a schedule config.
   * schedule_type: 'hourly' | 'daily' | 'weekly'
   * schedule_time: "HH:MM" (UTC)
   * schedule_day: 0=Sun..6=Sat (only for weekly)
   */
  computeNextRun(t: { schedule_type: string; schedule_time: string; schedule_day: number }): Date {
    const now = new Date();
    const [hh, mm] = (t.schedule_time || '14:00').split(':').map((x) => parseInt(x, 10));
    const next = new Date(now);

    if (t.schedule_type === 'hourly') {
      // next hour at :00
      next.setUTCMinutes(0, 0, 0);
      next.setUTCHours(now.getUTCHours() + 1);
      return next;
    }

    if (t.schedule_type === 'daily') {
      next.setUTCHours(hh, mm, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setUTCDate(next.getUTCDate() + 1);
      }
      return next;
    }

    if (t.schedule_type === 'weekly') {
      const target = t.schedule_day ?? 0;
      const cur = now.getUTCDay();
      let days = (target - cur + 7) % 7;
      next.setUTCDate(now.getUTCDate() + days);
      next.setUTCHours(hh, mm, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setUTCDate(next.getUTCDate() + 7);
      }
      return next;
    }

    // fallback
    next.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
    return next;
  }

  async create(input: {
    name: string;
    variant: string;
    mode: string;
    format: string;
    speed: string;
    buy_in: number;
    fee: number;
    starting_stack: number;
    min_players: number;
    max_players: number;
    guaranteed: number;
    late_reg_min: number;
    late_reg_level: number;
    allow_re_entry: boolean;
    max_re_entries: number;
    is_bounty: boolean;
    bounty_amount: number;
    satellite_target_id: number | null;
    seats_awarded: number;
    blind_structure_id: number;
    schedule_type: string;
    schedule_time: string;
    schedule_day: number;
    created_by: number | null;
    // Rebuy / Addon
    allow_rebuy?: boolean;
    max_rebuys?: number;
    rebuy_amount?: number;
    rebuy_stack?: number;
    rebuy_until_level?: number;
    allow_addon?: boolean;
    addon_amount?: number;
    addon_stack?: number;
    addon_at_level?: number;
  }): Promise<{ ok: boolean; templateId?: number; error?: string }> {
    try {
      const nextRun = this.computeNextRun({
        schedule_type: input.schedule_type,
        schedule_time: input.schedule_time,
        schedule_day: input.schedule_day,
      });

      const res = await this.db.query(
        `INSERT INTO tournament_templates
           (name, variant, mode, format, speed, buy_in, fee, starting_stack,
            min_players, max_players, guaranteed, late_reg_min, late_reg_level,
            allow_re_entry, max_re_entries, is_bounty, bounty_amount,
            satellite_target_id, seats_awarded, blind_structure_id,
            schedule_type, schedule_time, schedule_day,
            is_active, next_run_at, created_by,
            allow_rebuy, max_rebuys, rebuy_amount, rebuy_stack, rebuy_until_level,
            allow_addon, addon_amount, addon_stack, addon_at_level)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,
                 TRUE,$24,$25,
                 $26,$27,$28,$29,$30,
                 $31,$32,$33,$34)
         RETURNING id`,
        [
          input.name,
          input.variant,
          input.mode,
          input.format,
          input.speed,
          input.buy_in,
          input.fee,
          input.starting_stack,
          input.min_players,
          input.max_players,
          input.guaranteed,
          input.late_reg_min,
          input.late_reg_level,
          input.allow_re_entry,
          input.max_re_entries,
          input.is_bounty,
          input.bounty_amount,
          input.satellite_target_id,
          input.seats_awarded,
          input.blind_structure_id,
          input.schedule_type,
          input.schedule_time,
          input.schedule_day,
          nextRun,
          input.created_by,
          input.allow_rebuy ?? false,
          input.max_rebuys ?? 0,
          input.rebuy_amount ?? 0,
          input.rebuy_stack ?? 0,
          input.rebuy_until_level ?? 0,
          input.allow_addon ?? false,
          input.addon_amount ?? 0,
          input.addon_stack ?? 0,
          input.addon_at_level ?? 0,
        ],
      );
      return { ok: true, templateId: res.rows[0].id };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async list(): Promise<TemplateRow[]> {
    const res = await this.db.query(
      `SELECT * FROM tournament_templates ORDER BY is_active DESC, next_run_at ASC NULLS LAST, id DESC`,
    );
    return res.rows;
  }

  async toggle(id: number, active: boolean): Promise<{ ok: boolean; error?: string }> {
    try {
      let nextRun: Date | null = null;
      if (active) {
        const tRes = await this.db.query('SELECT * FROM tournament_templates WHERE id=$1', [id]);
        if (tRes.rows.length === 0) return { ok: false, error: 'not_found' };
        nextRun = this.computeNextRun(tRes.rows[0]);
      }
      await this.db.query(
        `UPDATE tournament_templates SET is_active = $1, next_run_at = $2 WHERE id = $3`,
        [active, nextRun, id],
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  async remove(id: number): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.db.query('DELETE FROM tournament_templates WHERE id = $1', [id]);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  start(intervalMs: number = 60_000): void {
    console.log(`[scheduler] 🗓️ tournament scheduler running (every ${intervalMs / 1000}s)`);
    this.tick().catch((e) => console.error('[scheduler] tick error:', e.message));
    this.timer = setInterval(() => {
      this.tick().catch((e) => console.error('[scheduler] tick error:', e.message));
    }, intervalMs);
    if (this.timer.unref) this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      const due = await this.db.query(
        `SELECT * FROM tournament_templates
         WHERE is_active = TRUE AND next_run_at IS NOT NULL AND next_run_at <= NOW()
         ORDER BY next_run_at ASC LIMIT 10`,
      );

      for (const tpl of due.rows) {
        await this.fire(tpl);
      }
    } catch (e: any) {
      console.error('[scheduler] error:', e.message);
    }
  }

  private async fire(tpl: TemplateRow): Promise<void> {
    try {
      // Create a new tournament from template
      const tid = await this.tm.create({
        name: tpl.name,
        variant: tpl.variant as any,
        mode: tpl.mode as any,
        format: tpl.format as any,
        speed: tpl.speed as any,
        buyIn: Number(tpl.buy_in),
        fee: Number(tpl.fee),
        startingStack: Number(tpl.starting_stack),
        minPlayers: tpl.min_players,
        maxPlayers: tpl.max_players,
        guaranteed: Number(tpl.guaranteed),
        scheduledStart: new Date(),
        lateRegMin: tpl.late_reg_min,
        lateRegLevel: tpl.late_reg_level,
        allowReEntry: tpl.allow_re_entry,
        maxReEntries: tpl.max_re_entries,
        isBounty: tpl.is_bounty,
        bountyAmount: Number(tpl.bounty_amount),
        satelliteTargetId: tpl.satellite_target_id,
        seatsAwarded: tpl.seats_awarded,
        blindStructureId: tpl.blind_structure_id,
        isPrivate: false,
        createdBy: tpl.created_by ?? 1,
        allowRebuy: tpl.allow_rebuy,
        maxRebuys: tpl.max_rebuys,
        rebuyAmount: Number(tpl.rebuy_amount),
        rebuyStack: Number(tpl.rebuy_stack),
        rebuyUntilLevel: tpl.rebuy_until_level,
        allowAddon: tpl.allow_addon,
        addonAmount: Number(tpl.addon_amount),
        addonStack: Number(tpl.addon_stack),
        addonAtLevel: tpl.addon_at_level,
      });

      const nextRun = this.computeNextRun(tpl);

      await this.db.query(
        `UPDATE tournament_templates SET last_run_at = NOW(), next_run_at = $1 WHERE id = $2`,
        [nextRun, tpl.id],
      );

      console.log(
        `[scheduler] ✅ fired template #${tpl.id} "${tpl.name}" → tournament #${tid} (next run: ${nextRun.toISOString()})`,
      );
    } catch (e: any) {
      console.error(`[scheduler] ❌ fire failed for template #${tpl.id}:`, e.message);
      // advance next_run even on failure to avoid stuck loop
      try {
        const nextRun = this.computeNextRun(tpl);
        await this.db.query(`UPDATE tournament_templates SET next_run_at = $1 WHERE id = $2`, [
          nextRun,
          tpl.id,
        ]);
      } catch {}
    }
  }
}

import { Pool } from 'pg';

export interface BlindLevel {
  level: number;
  sb: number;
  bb: number;
  ante: number;
  durationSec: number;
  isBreak: boolean;
}

export class BlindStructureService {
  private cache: Map<number, BlindLevel[]> = new Map();

  constructor(private db: Pool) {}

  async getLevels(structureId: number): Promise<BlindLevel[]> {
    if (this.cache.has(structureId)) {
      return this.cache.get(structureId)!;
    }

    const res = await this.db.query(
      `SELECT level, small_blind, big_blind, ante, duration_sec, is_break
       FROM blind_levels
       WHERE structure_id = $1
       ORDER BY level ASC`,
      [structureId]
    );

    const levels: BlindLevel[] = res.rows.map(r => ({
      level: r.level,
      sb: Number(r.small_blind),
      bb: Number(r.big_blind),
      ante: Number(r.ante),
      durationSec: r.duration_sec,
      isBreak: r.is_break,
    }));

    this.cache.set(structureId, levels);
    return levels;
  }

  async getLevel(structureId: number, level: number): Promise<BlindLevel | null> {
    const levels = await this.getLevels(structureId);
    return levels.find(l => l.level === level) ?? null;
  }

  /**
   * Compute the current level based on elapsed seconds since tournament start
   */
  async getLevelAtTime(structureId: number, elapsedSec: number): Promise<{
    level: number;
    levelData: BlindLevel | null;
    nextLevelIn: number;
  }> {
    const levels = await this.getLevels(structureId);
    if (levels.length === 0) {
      return { level: 1, levelData: null, nextLevelIn: 0 };
    }

    let elapsed = 0;
    for (const lvl of levels) {
      if (elapsedSec < elapsed + lvl.durationSec) {
        return {
          level: lvl.level,
          levelData: lvl,
          nextLevelIn: Math.max(0, elapsed + lvl.durationSec - elapsedSec),
        };
      }
      elapsed += lvl.durationSec;
    }

    // Past last level — return last
    const last = levels[levels.length - 1];
    return { level: last.level, levelData: last, nextLevelIn: 0 };
  }

  invalidateCache(structureId: number): void {
    this.cache.delete(structureId);
  }
}
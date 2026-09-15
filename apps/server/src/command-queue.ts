import { Pool } from 'pg';
import { ErrorCode, type CommandResult } from './errors.js';

export class CommandQueue {
  constructor(private db: Pool) {}

  /**
   * اجرای idempotent یک command
   * - اگه commandId تکراری باشه، نتیجه‌ی قبلی برمی‌گرده
   * - اگه جدید باشه، handler اجرا می‌شه و نتیجه ذخیره می‌شه
   */
  async run<T>(
    commandId: string,
    userId: number,
    scope: string,
    handler: () => Promise<CommandResult<T>>,
  ): Promise<CommandResult<T>> {
    if (!commandId) {
      // اگه commandId نباشه، idempotency نداره
      return handler();
    }

    // 1. چک کن قبلاً پردازش شده؟
    try {
      const existing = await this.db.query('SELECT result FROM idempotency_keys WHERE key = $1', [
        commandId,
      ]);

      if (existing.rows.length > 0) {
        return {
          ok: true,
          duplicate: true,
          data: existing.rows[0].result?.data,
        };
      }
    } catch (e: any) {
      console.error('[command-queue] check failed:', e.message);
    }

    // 2. اجرا کن
    const result = await handler();

    // 3. ذخیره کن
    try {
      await this.db.query(
        `INSERT INTO idempotency_keys (key, user_id, scope, result, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')
         ON CONFLICT (key) DO NOTHING`,
        [commandId, userId, scope, JSON.stringify({ data: result.data ?? null })],
      );
    } catch (e: any) {
      console.error('[command-queue] save failed:', e.message);
    }

    return result;
  }
}

import { Pool } from 'pg';
import { LedgerService } from './ledger.js';

const TON_NETWORK = process.env.TON_NETWORK || 'testnet';
const TON_API_KEY = process.env.TON_API_KEY || '';
const TON_DEPOSIT_ADDRESS = process.env.TON_DEPOSIT_ADDRESS || '';
const TON_WITHDRAW_FEE = Number(process.env.TON_WITHDRAW_FEE || 0.05);
const POLL_INTERVAL_MS = 15_000;
const TON_PRICE_USD = Number(process.env.TON_PRICE_USD || 5);

const API_BASE = TON_NETWORK === 'mainnet'
  ? 'https://toncenter.com/api/v2'
  : 'https://testnet.toncenter.com/api/v2';

export class DepositWatcher {
  private ledger: LedgerService;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private db: Pool) {
    this.ledger = new LedgerService(db);
  }

  start(): void {
    console.log(`[deposit-watcher] starting. address=${TON_DEPOSIT_ADDRESS} interval=${POLL_INTERVAL_MS}ms`);
    this.tick();
    this.timer = setInterval(() => this.tick(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.checkDeposits();
      await this.checkPendingWithdrawals();
    } catch (e: any) {
      console.error('[deposit-watcher] tick failed:', e.message);
    } finally {
      this.running = false;
    }
  }

  // ============================================================
  // DEPOSITS
  // ============================================================
  private async checkDeposits(): Promise<void> {
    if (!TON_DEPOSIT_ADDRESS) return;
    const txs = await this.fetchTransactions(TON_DEPOSIT_ADDRESS);
    for (const tx of txs) {
      await this.processDeposit(tx);
    }
  }

  private async fetchTransactions(address: string): Promise<any[]> {
    try {
      const url = `${API_BASE}/getTransactions?address=${encodeURIComponent(address)}&limit=30${TON_API_KEY ? '&api_key=' + TON_API_KEY : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.error('[deposit-watcher] API error:', res.status);
        return [];
      }
      const data: any = await res.json();
      return data.result || [];
    } catch (e: any) {
      console.error('[deposit-watcher] fetch failed:', e.message);
      return [];
    }
  }

  private async processDeposit(tx: any): Promise<void> {
    const txHash = tx.transaction_id?.hash;
    if (!txHash) return;

    const existing = await this.db.query(
      'SELECT id FROM ton_transactions WHERE tx_hash = $1',
      [txHash]
    );
    if (existing.rows.length > 0) return;

    const inMsg = tx.in_msg;
    if (!inMsg || !inMsg.value || Number(inMsg.value) <= 0) return;

    const memo = String(inMsg.message || '').trim();
    const fromAddress = inMsg.source || 'unknown';
    const amountTon = Number(inMsg.value) / 1e9;
    const txTime = new Date(Number(tx.utime || 0) * 1000);

    const userId = Number(memo);
    if (!userId || isNaN(userId)) {
      console.warn(`[deposit-watcher] ignoring tx ${txHash.slice(0, 12)}…: invalid memo "${memo}"`);
      return;
    }

    const userRes = await this.db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      console.warn(`[deposit-watcher] unknown user id=${userId}`);
      return;
    }

    const amountUsd = Math.round(amountTon * TON_PRICE_USD * 100) / 100;
    console.log(`[deposit-watcher] 💰 deposit: user=${userId} amount=${amountTon} TON ($${amountUsd})`);

    try {
      const tonRes = await this.db.query(
        `INSERT INTO ton_transactions
           (user_id, direction, amount_ton, amount_usd, tx_hash, from_address, to_address, memo, status, confirmations, confirmed_at)
         VALUES ($1, 'deposit', $2, $3, $4, $5, $6, $7, 'confirmed', 1, NOW())
         ON CONFLICT (tx_hash) DO NOTHING
         RETURNING id`,
        [userId, amountTon, amountUsd, txHash, fromAddress, TON_DEPOSIT_ADDRESS, memo]
      );

      if (tonRes.rows.length === 0) return;
      const tonTxId = tonRes.rows[0].id;

      const userAcc = await this.ledger.getUserAccountId(userId);
      const depositAcc = await this.ledger.getAccountId('SYSTEM_TON_DEPOSITS');
      if (!userAcc || !depositAcc) return;

      const ledgerResult = await this.ledger.record({
        kind: 'DEPOSIT',
        userId,
        ref: `ton_${txHash}`,
        meta: { txHash, amountTon, fromAddress, memo },
        entries: [
          { accountId: depositAcc, amount: -amountUsd },
          { accountId: userAcc, amount: amountUsd },
        ],
        idempotencyKey: `ton_dep_${txHash}`,
      });

      if (!ledgerResult.ok) return;

      await this.db.query(
        'UPDATE ton_transactions SET ledger_tx_id = $1 WHERE id = $2',
        [ledgerResult.transactionId, tonTxId]
      );

      console.log(`[deposit-watcher] ✅ credited user=${userId} $${amountUsd}`);
    } catch (e: any) {
      console.error(`[deposit-watcher] process failed: ${e.message}`);
    }
  }

  // ============================================================
  // 🔴 WITHDRAWAL CONFIRMATION
  // ============================================================
  private async checkPendingWithdrawals(): Promise<void> {
    const pending = await this.db.query(
      `SELECT id, user_id, amount_ton, amount_usd, to_address, created_at
       FROM ton_transactions
       WHERE direction = 'withdraw'
         AND status IN ('processing', 'pending')
         AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY id DESC
       LIMIT 20`
    );

    if (pending.rows.length === 0) return;

    for (const tx of pending.rows) {
      await this.verifyWithdrawal(tx);
    }
  }

  private async verifyWithdrawal(tx: any): Promise<void> {
    const amountSent = Number(tx.amount_ton) - TON_WITHDRAW_FEE;
    const toAddress = tx.to_address;
    const createdAt = new Date(tx.created_at).getTime() / 1000;

    // 🔴 Query destination address transactions
    const txs = await this.fetchTransactions(toAddress);

    // Match by amount + timestamp proximity
    for (const t of txs) {
      const inMsg = t.in_msg;
      if (!inMsg || !inMsg.value) continue;

      const inValue = Number(inMsg.value) / 1e9;
      const txTime = Number(t.utime || 0);

      // 🔴 Match: amount within 5% + timestamp within 5 min
      const amountMatch = Math.abs(inValue - amountSent) < 0.005;
      const timeMatch = Math.abs(txTime - createdAt) < 300;

      if (amountMatch && timeMatch) {
        console.log(`[deposit-watcher] ✅ withdrawal confirmed: id=${tx.id} amount=${inValue} TON`);
        await this.db.query(
          `UPDATE ton_transactions SET status = 'confirmed', confirmed_at = NOW() WHERE id = $1`,
          [tx.id]
        );
        return;
      }
    }

    // 🔴 Timeout: if older than 10 min and not found → refund
    const ageMin = (Date.now() / 1000 - createdAt) / 60;
    if (ageMin > 10 && tx.status === 'processing') {
      console.warn(`[deposit-watcher] ⏱️ withdrawal timeout: id=${tx.id} age=${ageMin.toFixed(1)}min`);
      await this.refundWithdrawal(tx);
    }
  }

  private async refundWithdrawal(tx: any): Promise<void> {
    try {
      const userId = tx.user_id;
      const amountUsd = Number(tx.amount_usd || 0);

      const userAcc = await this.ledger.getUserAccountId(userId);
      const escrowAcc = await this.ledger.getAccountId('SYSTEM_ESCROW');
      if (!userAcc || !escrowAcc) return;

      const result = await this.ledger.record({
        kind: 'WITHDRAWAL',
        userId,
        ref: `withdraw_refund_${tx.id}`,
        meta: { originalTxId: tx.id, reason: 'timeout' },
        entries: [
          { accountId: escrowAcc, amount: -amountUsd },
          { accountId: userAcc, amount: amountUsd },
        ],
        idempotencyKey: `wd_refund_${tx.id}`,
      });

      if (result.ok) {
        await this.db.query(
          `UPDATE ton_transactions SET status = 'failed', error = 'timeout_no_confirmation' WHERE id = $1`,
          [tx.id]
        );
        console.log(`[deposit-watcher] 💸 refunded user=${userId} $${amountUsd}`);
      }
    } catch (e: any) {
      console.error(`[deposit-watcher] refund failed: ${e.message}`);
    }
  }
}
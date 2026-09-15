import { Pool } from 'pg';

const THRESHOLDS = {
  botFastActionMs: 400,
  botFastActionCount: 10,
  botStdDevMs: 100,
  sameIpTablesTogether: 3,
  sameDeviceTablesTogether: 2,
  minHandsTogether: 20,
  chipDumpingThreshold: 0.65,
  warnScore: 40,
  shadowbanScore: 65,
  banScore: 85,
};

export interface ActionRecord {
  userId: number;
  tableId: number;
  handNo: number;
  action: 'fold' | 'check' | 'call' | 'raise';
  amount: number;
  street: string;
  responseMs: number;
}

export async function recordIp(db: Pool, userId: number, ip: string) {
  if (!ip) return;
  try {
    await db.query(
      `INSERT INTO user_ips (user_id, ip) VALUES ($1, $2)
       ON CONFLICT (user_id, ip) DO UPDATE SET last_seen = NOW()`,
      [userId, ip],
    );
  } catch (e) {}
}

export async function recordDevice(db: Pool, userId: number, deviceHash: string) {
  if (!deviceHash) return;
  try {
    await db.query(
      `INSERT INTO user_devices (user_id, device_hash) VALUES ($1, $2)
       ON CONFLICT (user_id, device_hash) DO UPDATE SET last_seen = NOW()`,
      [userId, deviceHash],
    );
  } catch (e) {}
}

export async function recordAction(db: Pool, a: ActionRecord) {
  try {
    await db.query(
      `INSERT INTO player_actions (user_id, table_id, hand_no, action, amount, street, response_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [a.userId, a.tableId, a.handNo, a.action, a.amount, a.street, a.responseMs],
    );
  } catch (e) {}
}

export async function detectMultiAccount(
  db: Pool,
  userId: number,
  tableId: number,
): Promise<{ suspicious: boolean; severity: number; evidence: any }> {
  const res = await db.query(
    `SELECT ui2.user_id, ui.ip, COUNT(DISTINCT pa.hand_no) as shared_hands
     FROM user_ips ui
     JOIN user_ips ui2 ON ui2.ip = ui.ip AND ui2.user_id != ui.user_id
     JOIN player_actions pa ON pa.user_id = ui2.user_id AND pa.table_id = $1
     WHERE ui.user_id = $2 AND ui.last_seen > NOW() - INTERVAL '2 hours'
     GROUP BY ui2.user_id, ui.ip
     HAVING COUNT(DISTINCT pa.hand_no) >= $3`,
    [tableId, userId, THRESHOLDS.sameIpTablesTogether],
  );

  if (res.rows.length > 0) {
    const suspects = res.rows.map((r) => ({
      userId: r.user_id,
      ip: r.ip,
      sharedHands: r.shared_hands,
    }));
    return { suspicious: true, severity: 8, evidence: { suspects } };
  }

  const devRes = await db.query(
    `SELECT ud2.user_id, ud.device_hash, COUNT(DISTINCT pa.hand_no) as shared_hands
     FROM user_devices ud
     JOIN user_devices ud2 ON ud2.device_hash = ud.device_hash AND ud2.user_id != ud.user_id
     JOIN player_actions pa ON pa.user_id = ud2.user_id AND pa.table_id = $1
     WHERE ud.user_id = $2 AND ud.last_seen > NOW() - INTERVAL '2 hours'
     GROUP BY ud2.user_id, ud.device_hash
     HAVING COUNT(DISTINCT pa.hand_no) >= $3`,
    [tableId, userId, THRESHOLDS.sameDeviceTablesTogether],
  );

  if (devRes.rows.length > 0) {
    return { suspicious: true, severity: 10, evidence: { devices: devRes.rows } };
  }

  return { suspicious: false, severity: 0, evidence: {} };
}

export async function detectBot(
  db: Pool,
  userId: number,
): Promise<{
  suspicious: boolean;
  severity: number;
  evidence: any;
}> {
  const res = await db.query(
    `SELECT response_ms FROM player_actions
     WHERE user_id = $1 AND response_ms IS NOT NULL
     ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );

  if (res.rows.length < 15) return { suspicious: false, severity: 0, evidence: {} };

  const times = res.rows.map((r) => r.response_ms);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / times.length;
  const stdDev = Math.sqrt(variance);
  const fastCount = times.filter((t) => t < THRESHOLDS.botFastActionMs).length;

  if (fastCount >= THRESHOLDS.botFastActionCount) {
    return {
      suspicious: true,
      severity: 7,
      evidence: { fastCount, avgMs: Math.round(avg), stdDev: Math.round(stdDev) },
    };
  }
  if (stdDev < THRESHOLDS.botStdDevMs && avg < 1500) {
    return {
      suspicious: true,
      severity: 6,
      evidence: { avgMs: Math.round(avg), stdDev: Math.round(stdDev) },
    };
  }

  return { suspicious: false, severity: 0, evidence: {} };
}

export async function detectChipDumping(
  db: Pool,
  userId: number,
): Promise<{ suspicious: boolean; severity: number; evidence: any }> {
  const res = await db.query(
    `SELECT user_a, user_b, hands_together, chips_net_flow
     FROM player_pairs
     WHERE (user_a = $1 OR user_b = $1)
       AND hands_together >= $2
       AND ABS(chips_net_flow) > 100
     ORDER BY ABS(chips_net_flow) DESC LIMIT 5`,
    [userId, THRESHOLDS.minHandsTogether],
  );

  for (const row of res.rows) {
    const other = row.user_a === userId ? row.user_b : row.user_a;
    const netFromMe = row.user_a === userId ? row.chips_net_flow : -row.chips_net_flow;
    if (netFromMe > 0) {
      const ratio = netFromMe / Math.abs(row.chips_net_flow);
      if (ratio >= THRESHOLDS.chipDumpingThreshold) {
        return {
          suspicious: true,
          severity: 9,
          evidence: {
            otherUserId: other,
            handsTogether: row.hands_together,
            chipsTransferred: Math.round(netFromMe * 100) / 100,
            ratio: Math.round(ratio * 100) / 100,
          },
        };
      }
    }
  }

  return { suspicious: false, severity: 0, evidence: {} };
}

export async function reportSuspicious(
  db: Pool,
  userId: number,
  otherUserId: number | null,
  type: string,
  severity: number,
  evidence: any,
) {
  try {
    const existing = await db.query(
      `SELECT id FROM suspicious_events
       WHERE user_id = $1 AND type = $2 AND resolved = FALSE
         AND created_at > NOW() - INTERVAL '24 hours'
       LIMIT 1`,
      [userId, type],
    );
    if (existing.rows.length > 0) return;

    await db.query(
      `INSERT INTO suspicious_events (user_id, other_user_id, type, severity, evidence)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, otherUserId, type, severity, JSON.stringify(evidence)],
    );

    console.log(`[anti-cheat] 🚨 ${type} detected for user ${userId} (severity ${severity})`);
    await updateRiskScore(db, userId);
  } catch (e) {
    console.error('[anti-cheat] reportSuspicious error', e);
  }
}

export async function updateRiskScore(db: Pool, userId: number): Promise<number> {
  const events = await db.query(
    `SELECT type, severity FROM suspicious_events
     WHERE user_id = $1 AND resolved = FALSE AND created_at > NOW() - INTERVAL '30 days'`,
    [userId],
  );

  let score = 0;
  const flags: Record<string, number> = {};
  for (const e of events.rows) {
    score += e.severity * 5;
    flags[e.type] = (flags[e.type] || 0) + e.severity;
  }
  score = Math.min(score, 100);

  let action = 'none';
  if (score >= THRESHOLDS.banScore) action = 'ban';
  else if (score >= THRESHOLDS.shadowbanScore) action = 'shadowban';
  else if (score >= THRESHOLDS.warnScore) action = 'warn';

  try {
    await db.query(
      `INSERT INTO player_risk (user_id, score, flags, action_taken, last_updated)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET score = $2, flags = $3, action_taken = $4, last_updated = NOW()`,
      [userId, score, JSON.stringify(flags), action],
    );
    if (action === 'ban') {
      await db.query('UPDATE users SET is_banned = TRUE WHERE id = $1', [userId]);
      console.log(`[anti-cheat] 🚫 user ${userId} auto-banned (score ${score})`);
    }
  } catch (e) {}

  return score;
}

export async function analyzeUser(db: Pool, userId: number, tableId: number): Promise<void> {
  try {
    const [multi, bot, dump] = await Promise.all([
      detectMultiAccount(db, userId, tableId),
      detectBot(db, userId),
      detectChipDumping(db, userId),
    ]);

    if (multi.suspicious) {
      await reportSuspicious(
        db,
        userId,
        multi.evidence?.suspects?.[0]?.userId ?? null,
        'multi_account',
        multi.severity,
        multi.evidence,
      );
    }
    if (bot.suspicious) {
      await reportSuspicious(db, userId, null, 'bot', bot.severity, bot.evidence);
    }
    if (dump.suspicious) {
      await reportSuspicious(
        db,
        userId,
        dump.evidence?.otherUserId ?? null,
        'chip_dumping',
        dump.severity,
        dump.evidence,
      );
    }
  } catch (e) {
    console.error('[anti-cheat] analyzeUser error', e);
  }
}

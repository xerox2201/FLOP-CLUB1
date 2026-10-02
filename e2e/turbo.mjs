import fs from "fs"; import pg from "pg";
const env = {}; for (const l of fs.readFileSync(".env","utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); }
const db = new pg.Pool({ connectionString: env.DATABASE_URL });
for (const sp of ["turbo","fast","blitz","express"]) { try { const r = await db.query("UPDATE poker_tables SET speed=$1 WHERE id=16 RETURNING speed",[sp]); console.log("speed set to", r.rows[0].speed); break; } catch(e){ console.log(sp, "->", e.message.slice(0,60)); } }
const row = await db.query("SELECT id,name,seats,speed,mode,blinds FROM poker_tables WHERE id=16"); console.log(row.rows[0]);
await db.end();

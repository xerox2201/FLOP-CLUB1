<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { serverOffset } from '../lib/serverTime';

  let nowClient = Date.now();
  let timer: any = null;
  let tz = 'UTC';

  onMount(() => {
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {}

    timer = setInterval(() => {
      nowClient = Date.now();
    }, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  $: nowServer = nowClient + $serverOffset;

  function fmt(ms: number, timeZone: string): { time: string; date: string } {
    const d = new Date(ms);
    const time = d.toLocaleTimeString('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const date = d.toLocaleDateString('en-GB', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return { time, date };
  }

  $: utc = fmt(nowServer, 'UTC');
  $: local = fmt(nowServer, tz);
  $: offsetLabel = (() => {
    try {
      const d = new Date(nowServer);
      // Get offset in minutes by comparing UTC and local parts
      const utcMs = Date.UTC(
        d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes(),
      );
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }).formatToParts(d);
      const get = (t: string) => Number(parts.find(p => p.type === t)?.value || 0);
      const locMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
      const diffMin = Math.round((locMs - utcMs) / 60000);
      const sign = diffMin >= 0 ? '+' : '-';
      const abs = Math.abs(diffMin);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${m.toString().padStart(2, '0')}`;
    } catch {
      return 'UTC';
    }
  })();
</script>

<div
  class="mx-4 rounded-2xl p-3 mb-3 grid grid-cols-2 gap-3"
  style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
>
  <!-- UTC Clock -->
  <div class="flex items-center gap-2.5">
    <div
      class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
      style="background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.4);"
    >
      🌍
    </div>
    <div class="min-w-0">
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold leading-none mb-1">
        UTC Global
      </p>
      <p class="text-[15px] font-extrabold text-white tabular-nums leading-none">
        {utc.time}
      </p>
      <p class="text-[9px] text-white/40 leading-none mt-1">{utc.date}</p>
    </div>
  </div>

  <!-- Local Clock -->
  <div class="flex items-center gap-2.5">
    <div
      class="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
      style="background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.4);"
    >
      📍
    </div>
    <div class="min-w-0">
      <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold leading-none mb-1 truncate">
        Local ({offsetLabel})
      </p>
      <p class="text-[15px] font-extrabold text-gold tabular-nums leading-none">
        {local.time}
      </p>
      <p class="text-[9px] text-white/40 leading-none mt-1 truncate">{local.date}</p>
    </div>
  </div>
</div>
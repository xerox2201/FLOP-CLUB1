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
  $: offsetHrs = (() => {
    try {
      const d = new Date(nowServer);
      const utcH = d.getUTCHours();
      const locH = parseInt(
        d.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }),
        10,
      );
      const diff = ((locH - utcH + 12 + 24) % 24) - 12;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    } catch {
      return '0';
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
        Local (UTC{offsetHrs})
      </p>
      <p class="text-[15px] font-extrabold text-gold tabular-nums leading-none">
        {local.time}
      </p>
      <p class="text-[9px] text-white/40 leading-none mt-1 truncate">{local.date}</p>
    </div>
  </div>
</div>
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { serverOffset } from '../lib/serverTime';
  import Icon from './Icon.svelte';

  let nowClient = Date.now();
  let timer: any = null;
  let tz = 'UTC';

  onMount(() => {
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      // silent — Intl unavailable, keep UTC
    }

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

  function fmt(ms: number, timeZone: string): { time: string; date: string; year: string } {
    const d = new Date(ms);
    const time = d.toLocaleTimeString('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const date = d.toLocaleDateString('en-US', {
      timeZone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const year = d.toLocaleDateString('en-US', {
      timeZone,
      year: 'numeric',
    });
    return { time, date, year };
  }

  $: utc = fmt(nowServer, 'UTC');
  $: local = fmt(nowServer, tz);

  $: offsetLabel = (() => {
    try {
      const d = new Date(nowServer);
      const utcMs = Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
      );
      const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || 0);
      const locMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
      const diffMin = Math.round((locMs - utcMs) / 60000);
      const sign = diffMin >= 0 ? '+' : '−';
      const abs = Math.abs(diffMin);
      const h = Math.floor(abs / 60);
      const m = abs % 60;
      return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${m.toString().padStart(2, '0')}`;
    } catch {
      return 'UTC';
    }
  })();

  $: sameDate = utc.date === local.date;
</script>

<div class="px-4 mb-3">
  <div
    class="rounded-2xl relative overflow-hidden"
    style="
      background:
        radial-gradient(ellipse at 0% 0%, rgba(96,165,250,0.12) 0%, transparent 60%),
        radial-gradient(ellipse at 100% 100%, rgba(212,175,55,0.1) 0%, transparent 60%),
        linear-gradient(135deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
      border: 1px solid rgba(96,165,250,0.25);
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05);
    "
  >
    <!-- Top gold-blue divider -->
    <div
      class="h-px w-full"
      style="background: linear-gradient(90deg, transparent, rgba(96,165,250,0.5), rgba(212,175,55,0.5), transparent);"
    ></div>

    <div class="grid grid-cols-2">
      <!-- UTC -->
      <div
        class="px-3 py-2.5 flex items-center gap-2.5"
        style="border-right: 1px solid rgba(255,255,255,0.06);"
      >
        <div
          class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.4);"
        >
          <Icon name="clock" size={14} color="#60a5fa" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-[9px] font-extrabold text-blue-300 uppercase tracking-wider">
              UTC
            </span>
            <span
              class="w-1 h-1 rounded-full bg-blue-400 animate-pulse"
              style="box-shadow: 0 0 4px #60a5fa;"
            ></span>
          </div>
          <p class="text-[15px] font-extrabold text-white tabular-nums leading-none tracking-tight">
            {utc.time}
          </p>
          <p class="text-[9px] text-white/45 font-bold mt-0.5 truncate">{utc.date}</p>
        </div>
      </div>

      <!-- Local -->
      <div class="px-3 py-2.5 flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(212,175,55,0.15); border: 1px solid rgba(212,175,55,0.4);"
        >
          <Icon name="target" size={14} color="#f4c95d" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 mb-0.5">
            <span class="text-[9px] font-extrabold text-gold uppercase tracking-wider truncate">
              {offsetLabel}
            </span>
            <span
              class="w-1 h-1 rounded-full bg-amber-400 animate-pulse"
              style="box-shadow: 0 0 4px #f4c95d;"
            ></span>
          </div>
          <p class="text-[15px] font-extrabold text-white tabular-nums leading-none tracking-tight">
            {local.time}
          </p>
          <p class="text-[9px] text-white/45 font-bold mt-0.5 truncate">{local.date}</p>
        </div>
      </div>
    </div>

    <!-- Bottom date strip -->
    <div
      class="px-3 py-1.5 flex items-center justify-center gap-1.5"
      style="
        border-top: 1px solid rgba(255,255,255,0.05);
        background: rgba(0,0,0,0.18);
      "
    >
      <Icon name="calendar" size={9} color="rgba(255,255,255,0.35)" />
      <span class="text-[9px] text-white/45 font-bold tracking-wide">
        {sameDate ? utc.date : `${utc.date} · ${local.date}`} · {utc.year}
      </span>
    </div>
  </div>
</div>

<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { api } from '../lib/api';
  import { t, lang } from '../i18n';

  type EventItem = {
    id: string;
    title: string;
    description: string;
    startsAt: string;
    prize: number;
    image?: string;
  };

  let events: EventItem[] = [];
  let loading = true;
  let selected: EventItem | null = null;

  onMount(async () => {
    try {
      const res = await api.request('/api/events');
      if (res.ok && res.data) events = (res.data as any).events || [];
    } catch (e) {
      console.error('[Events] load failed', e);
      events = [];
    } finally {
      loading = false;
    }
  });

  function openDetail(ev: EventItem) {
    selected = ev;
  }

  function closeDetail() {
    selected = null;
  }

  function formatDate(iso: string) {
    const locale =
      $lang === 'fa'
        ? 'fa-IR'
        : $lang === 'ar'
          ? 'ar-SA'
          : $lang === 'tr'
            ? 'tr-TR'
            : $lang === 'ru'
              ? 'ru-RU'
              : $lang === 'zh'
                ? 'zh-CN'
                : 'en-US';
    return new Date(iso).toLocaleString(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // Safe date label — never breaks the layout when a date is missing/invalid.
  function dateLabel(iso: string): string {
    if (!iso) return 'Schedule to be announced';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return 'Schedule to be announced';
      return formatDate(iso);
    } catch {
      return 'Schedule to be announced';
    }
  }

  // The API row may arrive as camelCase (startsAt/prize) or snake_case
  // (starts_at/prize_pool_usd) — accept both so the schedule never renders blank.
  function startOf(ev: any): string {
    return ev?.startsAt ?? ev?.starts_at ?? '';
  }

  function prizeOf(ev: any): number {
    return Number(ev?.prize ?? ev?.prize_pool_usd ?? 0);
  }

  function startMs(ev: any): number {
    const ts = new Date(startOf(ev)).getTime();
    return isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
  }

  // ─── Summary ───
  $: totalPrize = events.reduce((s, e) => s + prizeOf(e), 0);
  $: nextEvent =
    events.length > 0 ? events.reduce((a, b) => (startMs(b) < startMs(a) ? b : a)) : null;
  $: nextLabel = nextEvent && isFinite(startMs(nextEvent)) ? dateLabel(startOf(nextEvent)) : 'TBA';
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <TopBar />

  <!-- ============ HERO ============ -->
  <div class="flex items-center gap-3 mt-2 mb-4">
    <div
      class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
      style="
        background: radial-gradient(circle at 30% 30%, rgba(34,211,238,0.35), rgba(14,116,144,0.1));
        border: 1.5px solid rgba(34,211,238,0.5);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), 0 0 20px rgba(34,211,238,0.18);
      "
    >
      <Icon name="calendar" size={24} color="#67e8f9" />
    </div>

    <div class="flex-1 min-w-0">
      <h1
        class="text-[26px] font-extrabold leading-none tracking-tight"
        style="
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 50%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 2px 8px rgba(244,201,93,0.35));
        "
      >
        {$t('events.title')}
      </h1>
      <p class="text-[10px] text-white/45 mt-1 font-bold">Sit and Go schedule and prize pools</p>
    </div>

    <div
      class="rounded-2xl px-2.5 py-2 flex flex-col items-center shrink-0"
      style="
        background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.95));
        border: 1px solid rgba(212,175,55,0.3);
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      "
    >
      <span class="text-[15px] font-extrabold text-gold tabular-nums leading-none">
        {events.length}
      </span>
      <span class="text-[7px] text-white/45 font-bold uppercase tracking-wider mt-1 leading-none">
        live
      </span>
    </div>
  </div>

  <!-- ============ SUMMARY ============ -->
  {#if loading}
    <div class="grid grid-cols-3 gap-2 mb-4">
      {#each Array(3) as _}
        <div
          class="rounded-2xl p-3"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
            border: 1px solid rgba(212,175,55,0.1);
          "
        >
          <div class="h-4 w-4 rounded-lg mb-2" style="background: rgba(255,255,255,0.07);"></div>
          <div class="h-4 w-10 rounded-full mb-2" style="background: rgba(255,255,255,0.08);"></div>
          <div class="h-2 w-12 rounded-full" style="background: rgba(255,255,255,0.05);"></div>
        </div>
      {/each}
    </div>
  {:else if events.length > 0}
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.14) 0%, transparent 62%),
            linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
          border: 1px solid rgba(34,211,238,0.28);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(34,211,238,0.2); border: 1px solid rgba(34,211,238,0.4);"
          >
            <Icon name="calendar" size={11} color="#22d3ee" />
          </div>
          <span class="text-[9px] font-extrabold uppercase tracking-wider" style="color: #67e8f9;">
            Events
          </span>
        </div>
        <p class="text-[18px] font-extrabold text-white tabular-nums leading-none">
          {events.length}
        </p>
        <p class="text-[8px] text-white/40 font-bold mt-1 uppercase tracking-wider">scheduled</p>
      </div>

      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(16,185,129,0.14) 0%, transparent 62%),
            linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
          border: 1px solid rgba(16,185,129,0.28);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4);"
          >
            <Icon name="clock" size={11} color="#6ee7b7" />
          </div>
          <span class="text-[9px] font-extrabold text-emerald-300 uppercase tracking-wider">
            Next
          </span>
        </div>
        <p class="text-[11px] font-extrabold text-white truncate leading-tight">{nextLabel}</p>
        <p class="text-[8px] text-white/40 font-bold mt-1 uppercase tracking-wider">start time</p>
      </div>

      <div
        class="rounded-2xl p-3 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.16) 0%, transparent 62%),
            linear-gradient(180deg, rgba(15,31,58,0.88), rgba(7,14,27,0.95));
          border: 1px solid rgba(244,201,93,0.3);
          box-shadow: 0 4px 14px rgba(0,0,0,0.4);
        "
      >
        <div class="flex items-center gap-1.5 mb-2">
          <div
            class="w-6 h-6 rounded-lg flex items-center justify-center"
            style="background: rgba(244,201,93,0.2); border: 1px solid rgba(244,201,93,0.45);"
          >
            <Icon name="trophy" size={11} color="#f4c95d" />
          </div>
          <span class="text-[9px] font-extrabold text-gold uppercase tracking-wider">Prizes</span>
        </div>
        <p class="text-[18px] font-extrabold text-gold tabular-nums leading-none">
          {totalPrize.toLocaleString()}
        </p>
        <p class="text-[8px] text-white/40 font-bold mt-1 uppercase tracking-wider">TON total</p>
      </div>
    </div>
  {/if}

  <!-- ============ LIST ============ -->
  {#if loading}
    <div class="space-y-2">
      {#each Array(4) as _}
        <div
          class="rounded-2xl p-3 flex items-center gap-3"
          style="
            background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
            border: 1px solid rgba(212,175,55,0.1);
          "
        >
          <div
            class="w-14 h-14 rounded-xl shrink-0"
            style="background: rgba(255,255,255,0.06);"
          ></div>
          <div class="flex-1 min-w-0">
            <div class="h-3 rounded-full mb-2" style="background: rgba(255,255,255,0.08);"></div>
            <div class="h-2.5 w-2/3 rounded-full" style="background: rgba(255,255,255,0.05);"></div>
          </div>
          <div
            class="w-12 h-3 rounded-full shrink-0"
            style="background: rgba(255,255,255,0.07);"
          ></div>
        </div>
      {/each}
    </div>
  {:else if events.length === 0}
    <div
      class="rounded-2xl p-8 text-center relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.12) 0%, transparent 62%),
          linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85));
        border: 1px dashed rgba(212,175,55,0.3);
      "
    >
      <div
        class="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style="
          background: radial-gradient(circle at 30% 30%, rgba(34,211,238,0.28), rgba(14,116,144,0.08));
          border: 1px solid rgba(34,211,238,0.4);
          box-shadow: 0 6px 20px rgba(0,0,0,0.45), 0 0 20px rgba(34,211,238,0.15);
        "
      >
        <Icon name="calendar" size={28} color="#67e8f9" />
      </div>
      <p class="text-sm font-extrabold text-white">{$t('events.noEvents')}</p>
      <p class="text-[11px] text-white/55 mt-1 font-bold">
        New events appear here as soon as they are scheduled
      </p>
    </div>
  {:else}
    <div class="space-y-2">
      {#each events as ev (ev.id)}
        <button
          type="button"
          class="w-full rounded-2xl p-3 flex items-center gap-3 text-left relative overflow-hidden active:scale-[0.99] transition-all"
          style="
            background:
              radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.1) 0%, transparent 60%),
              linear-gradient(135deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
            border: 1px solid rgba(34,211,238,0.28);
            box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          "
          onclick={() => openDetail(ev)}
        >
          {#if ev.image}
            <img
              class="w-14 h-14 rounded-xl object-cover shrink-0"
              src={ev.image}
              alt={ev.title}
              draggable="false"
              style="border: 1px solid rgba(244,201,93,0.3);"
            />
          {:else}
            <div
              class="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style="
                background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.25), rgba(168,121,34,0.06));
                border: 1px solid rgba(244,201,93,0.35);
              "
            >
              <Icon name="ticket" size={22} color="#f4c95d" />
            </div>
          {/if}

          <div class="flex-1 min-w-0">
            <p class="text-[12px] font-extrabold text-white leading-tight truncate">{ev.title}</p>
            <div class="flex items-center gap-1 mt-1.5">
              <Icon name="clock" size={10} color="rgba(255,255,255,0.4)" />
              <span class="text-[9px] text-white/50 font-bold truncate">
                {dateLabel(startOf(ev))}
              </span>
            </div>
          </div>

          <div class="text-right shrink-0">
            <p class="text-[13px] font-extrabold text-gold tabular-nums leading-none">
              {prizeOf(ev).toLocaleString()}
            </p>
            <p class="text-[8px] text-white/40 font-bold uppercase tracking-wider mt-1">TON</p>
          </div>

          <Icon name="arrow-right" size={13} color="rgba(244,201,93,0.6)" />
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- ============ DETAIL MODAL ============ -->
{#if selected}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(2,4,10,0.72); backdrop-filter: blur(8px);"
  >
    <button
      type="button"
      class="absolute inset-0 bg-transparent border-0"
      onclick={closeDetail}
      aria-label={$t('events.close')}
    ></button>

    <div
      class="relative rounded-2xl p-4 w-full max-w-[420px] overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.16) 0%, transparent 62%),
          linear-gradient(180deg, rgba(15,31,58,0.98), rgba(7,14,27,0.99));
        border: 1.5px solid rgba(244,201,93,0.4);
        box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 32px rgba(244,201,93,0.15);
      "
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <div class="flex items-start gap-3 mb-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: radial-gradient(circle at 30% 30%, rgba(244,201,93,0.3), rgba(168,121,34,0.08));
            border: 1px solid rgba(244,201,93,0.45);
          "
        >
          <Icon name="ticket" size={18} color="#f4c95d" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[14px] font-extrabold text-white leading-tight">{selected.title}</p>
          <div class="flex items-center gap-1 mt-1">
            <Icon name="clock" size={10} color="rgba(255,255,255,0.4)" />
            <span class="text-[10px] text-white/50 font-bold">
              {dateLabel(startOf(selected))}
            </span>
          </div>
        </div>
        <button
          type="button"
          class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 active:scale-95"
          style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);"
          onclick={closeDetail}
          aria-label={$t('events.close')}
        >
          <Icon name="close" size={12} color="rgba(255,255,255,0.7)" />
        </button>
      </div>

      {#if selected.description}
        <p class="text-[11px] text-white/70 leading-relaxed mb-3">{selected.description}</p>
      {/if}

      <div
        class="rounded-xl p-3 mb-4 flex items-center justify-between"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(244,201,93,0.25);"
      >
        <div class="flex items-center gap-1.5">
          <Icon name="trophy" size={12} color="#f4c95d" />
          <span class="text-[10px] font-extrabold text-gold/80 uppercase tracking-wider">
            {$t('events.prize')}
          </span>
        </div>
        <span class="text-[14px] font-extrabold text-gold tabular-nums">
          {prizeOf(selected).toLocaleString()} TON
        </span>
      </div>

      <button
        type="button"
        class="w-full rounded-xl py-2.5 text-[12px] font-extrabold active:scale-[0.98] transition"
        style="
          background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
          color: #0a0800;
          box-shadow: 0 4px 0 #7a560a, 0 8px 24px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.5);
        "
        onclick={closeDetail}
      >
        {$t('events.close')}
      </button>
    </div>
  </div>
{/if}

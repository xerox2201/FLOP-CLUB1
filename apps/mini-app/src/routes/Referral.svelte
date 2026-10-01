<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onNavigate: (page: any) => void = () => {};
  export let onBack: () => void = () => {};

  let loading = true;
  let error = '';
  let dashboard: any = null;
  let copied = false;

  const RATE_CARD = [
    { key: 'direct', label: 'Direct', color: '#f4c95d' },
    { key: 'indirect', label: 'Indirect', color: '#a78bfa' },
    { key: 'group', label: 'Group', color: '#22d3ee' },
  ];

  const SUBPAGES = [
    {
      id: 'referral-team',
      label: 'My Team',
      sub: 'Friends & indirect',
      icon: 'users',
      color: '#f4c95d',
    },
    {
      id: 'referral-leaderboard',
      label: 'Leaderboard',
      sub: 'Top referrers',
      icon: 'trophy',
      color: '#f4c95d',
    },
    {
      id: 'referral-milestones',
      label: 'Milestones',
      sub: 'Unlock rewards',
      icon: 'target',
      color: '#a78bfa',
    },
    {
      id: 'referral-affiliate',
      label: 'Groups',
      sub: 'Group & channel',
      icon: 'broadcast',
      color: '#22d3ee',
    },
    {
      id: 'referral-history',
      label: 'History',
      sub: 'Earnings log',
      icon: 'receipt',
      color: '#6ee7b7',
    },
  ];

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      const diff = Date.now() - d.getTime();
      const min = Math.floor(diff / 60000);
      if (min < 1) return 'Just now';
      if (min < 60) return `${min}m ago`;
      const h = Math.floor(min / 60);
      if (h < 24) return `${h}h ago`;
      const days = Math.floor(h / 24);
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<any>('/api/referral/me');
      if (res.ok && res.data) dashboard = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function copyLink() {
    if (!dashboard?.shareLink) return;
    try {
      await navigator.clipboard.writeText(dashboard.shareLink);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch {
      // clipboard may be blocked by browser policy — silent is OK
    }
  }

  function shareToTelegram() {
    if (!dashboard?.shareLink) return;
    const text = encodeURIComponent('Join me on Flop Club - earn 52% rakeback on every hand!');
    const url = encodeURIComponent(dashboard.shareLink);
    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  }

  onMount(load);
</script>

<div class="pb-28">
  <TopBar />

  <div class="flex items-center gap-3 mt-3 mb-4 px-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95"
      style="background: linear-gradient(180deg, rgba(30,58,138,0.4), rgba(15,31,58,0.7)); border: 1.5px solid rgba(96,165,250,0.3);"
    >
      <Icon name="arrow-left" size={18} color="#ffffff" />
    </button>
    <h1 class="text-xl font-extrabold text-white flex-1 flex items-center gap-2">
      <Icon name="users" size={22} color="#f4c95d" />
      <span>Referral</span>
    </h1>
  </div>

  {#if loading}
    <div class="px-4 space-y-3">
      {#each Array(4) as _}
        <div
          class="rounded-2xl h-[110px]"
          style="background: rgba(15,31,58,0.6); border: 1px solid rgba(212,175,55,0.1);"
        ></div>
      {/each}
    </div>
  {:else if error}
    <div
      class="mx-4 rounded-2xl p-4 text-center"
      style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
    >
      <p class="text-sm text-red-300 font-bold">{error}</p>
      <button on:click={load} class="mt-2 text-[11px] text-gold font-bold">Retry</button>
    </div>
  {:else if dashboard}
    <!-- HERO -->
    <div class="px-4 mb-3">
      <div
        class="rounded-3xl p-5 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(244,201,93,0.28) 0%, transparent 60%),
            radial-gradient(ellipse at 0% 100%, rgba(139,92,246,0.15) 0%, transparent 60%),
            linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
          border: 1.5px solid rgba(244,201,93,0.45);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(244,201,93,0.15);
        "
      >
        <div
          class="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-25 pointer-events-none"
          style="background: radial-gradient(circle, #f4c95d, transparent 70%);"
        ></div>

        <div class="relative">
          <p class="text-[10px] uppercase tracking-widest text-gold/80 font-bold mb-1">
            Lifetime Earnings
          </p>
          <div class="flex items-baseline gap-2 mb-3">
            <span
              class="text-5xl font-extrabold tabular-nums leading-none"
              style="
                background: linear-gradient(180deg, #f4e5a8, #f4c95d 45%, #a87a15);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -0.03em;
                filter: drop-shadow(0 0 20px rgba(244,201,93,0.3));
              "
            >
              ${fmt(dashboard.lifetime)}
            </span>
          </div>

          <div
            class="grid grid-cols-3 gap-2 pt-3"
            style="border-top: 1px solid rgba(244,201,93,0.2);"
          >
            <div>
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">This Month</p>
              <p class="text-base font-extrabold text-emerald-400 tabular-nums leading-none">
                ${fmt(dashboard.thisMonth)}
              </p>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 8px;">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Active</p>
              <p class="text-base font-extrabold text-white tabular-nums leading-none">
                {dashboard.activeRefs}
              </p>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 8px;">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Total</p>
              <p class="text-base font-extrabold text-white tabular-nums leading-none">
                {dashboard.totalRefs}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- SHARE -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(212,175,55,0.3);"
      >
        <div class="flex items-center gap-2 mb-2">
          <Icon name="send" size={14} color="#f4c95d" />
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold flex-1">
            Your Referral Link
          </p>
        </div>

        <div
          class="rounded-xl p-2.5 mb-2.5 font-mono text-[10px] text-white/85 break-all leading-relaxed"
          style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06);"
        >
          {dashboard.shareLink}
        </div>

        <div class="flex gap-2">
          <button
            on:click={copyLink}
            class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 flex items-center justify-center gap-1.5"
            style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.4); color: #c4b5fd;"
          >
            <Icon name="copy" size={13} color="#c4b5fd" />
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            on:click={shareToTelegram}
            class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 flex items-center justify-center gap-1.5"
            style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800; box-shadow: 0 3px 0 #7a560a;"
          >
            <Icon name="send" size={13} color="#0a0800" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>

    <!-- RATE CARD -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(212,175,55,0.3);"
      >
        <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-3">
          Your Rates
        </p>
        <div class="grid grid-cols-3 gap-2">
          {#each RATE_CARD as r}
            <div
              class="rounded-xl p-2.5 text-center"
              style="background: rgba(0,0,0,0.35); border: 1px solid {r.color}40;"
            >
              <p class="text-[9px] uppercase font-bold mb-1" style="color: {r.color};">
                {r.label}
              </p>
              <p class="text-xl font-extrabold tabular-nums" style="color: {r.color};">
                {Math.round(
                  (r.key === 'direct'
                    ? dashboard.directRate
                    : r.key === 'indirect'
                      ? dashboard.indirectRate
                      : 0.08) * 100,
                )}%
              </p>
            </div>
          {/each}
        </div>
        {#if dashboard.bonusTier > 0}
          <div class="mt-2 pt-2" style="border-top: 1px solid rgba(244,201,93,0.15);">
            <p class="text-[10px] font-bold text-emerald-400 text-center">
              Active bonus: +{dashboard.bonusTier}% on direct rate
            </p>
          </div>
        {/if}
      </div>
    </div>

    <!-- AMBASSADOR -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(139,92,246,0.35);"
      >
        <div class="flex items-center gap-2 mb-2">
          <Icon name="star" size={14} color="#a78bfa" />
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-violet-300 flex-1">
            Ambassador Progress
          </p>
          <span class="text-[11px] font-extrabold text-violet-300 tabular-nums">
            {dashboard.activeRefs} / {dashboard.ambassadorTarget}
          </span>
        </div>
        <div
          class="w-full h-2 rounded-full overflow-hidden mb-2"
          style="background: rgba(0,0,0,0.5);"
        >
          <div
            class="h-full rounded-full transition-all"
            style="
              width: {dashboard.ambassadorProgress}%;
              background: linear-gradient(90deg, #c4b5fd, #8b5cf6);
              box-shadow: 0 0 10px rgba(139,92,246,0.6);
            "
          ></div>
        </div>
        <p class="text-[10px] text-white/50 leading-relaxed">
          Reach 25 active referrals to unlock +18% direct rate and access to the monthly $500
          Ambassador tournament.
        </p>
      </div>
    </div>

    <!-- QUICK LINKS -->
    <div class="px-4 mb-3">
      <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-2 px-1">
        Manage
      </p>
      <div class="grid grid-cols-2 gap-2">
        {#each SUBPAGES as p}
          <button
            on:click={() => onNavigate(p.id)}
            class="rounded-2xl p-3 flex flex-col items-start gap-1.5 active:scale-[0.97] transition-all text-left"
            style="
              background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
              border: 1px solid {p.color}35;
            "
          >
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center"
              style="background: {p.color}22; border: 1px solid {p.color}50;"
            >
              <Icon name={p.icon} size={15} color={p.color} />
            </div>
            <div>
              <p class="text-[11px] font-extrabold text-white leading-tight">{p.label}</p>
              <p class="text-[9px] text-white/45 leading-tight mt-0.5">{p.sub}</p>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- RECENT ACTIVITY -->
    <div class="px-4 mb-3">
      <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-2 px-1">
        Recent Activity
      </p>
      {#if dashboard.recentActivity.length === 0}
        <div
          class="rounded-2xl p-6 text-center"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(212,175,55,0.3);"
        >
          <div class="flex justify-center mb-3">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center"
              style="background: rgba(212,175,55,0.1); border: 1px solid rgba(212,175,55,0.3);"
            >
              <Icon name="users" size={22} color="#d4af37" />
            </div>
          </div>
          <p class="text-[12px] font-extrabold text-white">No activity yet</p>
          <p class="text-[10px] text-white/50 mt-1">Share your link to start earning</p>
        </div>
      {:else}
        <div class="space-y-1.5">
          {#each dashboard.recentActivity as a}
            <div
              class="rounded-xl px-3 py-2 flex items-center gap-2.5"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(255,255,255,0.06);"
            >
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style="background: rgba(244,201,93,0.15); border: 1px solid rgba(244,201,93,0.4);"
              >
                <Icon name="dollar" size={14} color="#f4c95d" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[11px] font-extrabold text-white truncate">{a.displayName}</p>
                <p class="text-[9px] text-white/45 mt-0.5">
                  Level {a.level} · {Math.round(a.rate * 100)}% · {fmtDate(a.paidAt)}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-[12px] font-extrabold text-emerald-400 tabular-nums">
                  +${fmt(a.amount)}
                </p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

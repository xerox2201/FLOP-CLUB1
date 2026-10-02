<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let affiliateId: number;
  export let onBack: () => void = () => {};

  let loading = true;
  let error = '';
  let data: any = null;

  function fmt(n: any, digits = 2): string {
    return Number(Number(n || 0).toFixed(digits)).toFixed(digits);
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<any>(`/api/referral/affiliate/${affiliateId}`);
      if (res.ok && res.data) data = res.data;
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function copyLink() {
    if (!data?.affiliateLink) return;
    navigator.clipboard.writeText(data.affiliateLink);
  }

  function shareLink() {
    if (!data?.affiliateLink) return;
    const text = encodeURIComponent(`Join our poker group on Flop Club!`);
    const url = encodeURIComponent(data.affiliateLink);
    const shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, '_blank');
  }

  $: maxDaily = data?.dailyEarnings?.length
    ? Math.max(...data.dailyEarnings.map((d: any) => d.earned), 1)
    : 1;

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
    <h1 class="text-base font-extrabold text-white flex-1 truncate">
      {data?.telegramGroupTitle ?? 'Group'}
    </h1>
  </div>

  {#if loading}
    <div class="px-4 space-y-3">
      {#each Array(3) as _}
        <div class="rounded-2xl h-[100px]" style="background: rgba(15,31,58,0.6);"></div>
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
  {:else if data}
    <!-- Hero -->
    <div class="px-4 mb-3">
      <div
        class="rounded-3xl p-4 relative overflow-hidden"
        style="
          background:
            radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.22) 0%, transparent 60%),
            linear-gradient(135deg, #142d52 0%, #0a1a33 60%, #05080f 100%);
          border: 1.5px solid rgba(34,211,238,0.4);
          box-shadow: 0 12px 40px rgba(0,0,0,0.6), 0 0 40px rgba(34,211,238,0.15);
        "
      >
        <div class="relative">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style="background: rgba(34,211,238,0.25); color: #67e8f9; border: 1px solid rgba(34,211,238,0.5);"
            >
              {data.telegramGroupType}
            </span>
            {#if data.isVerified}
              <span
                class="text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1"
                style="background: rgba(16,185,129,0.2); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.4);"
              >
                <Icon name="check" size={9} color="#6ee7b7" />
                <span>Verified</span>
              </span>
            {/if}
            <span class="ml-auto text-[10px] font-extrabold text-cyan-300 tabular-nums">
              {Math.round(data.ratePct * 100)}%
            </span>
          </div>

          <p class="text-[10px] uppercase tracking-widest text-cyan-300/80 font-bold mb-1">
            Total Earned
          </p>
          <p class="text-4xl font-extrabold tabular-nums leading-none text-emerald-400 mb-3">
            ${fmt(data.totalEarnings)}
          </p>

          <div
            class="grid grid-cols-3 gap-2 pt-3"
            style="border-top: 1px solid rgba(255,255,255,0.1);"
          >
            <div>
              <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Members</p>
              <p class="text-base font-extrabold text-white tabular-nums leading-none">
                {data.totalMembers}
              </p>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 8px;">
              <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Active</p>
              <p class="text-base font-extrabold text-cyan-300 tabular-nums leading-none">
                {data.activeMembers}
              </p>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.06); padding-left: 8px;">
              <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Group rake</p>
              <p class="text-base font-extrabold text-white/85 tabular-nums leading-none">
                ${fmt(data.totalGroupRake, 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Link -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(34,211,238,0.3);"
      >
        <p class="text-[10px] uppercase tracking-widest text-cyan-300/80 font-bold mb-2">
          Group Link
        </p>
        <div
          class="rounded-xl p-2.5 mb-2 font-mono text-[10px] text-white/85 break-all"
          style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06);"
        >
          {data.affiliateLink}
        </div>
        <div class="flex gap-2">
          <button
            on:click={copyLink}
            class="flex-1 rounded-xl py-2 text-[10px] font-extrabold active:scale-95 flex items-center justify-center gap-1.5"
            style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.4); color: #93c5fd;"
          >
            <Icon name="copy" size={12} color="#93c5fd" />
            <span>Copy</span>
          </button>
          <button
            on:click={shareLink}
            class="flex-1 rounded-xl py-2 text-[10px] font-extrabold active:scale-95 flex items-center justify-center gap-1.5"
            style="background: linear-gradient(180deg, #22d3ee, #0891b2); color: #ffffff; box-shadow: 0 2px 0 #155e75;"
          >
            <Icon name="send" size={12} color="#ffffff" />
            <span>Share</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Daily earnings chart -->
    {#if data.dailyEarnings.length > 0}
      <div class="px-4 mb-3">
        <p class="text-[10px] uppercase tracking-widest font-extrabold text-cyan-300/80 mb-2 px-1">
          Last 30 Days
        </p>
        <div
          class="rounded-2xl p-3"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(34,211,238,0.2);"
        >
          <div class="flex items-end gap-0.5 h-20">
            {#each data.dailyEarnings as d}
              <div
                class="flex-1 rounded-sm"
                style="
                  height: {Math.max(2, (d.earned / maxDaily) * 100)}%;
                  background: linear-gradient(180deg, #22d3ee, #0891b2);
                  box-shadow: 0 0 4px rgba(34,211,238,0.4);
                  min-height: 2px;
                "
                title="{fmtDate(d.day)}: ${fmt(d.earned)}"
              ></div>
            {/each}
          </div>
          <div class="flex justify-between mt-2 text-[9px] text-white/40 font-mono">
            <span>{fmtDate(data.dailyEarnings[0]?.day)}</span>
            <span>{fmtDate(data.dailyEarnings[data.dailyEarnings.length - 1]?.day)}</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- Top contributors -->
    {#if data.topContributors.length > 0}
      <div class="px-4 mb-3">
        <p class="text-[10px] uppercase tracking-widest font-extrabold text-cyan-300/80 mb-2 px-1">
          Top Contributors
        </p>
        <div class="space-y-1.5">
          {#each data.topContributors as c, i}
            <div
              class="rounded-xl px-3 py-2 flex items-center gap-2.5"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(255,255,255,0.06);"
            >
              <div
                class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[11px] font-extrabold"
                style="background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.6);"
              >
                #{i + 1}
              </div>
              <p class="flex-1 text-[11px] font-extrabold text-white truncate">{c.displayName}</p>
              <p class="text-[11px] font-extrabold text-cyan-300 tabular-nums">
                ${fmt(c.rakeFrom)}
              </p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Info -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-3.5"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
      >
        <div class="space-y-2 text-[11px] font-mono">
          <div class="flex justify-between">
            <span class="text-white/40">Group ID</span>
            <span class="text-white/85 tabular-nums">{data.telegramGroupId}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">Rate</span>
            <span class="text-cyan-300 font-bold">{Math.round(data.ratePct * 100)}%</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">Connected</span>
            <span class="text-white/85">{fmtDate(data.createdAt)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-white/40">Expires</span>
            <span class="text-white/85">{fmtDate(data.expiresAt)}</span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

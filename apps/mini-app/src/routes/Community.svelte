<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  let loading = true;
  let error = '';
  let community: { channel: any | null; group: any | null } = { channel: null, group: null };
  let myMembership: any = { memberships: {} };
  let openingLink: string | null = null;

  async function load() {
    loading = true;
    error = '';
    try {
      const [info, mem] = await Promise.all([
        api.request<any>('/api/community'),
        api.request<any>('/api/community/my-membership'),
      ]);
      if (info.ok && info.data) community = info.data;
      if (mem.ok && mem.data) myMembership = mem.data;
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function openLink(url: string, key: string) {
    if (!url) return;
    openingLink = key;
    try {
      // Try to open within Telegram WebApp first
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openTelegramLink && url.includes('t.me/')) {
        tg.openTelegramLink(url);
      } else if (tg?.openLink) {
        tg.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setTimeout(() => (openingLink = null), 800);
    }
  }

  function tmeUrlFromUsername(username: string | null | undefined): string | null {
    if (!username) return null;
    return `https://t.me/${username.replace('@', '')}`;
  }

  function isMember(type: 'channel' | 'group'): boolean {
    const key = type === 'channel' ? 'channel' : 'supergroup';
    const m = myMembership?.memberships?.[key] ?? myMembership?.memberships?.[type];
    return !!m?.isMember;
  }

  $: channelUrl =
    community.channel?.invite_link ?? tmeUrlFromUsername(community.channel?.username) ?? null;

  $: groupUrl =
    community.group?.invite_link ?? tmeUrlFromUsername(community.group?.username) ?? null;

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
      <Icon name="chat" size={22} color="#a78bfa" />
      <span>Community</span>
    </h1>
  </div>

  <!-- Intro -->
  <div class="px-4 mb-3">
    <div
      class="rounded-2xl p-4"
      style="background: radial-gradient(ellipse at 100% 0%, rgba(139,92,246,0.15) 0%, transparent 60%), linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(139,92,246,0.35);"
    >
      <p class="text-[12px] font-extrabold text-violet-200 mb-1">Join the Flop Club</p>
      <p class="text-[10px] text-white/60 leading-relaxed">
        Get announcements, chat with players, and share hands. Our community is on Telegram.
      </p>
    </div>
  </div>

  {#if loading}
    <div class="px-4 space-y-3">
      {#each Array(2) as _}
        <div class="rounded-2xl h-[120px]" style="background: rgba(15,31,58,0.6);"></div>
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
  {:else}
    <!-- Channel -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-4 relative overflow-hidden"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.98)); border: 1.5px solid {isMember(
          'channel',
        )
          ? 'rgba(16,185,129,0.4)'
          : 'rgba(96,165,250,0.3)'};"
      >
        <div class="flex items-start gap-3 mb-3">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style="background: radial-gradient(circle at 30% 30%, rgba(96,165,250,0.3), rgba(96,165,250,0.08)); border: 1.5px solid rgba(96,165,250,0.5);"
          >
            <Icon name="broadcast" size={22} color="#60a5fa" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-[14px] font-extrabold text-white truncate">
                {community.channel?.title ?? 'Flop Club News'}
              </p>
              {#if isMember('channel')}
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  style="background: rgba(16,185,129,0.2); color: #6ee7b7;"
                >
                  <Icon name="check" size={8} color="#6ee7b7" />
                  <span>JOINED</span>
                </span>
              {/if}
            </div>
            <p class="text-[10px] text-white/50 mt-0.5">Official announcements</p>
            {#if community.channel?.member_count > 0}
              <p class="text-[9px] text-blue-300 mt-1 font-bold">
                {community.channel.member_count.toLocaleString()} subscribers
              </p>
            {/if}
          </div>
        </div>

        {#if channelUrl}
          <button
            on:click={() => openLink(channelUrl, 'channel')}
            disabled={openingLink === 'channel'}
            class="w-full rounded-xl py-3 text-[12px] font-extrabold active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style="background: {isMember('channel')
              ? 'rgba(96,165,250,0.15)'
              : 'linear-gradient(180deg, #60a5fa, #2563eb)'}; color: {isMember('channel')
              ? '#93c5fd'
              : '#ffffff'}; border: {isMember('channel')
              ? '1px solid rgba(96,165,250,0.4)'
              : 'none'}; box-shadow: {isMember('channel') ? 'none' : '0 3px 0 #1e40af'};"
          >
            <Icon
              name={isMember('channel') ? 'check' : 'plus'}
              size={14}
              color={isMember('channel') ? '#93c5fd' : '#ffffff'}
            />
            <span>{isMember('channel') ? 'Open Channel' : 'Join Channel'}</span>
          </button>
        {:else}
          <div
            class="rounded-xl py-3 text-center text-[11px] font-bold text-white/40"
            style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(96,165,250,0.25);"
          >
            Channel coming soon
          </div>
        {/if}
      </div>
    </div>

    <!-- Group -->
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-4 relative overflow-hidden"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.98)); border: 1.5px solid {isMember(
          'group',
        )
          ? 'rgba(16,185,129,0.4)'
          : 'rgba(139,92,246,0.3)'};"
      >
        <div class="flex items-start gap-3 mb-3">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style="background: radial-gradient(circle at 30% 30%, rgba(139,92,246,0.3), rgba(139,92,246,0.08)); border: 1.5px solid rgba(139,92,246,0.5);"
          >
            <Icon name="chat" size={22} color="#a78bfa" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-[14px] font-extrabold text-white truncate">
                {community.group?.title ?? 'Flop Club Chat'}
              </p>
              {#if isMember('group')}
                <span
                  class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full flex items-center gap-1"
                  style="background: rgba(16,185,129,0.2); color: #6ee7b7;"
                >
                  <Icon name="check" size={8} color="#6ee7b7" />
                  <span>JOINED</span>
                </span>
              {/if}
            </div>
            <p class="text-[10px] text-white/50 mt-0.5">Player chat & community</p>
            {#if community.group?.member_count > 0}
              <p class="text-[9px] text-violet-300 mt-1 font-bold">
                {community.group.member_count.toLocaleString()} members
              </p>
            {/if}
          </div>
        </div>

        {#if groupUrl}
          <button
            on:click={() => openLink(groupUrl, 'group')}
            disabled={openingLink === 'group'}
            class="w-full rounded-xl py-3 text-[12px] font-extrabold active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            style="background: {isMember('group')
              ? 'rgba(139,92,246,0.15)'
              : 'linear-gradient(180deg, #a78bfa, #7c3aed)'}; color: {isMember('group')
              ? '#c4b5fd'
              : '#ffffff'}; border: {isMember('group')
              ? '1px solid rgba(139,92,246,0.4)'
              : 'none'}; box-shadow: {isMember('group') ? 'none' : '0 3px 0 #5b21b6'};"
          >
            <Icon
              name={isMember('group') ? 'check' : 'plus'}
              size={14}
              color={isMember('group') ? '#c4b5fd' : '#ffffff'}
            />
            <span>{isMember('group') ? 'Open Chat' : 'Join Chat'}</span>
          </button>
        {:else}
          <div
            class="rounded-xl py-3 text-center text-[11px] font-bold text-white/40"
            style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(139,92,246,0.25);"
          >
            Chat coming soon
          </div>
        {/if}
      </div>
    </div>

    <!-- Refresh -->
    <div class="px-4 mb-3">
      <button
        on:click={load}
        class="w-full rounded-2xl py-3 text-[11px] font-extrabold active:scale-[0.98] flex items-center justify-center gap-2"
        style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.2); color: rgba(255,255,255,0.7);"
      >
        <Icon name="refresh" size={14} color="rgba(255,255,255,0.7)" />
        <span>Refresh membership</span>
      </button>
    </div>

    <!-- Benefits -->
    <div class="px-4 mb-3">
      <p class="text-[10px] uppercase tracking-widest font-extrabold text-gold/80 mb-2 px-1">
        Why Join?
      </p>
      <div
        class="rounded-2xl overflow-hidden"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9)); border: 1px solid rgba(212,175,55,0.15);"
      >
        {#each [{ icon: 'bell', label: 'Tournament alerts', sub: 'Never miss a big event' }, { icon: 'users', label: 'Player chat', sub: 'Meet other players' }, { icon: 'gift', label: 'Exclusive promos', sub: 'Channel-only bonuses' }, { icon: 'help', label: 'Direct support', sub: 'Get help fast' }] as b, i}
          <div
            class="flex items-center gap-3 px-4 py-3"
            style="border-bottom: {i < 3 ? '1px solid rgba(212,175,55,0.08)' : 'none'};"
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style="background: rgba(244,201,93,0.12); border: 1px solid rgba(244,201,93,0.3);"
            >
              <Icon name={b.icon} size={15} color="#f4c95d" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[12px] font-bold text-white/90">{b.label}</p>
              <p class="text-[10px] text-white/45 mt-0.5">{b.sub}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

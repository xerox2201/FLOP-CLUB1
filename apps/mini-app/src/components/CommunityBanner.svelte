<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import Icon from './Icon.svelte';

  let community: { channel: any | null; group: any | null } = {
    channel: null,
    group: null,
  };
  let membership: any = { memberships: {} };
  let dismissed = false;
  let loading = true;
  let expanded = false;

  const DISMISS_KEY = 'community_banner_dismissed_v1';

  function isMember(type: 'channel' | 'group'): boolean {
    const key = type === 'channel' ? 'channel' : 'supergroup';
    const m = membership?.memberships?.[key];
    return !!m?.isMember;
  }

  $: needJoin =
    !loading &&
    (community.channel || community.group) &&
    (!isMember('channel') || !isMember('group'));

  async function load() {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      dismissed = true;
      loading = false;
      return;
    }
    try {
      const [info, mem] = await Promise.all([
        api.request<any>('/api/community'),
        api.request<any>('/api/community/my-membership'),
      ]);
      if (info.ok && info.data) community = info.data;
      if (mem.ok && mem.data) membership = mem.data;
    } catch {
      // silent — banner is optional
    } finally {
      loading = false;
    }
  }

  function dismiss() {
    dismissed = true;
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // localStorage may throw in private mode — not fatal
    }
  }

  function openLink(url: string | null | undefined) {
    if (!url) return;
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.openTelegramLink && url.includes('t.me/')) {
      tg.openTelegramLink(url);
    } else if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }

  function channelUrl(): string | null {
    const c = community.channel;
    if (!c) return null;
    if (c.invite_link) return c.invite_link;
    if (c.username) return `https://t.me/${String(c.username).replace('@', '')}`;
    return null;
  }

  function groupUrl(): string | null {
    const g = community.group;
    if (!g) return null;
    if (g.invite_link) return g.invite_link;
    if (g.username) return `https://t.me/${String(g.username).replace('@', '')}`;
    return null;
  }

  onMount(load);
</script>

{#if !dismissed && needJoin}
  <div class="px-4 mb-3">
    <div
      class="rounded-2xl relative overflow-hidden"
      style="
        background:
          radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.18) 0%, transparent 60%),
          linear-gradient(135deg, rgba(15,31,58,0.95), rgba(7,14,27,0.98));
        border: 1px solid rgba(34,211,238,0.35);
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      "
    >
      <!-- Dismiss -->
      <button
        type="button"
        on:click={dismiss}
        aria-label="Dismiss"
        class="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center z-10 active:scale-90"
        style="background: rgba(0,0,0,0.4);"
      >
        <Icon name="close" size={10} color="rgba(255,255,255,0.6)" />
      </button>

      <button
        type="button"
        on:click={() => (expanded = !expanded)}
        class="w-full text-left p-3.5 pr-10 flex items-center gap-3"
      >
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style="
            background: radial-gradient(circle at 30% 30%, rgba(34,211,238,0.3), rgba(34,211,238,0.08));
            border: 1.5px solid rgba(34,211,238,0.5);
          "
        >
          <Icon name="chat" size={18} color="#67e8f9" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-extrabold text-cyan-300 mb-0.5">Join the Flop Club</p>
          <p class="text-[10px] text-white/60 leading-tight">
            Announcements, chat & exclusive promos
          </p>
        </div>
        <div class="text-cyan-300 shrink-0">
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#67e8f9" />
        </div>
      </button>

      {#if expanded}
        <div
          class="px-3.5 pb-3.5 pt-0 flex gap-2"
          style="border-top: 1px solid rgba(34,211,238,0.15); padding-top: 10px; margin-top: 0;"
        >
          {#if community.channel && !isMember('channel')}
            <button
              type="button"
              on:click={() => openLink(channelUrl())}
              class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 flex items-center justify-center gap-1.5"
              style="background: linear-gradient(180deg, #60a5fa, #2563eb); color: #ffffff; box-shadow: 0 2px 0 #1e40af;"
            >
              <Icon name="broadcast" size={12} color="#ffffff" />
              <span>Join Channel</span>
            </button>
          {/if}
          {#if community.group && !isMember('group')}
            <button
              type="button"
              on:click={() => openLink(groupUrl())}
              class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 flex items-center justify-center gap-1.5"
              style="background: linear-gradient(180deg, #a78bfa, #7c3aed); color: #ffffff; box-shadow: 0 2px 0 #5b21b6;"
            >
              <Icon name="chat" size={12} color="#ffffff" />
              <span>Join Chat</span>
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

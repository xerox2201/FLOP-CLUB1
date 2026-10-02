<script lang="ts">
  import { formatAmount } from '../lib/format';
  import { onMount } from 'svelte';
  import { api } from '../lib/api';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};
  export let onNavigate: (page: any) => void = () => {};

  let loading = true;
  let error = '';
  let affiliates: any[] = [];
  let showForm = false;
  let submitting = false;
  let formError = '';
  let toast = '';

  let form = {
    telegramGroupId: '',
    telegramGroupTitle: '',
    telegramGroupType: 'supergroup' as 'group' | 'supergroup' | 'channel',
    inviteLink: '',
  };

  function fmt(n: any, digits = 2): string {
    return formatAmount(n, digits);
  }

  function flash(msg: string, isError = false) {
    toast = (isError ? '❌ ' : ' ') + msg;
    setTimeout(() => (toast = ''), 3000);
  }

  async function load() {
    loading = true;
    error = '';
    try {
      const res = await api.request<{ affiliates: any[] }>('/api/referral/affiliate/list');
      if (res.ok && res.data) affiliates = res.data.affiliates ?? [];
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function submit() {
    formError = '';
    if (!form.telegramGroupId.trim() || !form.telegramGroupTitle.trim()) {
      formError = 'Group ID and title are required';
      return;
    }
    const groupId = Number(form.telegramGroupId.trim());
    if (!Number.isFinite(groupId) || groupId === 0) {
      formError = 'Group ID must be a number (e.g. -1001234567890)';
      return;
    }

    submitting = true;
    try {
      const res = await api.request<{ ok: boolean; id: number; shortCode: string }>(
        '/api/referral/affiliate/register',
        {
          method: 'POST',
          body: JSON.stringify({
            telegramGroupId: groupId,
            telegramGroupTitle: form.telegramGroupTitle.trim(),
            telegramGroupType: form.telegramGroupType,
            inviteLink: form.inviteLink.trim() || undefined,
          }),
        },
      );
      if (res.ok && res.data) {
        flash(`Group registered`);
        showForm = false;
        form = {
          telegramGroupId: '',
          telegramGroupTitle: '',
          telegramGroupType: 'supergroup',
          inviteLink: '',
        };
        await load();
      } else {
        formError = res.error || 'registration_failed';
      }
    } catch (e: any) {
      formError = e.message;
    } finally {
      submitting = false;
    }
  }

  async function remove(id: number, title: string) {
    if (!confirm(`Disconnect "${title}"?\n\nYou will stop earning 8% from its members.`)) return;
    try {
      const res = await api.request(`/api/referral/affiliate/${id}`, { method: 'DELETE' });
      if (res.ok) {
        flash('Group disconnected');
        await load();
      } else {
        flash(res.error || 'delete_failed', true);
      }
    } catch (e: any) {
      flash(e.message, true);
    }
  }

  $: totalEarned = affiliates.reduce((s, a) => s + a.totalEarnings, 0);
  $: totalMembers = affiliates.reduce((s, a) => s + a.totalMembers, 0);

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
      <Icon name="broadcast" size={22} color="#22d3ee" />
      <span>Groups</span>
    </h1>
    <button
      on:click={() => (showForm = !showForm)}
      class="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-95"
      style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); box-shadow: 0 2px 0 #7a560a;"
      aria-label="Add group"
    >
      <Icon name={showForm ? 'close' : 'plus'} size={16} color="#0a0800" />
    </button>
  </div>

  <!-- Info banner -->
  <div class="px-4 mb-3">
    <div
      class="rounded-2xl p-3.5"
      style="background: radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.15) 0%, transparent 60%), linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(34,211,238,0.35);"
    >
      <div class="flex items-start gap-3">
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style="background: rgba(34,211,238,0.2); border: 1px solid rgba(34,211,238,0.5);"
        >
          <Icon name="broadcast" size={18} color="#67e8f9" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[11px] font-extrabold text-cyan-300 mb-0.5">Earn 8% from groups</p>
          <p class="text-[10px] text-white/60 leading-relaxed">
            Register your Telegram group or channel. Earn 8% of every member's rake for 12 months.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- Summary (when has affiliates) -->
  {#if !loading && affiliates.length > 0}
    <div class="px-4 mb-3">
      <div class="grid grid-cols-2 gap-2">
        <div
          class="rounded-2xl p-3 text-center"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(34,211,238,0.3);"
        >
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Members</p>
          <p class="text-xl font-extrabold text-cyan-300 tabular-nums leading-none">
            {totalMembers}
          </p>
        </div>
        <div
          class="rounded-2xl p-3 text-center"
          style="background: linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1px solid rgba(16,185,129,0.3);"
        >
          <p class="text-[9px] text-white/45 uppercase font-bold mb-1">Total Earned</p>
          <p class="text-xl font-extrabold text-emerald-400 tabular-nums leading-none">
            ${fmt(totalEarned)}
          </p>
        </div>
      </div>
    </div>
  {/if}

  <!-- Register form -->
  {#if showForm}
    <div class="px-4 mb-3">
      <div
        class="rounded-2xl p-4 space-y-3"
        style="background: linear-gradient(180deg, rgba(15,31,58,0.9), rgba(7,14,27,0.98)); border: 1.5px solid rgba(34,211,238,0.4);"
      >
        <div class="flex items-center gap-2 mb-1">
          <Icon name="plus" size={14} color="#22d3ee" />
          <p class="text-[10px] uppercase tracking-widest font-extrabold text-cyan-300">
            Register a Group
          </p>
        </div>

        <div>
          <label
            for="grp-id"
            class="text-[10px] text-white/60 font-bold uppercase tracking-wider block mb-1.5"
          >
            Group / Channel ID
          </label>
          <input
            id="grp-id"
            type="text"
            bind:value={form.telegramGroupId}
            placeholder="-1001234567890"
            class="w-full rounded-xl px-3 py-2.5 text-[12px] text-white outline-none font-mono"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(34,211,238,0.3);"
          />
          <p class="text-[9px] text-white/40 mt-1 leading-relaxed">
            Forward a message from your group to <b class="text-cyan-300">@userinfobot</b> to get
            the ID. It usually starts with <span class="font-mono">-100</span>.
          </p>
        </div>

        <div>
          <label
            for="grp-title"
            class="text-[10px] text-white/60 font-bold uppercase tracking-wider block mb-1.5"
          >
            Group Title
          </label>
          <input
            id="grp-title"
            type="text"
            bind:value={form.telegramGroupTitle}
            placeholder="e.g. Poker Iran Pro"
            class="w-full rounded-xl px-3 py-2.5 text-[12px] text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(34,211,238,0.3);"
          />
        </div>

        <div>
          <label
            for="grp-type"
            class="text-[10px] text-white/60 font-bold uppercase tracking-wider block mb-1.5"
          >
            Type
          </label>
          <select
            id="grp-type"
            bind:value={form.telegramGroupType}
            class="w-full rounded-xl px-3 py-2.5 text-[12px] text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(34,211,238,0.3);"
          >
            <option value="group">Group</option>
            <option value="supergroup">Supergroup</option>
            <option value="channel">Channel</option>
          </select>
        </div>

        <div>
          <label
            for="grp-link"
            class="text-[10px] text-white/60 font-bold uppercase tracking-wider block mb-1.5"
          >
            Invite Link <span class="text-white/30 normal-case font-normal">(optional)</span>
          </label>
          <input
            id="grp-link"
            type="text"
            bind:value={form.inviteLink}
            placeholder="https://t.me/+abc..."
            class="w-full rounded-xl px-3 py-2.5 text-[12px] text-white outline-none font-mono"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(34,211,238,0.3);"
          />
        </div>

        {#if formError}
          <div
            class="rounded-xl px-3 py-2"
            style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4);"
          >
            <p class="text-[10px] text-red-300 font-bold">{formError}</p>
          </div>
        {/if}

        <div class="flex gap-2">
          <button
            on:click={() => (showForm = false)}
            disabled={submitting}
            class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 disabled:opacity-40"
            style="background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7);"
          >
            Cancel
          </button>
          <button
            on:click={submit}
            disabled={submitting}
            class="flex-1 rounded-xl py-2.5 text-[11px] font-extrabold active:scale-95 disabled:opacity-40"
            style="background: linear-gradient(180deg, #22d3ee, #0891b2); color: #ffffff; box-shadow: 0 3px 0 #155e75;"
          >
            {submitting ? 'Registering…' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- List -->
  {#if loading}
    <div class="px-4 space-y-2">
      {#each Array(2) as _}
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
  {:else if affiliates.length === 0}
    <div
      class="mx-4 rounded-2xl p-6 text-center"
      style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.85)); border: 1px dashed rgba(34,211,238,0.3);"
    >
      <div class="flex justify-center mb-3">
        <div
          class="w-14 h-14 rounded-2xl flex items-center justify-center"
          style="background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.3);"
        >
          <Icon name="broadcast" size={24} color="#22d3ee" />
        </div>
      </div>
      <p class="text-sm font-extrabold text-white">No groups connected</p>
      <p class="text-[11px] text-white/50 mt-1 leading-relaxed max-w-[260px] mx-auto">
        Connect your Telegram group and start earning 8% of every member's rake.
      </p>
      <button
        on:click={() => (showForm = true)}
        class="mt-3 px-4 py-2 rounded-xl text-[11px] font-extrabold active:scale-95"
        style="background: linear-gradient(180deg, #22d3ee, #0891b2); color: #ffffff; box-shadow: 0 2px 0 #155e75;"
      >
        Connect Group
      </button>
    </div>
  {:else}
    <div class="px-4 space-y-2">
      {#each affiliates as a}
        <div
          class="rounded-2xl p-3.5 relative overflow-hidden"
          style="
            background:
              radial-gradient(ellipse at 100% 0%, rgba(34,211,238,0.12) 0%, transparent 60%),
              linear-gradient(180deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95));
            border: 1.5px solid {a.isActive ? 'rgba(34,211,238,0.4)' : 'rgba(107,114,128,0.3)'};
            {a.isActive ? '' : 'opacity: 0.6;'}
          "
        >
          <div class="flex items-start gap-3">
            <div
              class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style="background: rgba(34,211,238,0.2); border: 1px solid rgba(34,211,238,0.5);"
            >
              <Icon name="broadcast" size={18} color="#67e8f9" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-[13px] font-extrabold text-white truncate">{a.telegramGroupTitle}</p>
                {#if !a.isActive}
                  <span
                    class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full"
                    style="background: rgba(107,114,128,0.3); color: #9ca3af;">INACTIVE</span
                  >
                {/if}
              </div>
              <p class="text-[9px] text-cyan-300 font-mono mt-0.5">
                {a.telegramGroupType} · {Math.round(a.ratePct * 100)}%
              </p>

              <div
                class="grid grid-cols-3 gap-2 mt-2 pt-2"
                style="border-top: 1px solid rgba(255,255,255,0.06);"
              >
                <div>
                  <p class="text-[8px] text-white/40 uppercase font-bold">Members</p>
                  <p class="text-[11px] font-extrabold text-white tabular-nums">{a.totalMembers}</p>
                </div>
                <div>
                  <p class="text-[8px] text-white/40 uppercase font-bold">Rake</p>
                  <p class="text-[11px] font-extrabold text-white/85 tabular-nums">
                    ${fmt(a.totalGroupRake)}
                  </p>
                </div>
                <div class="text-right">
                  <p class="text-[8px] text-white/40 uppercase font-bold">Earned</p>
                  <p class="text-[11px] font-extrabold text-emerald-400 tabular-nums">
                    +${fmt(a.totalEarnings)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex gap-2 mt-3 pt-2.5" style="border-top: 1px solid rgba(255,255,255,0.06);">
            <button
              on:click={() => onNavigate(`referral-affiliate-detail:${a.id}`)}
              class="flex-1 rounded-lg py-1.5 text-[10px] font-extrabold active:scale-95"
              style="background: rgba(34,211,238,0.15); border: 1px solid rgba(34,211,238,0.4); color: #67e8f9;"
            >
              Details
            </button>
            <button
              on:click={() => {
                const link = a.affiliateLink;
                navigator.clipboard.writeText(link).then(() => flash('Link copied'));
              }}
              class="flex-1 rounded-lg py-1.5 text-[10px] font-extrabold active:scale-95"
              style="background: rgba(244,201,93,0.15); border: 1px solid rgba(244,201,93,0.4); color: #f4c95d;"
            >
              Copy Link
            </button>
            {#if a.isActive}
              <button
                on:click={() => remove(a.id, a.telegramGroupTitle)}
                class="rounded-lg px-3 py-1.5 text-[10px] font-extrabold active:scale-95"
                style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35); color: #fca5a5;"
                aria-label="Disconnect"
              >
                <Icon name="trash" size={11} color="#fca5a5" />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-2xl px-4 py-2.5 max-w-[90%]"
      style="background: rgba(8,13,36,0.98); border: 1px solid rgba(34,211,238,0.5); box-shadow: 0 8px 24px rgba(0,0,0,0.7);"
    >
      <p class="text-xs font-extrabold text-white">{toast}</p>
    </div>
  {/if}
</div>

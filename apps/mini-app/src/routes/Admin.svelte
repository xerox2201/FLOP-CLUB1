<script lang="ts">
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';

  export let onBack: () => void = () => {};

  const API = '';
  const STORAGE_KEY = 'admin_secret';

  let adminSecret = '';
  let authed = false;
  let loading = false;
  let error = '';
  let toast = '';

  let stats: any = null;
  let tournaments: any[] = [];
    let blindStructures: any[] = [];
  let templates: any[] = [];
  let showTemplateForm = false;
  let creatingTemplate = false;

  let tform = {
    name: '',
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'regular',
    buyIn: 0,
    fee: 0,
    startingStack: 5000,
    minPlayers: 2,
    maxPlayers: 100,
    guaranteed: 0,
    lateRegLevel: 0,
    allowReEntry: false,
    maxReEntries: 1,
    isBounty: false,
    bountyAmount: 0,
    blindStructureId: 0,
    scheduleType: 'daily' as 'hourly' | 'daily' | 'weekly',
    scheduleTime: '14:00',
    scheduleDay: 0,
  };

  let showCreate = false;
  let creating = false;

  let form = {
    name: '',
    variant: 'holdem',
    mode: 'free',
    format: 'sng',
    speed: 'regular',
    buyIn: 0,
    fee: 0,
    startingStack: 1500,
    minPlayers: 2,
    maxPlayers: 9,
    guaranteed: 0,
    lateRegLevel: 0,
    allowReEntry: false,
    maxReEntries: 1,
    isBounty: false,
    bountyAmount: 0,
    satelliteTargetId: null as number | null,
    seatsAwarded: 0,
    blindStructureId: 0,
  };

  function headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSecret}`,
    };
  }

  function flash(msg: string) {
    toast = msg;
    setTimeout(() => (toast = ''), 3500);
  }

  async function login() {
    if (!adminSecret) return;
    loading = true;
    error = '';
    try {
      const res = await fetch(`${API}/api/admin/stats`, { headers: headers() });
      if (res.ok) {
        authed = true;
        localStorage.setItem(STORAGE_KEY, adminSecret);
        await loadAll();
      } else {
        error = 'Invalid admin secret';
        adminSecret = '';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadAll() {
    loading = true;
    try {
      const [s, t, b] = await Promise.all([
        fetch(`${API}/api/admin/stats`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/admin/tournaments`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/blind-structures`).then((r) => r.json()),
      ]);
      stats = s;
            tournaments = t.tournaments || [];

      // Also load templates
      const tplRes = await fetch(`${API}/api/admin/tournament-templates`, {
        headers: headers(),
      }).then((r) => r.json());
      templates = tplRes.templates || [];
      blindStructures = b.structures || [];
      if (blindStructures.length > 0 && !form.blindStructureId) {
        form.blindStructureId = blindStructures[0].id;
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function createTournament() {
    if (!form.name.trim()) {
      error = 'Tournament name is required';
      return;
    }
    creating = true;
    error = '';
    try {
      const payload = {
        ...form,
        startingStack: Number(form.startingStack) || 1500,
        buyIn: Number(form.buyIn) || 0,
        fee: Number(form.fee) || 0,
        minPlayers: Number(form.minPlayers) || 2,
        maxPlayers: Number(form.maxPlayers) || 9,
        guaranteed: Number(form.guaranteed) || 0,
        lateRegLevel: Number(form.lateRegLevel) || 0,
        maxReEntries: Number(form.maxReEntries) || 1,
        bountyAmount: Number(form.bountyAmount) || 0,
        seatsAwarded: Number(form.seatsAwarded) || 0,
        blindStructureId: Number(form.blindStructureId),
      };
      const res = await fetch(`${API}/api/tournaments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`✅ Tournament #${data.tournamentId} created`);
        showCreate = false;
        form.name = '';
        await loadAll();
      } else if (res.status === 401) {
        error = 'Admin secret rejected';
      } else {
        error = data.error || 'create_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      creating = false;
    }
  }

  async function startTournament(id: number) {
    if (!confirm(`Start tournament #${id}?`)) return;
    const res = await fetch(`${API}/api/tournaments/${id}/start`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`🚀 Tournament #${id} started`);
      await loadAll();
    } else {
      error = data.error || 'start_failed';
    }
  }

  async function cancelTournament(id: number) {
    if (!confirm(`Cancel tournament #${id} and refund all players?`)) return;
    const res = await fetch(`${API}/api/admin/tournaments/${id}/cancel`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`❌ Cancelled #${id}, refunded ${data.refunded} players`);
      await loadAll();
    } else {
      error = data.error || 'cancel_failed';
    }
  }

  async function pauseTournament(id: number) {
    if (!confirm(`Pause tournament #${id}?`)) return;
    const res = await fetch(`${API}/api/admin/tournaments/${id}/pause`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`⏸️ Tournament #${id} paused`);
      await loadAll();
    } else {
      error = data.error || 'pause_failed';
    }
  }

  async function resumeTournament(id: number) {
    const res = await fetch(`${API}/api/admin/tournaments/${id}/resume`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok) {
      flash(`▶️ Tournament #${id} resumed`);
      await loadAll();
    } else {
      error = data.error || 'resume_failed';
    }
  }
  async function createTemplate() {
    if (!tform.name.trim()) {
      error = 'Template name is required';
      return;
    }
    creatingTemplate = true;
    error = '';
    try {
      const payload = {
        ...tform,
        blindStructureId: Number(tform.blindStructureId),
      };
      const res = await fetch(`${API}/api/admin/tournament-templates`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`✅ Template #${data.templateId} created`);
        showTemplateForm = false;
        tform.name = '';
        await loadAll();
      } else {
        error = data.error || 'create_template_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      creatingTemplate = false;
    }
  }

  async function toggleTemplate(id: number, active: boolean) {
    const res = await fetch(`${API}/api/admin/tournament-templates/${id}/toggle`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      flash(active ? '▶️ Activated' : '⏸️ Paused');
      await loadAll();
    } else {
      error = 'toggle_failed';
    }
  }

  async function deleteTemplate(id: number) {
    if (!confirm(`Delete template #${id}?`)) return;
    const res = await fetch(`${API}/api/admin/tournament-templates/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (res.ok) {
      flash('🗑️ Deleted');
      await loadAll();
    } else {
      error = 'delete_failed';
    }
  }

  function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return '—'; }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    adminSecret = '';
    authed = false;
    stats = null;
    tournaments = [];
  }

  function statusColor(s: string): string {
    if (s === 'running') return '#10b981';
    if (s === 'final_table') return '#f4c95d';
    if (s === 'registering') return '#22d3ee';
    if (s === 'scheduled') return '#8b5cf6';
    if (s === 'finished') return '#6b7280';
    if (s === 'paused') return '#f59e0b';
    if (s === 'cancelled') return '#ef4444';
    return '#6b7280';
  }

  onMount(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      adminSecret = saved;
      login();
    }
  });
</script>

<div class="px-4 pb-28" style="min-height: 100dvh;">
  <TopBar />

  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.25);"
    >
      ←
    </button>
    <h1 class="text-xl font-extrabold flex-1">🛠️ Admin Panel</h1>
    {#if authed}
      <button
        on:click={logout}
        class="text-[10px] font-bold text-red-300 px-2 py-1 rounded-full"
        style="background: rgba(220,38,38,0.15);"
      >
        Logout
      </button>
    {/if}
  </div>

  {#if !authed}
    <div class="card space-y-3 mt-8">
      <div class="text-center mb-2">
        <p class="text-4xl mb-2">🔒</p>
        <p class="text-sm text-white/60">Enter admin secret to continue</p>
      </div>
      <input
        type="password"
        bind:value={adminSecret}
        on:keydown={(e) => e.key === 'Enter' && login()}
        placeholder="Admin secret"
        class="w-full rounded-xl px-3 py-3 text-sm text-white outline-none"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
      />
      <button
        on:click={login}
        disabled={loading || !adminSecret}
        class="w-full btn-gold disabled:opacity-40"
      >
        {loading ? 'Checking…' : 'Login'}
      </button>
      {#if error}
        <p class="text-xs text-red-300 text-center">{error}</p>
      {/if}
    </div>
  {:else}
    {#if stats}
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="card !p-3 text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Total</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{stats.totalTournaments}</p>
          <p class="text-[9px] text-white/40">tournaments</p>
        </div>
        <div class="card !p-3 text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Running</p>
          <p class="text-xl font-extrabold text-emerald-400 tabular-nums">
            {stats.byStatus?.running || 0}
          </p>
          <p class="text-[9px] text-white/40">now</p>
        </div>
        <div class="card !p-3 text-center">
          <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Players</p>
          <p class="text-xl font-extrabold text-cyan tabular-nums">
            {stats.totalUniquePlayers}
          </p>
          <p class="text-[9px] text-white/40">unique</p>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mb-4">
        <div class="card !p-3 text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold">Rake</p>
          <p class="text-lg font-extrabold text-gold tabular-nums">
            ${Number(stats.totalRake || 0).toFixed(2)}
          </p>
        </div>
        <div class="card !p-3 text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold">By Status</p>
          <div class="text-[10px] text-white/70 font-mono mt-1">
            {#each Object.entries(stats.byStatus || {}) as [k, v]}
              <span class="mr-1.5">{k}:{v}</span>
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <div class="flex gap-2 mb-3">
      <button
        on:click={() => (showCreate = !showCreate)}
        class="flex-1 btn-gold flex items-center justify-center gap-2"
      >
        {showCreate ? '✕ Close' : '+ Create Tournament'}
      </button>
      <button
        on:click={loadAll}
        aria-label="Refresh"
        class="w-12 rounded-xl text-white/70 active:scale-95"
        style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);"
      >
        🔄
      </button>
    </div>

    {#if showCreate}
      <div class="card space-y-3 mb-4">
        <div>
          <label for="t-name" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
            Tournament Name
          </label>
          <input
            id="t-name"
            type="text"
            bind:value={form.name}
            placeholder="e.g. Daily Deepstack"
            class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="t-variant" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Game Type
            </label>
            <select
              id="t-variant"
              bind:value={form.variant}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="holdem">Hold'em</option>
              <option value="omaha4">Omaha 4</option>
              <option value="omaha5">Omaha 5</option>
            </select>
          </div>
          <div>
            <label for="t-mode" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Mode
            </label>
            <select
              id="t-mode"
              bind:value={form.mode}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="free">Free (Play Money)</option>
              <option value="real">Real (USD)</option>
            </select>
          </div>
          <div>
            <label for="t-format" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Format
            </label>
            <select
              id="t-format"
              bind:value={form.format}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="sng">SNG</option>
              <option value="mtt">MTT</option>
              <option value="freeroll">Freeroll</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="t-buyin" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Buy-in ($)
            </label>
            <input
              id="t-buyin"
              type="number"
              min="0"
              step="0.01"
              bind:value={form.buyIn}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="t-fee" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Fee ($)
            </label>
            <input
              id="t-fee"
              type="number"
              min="0"
              step="0.01"
              bind:value={form.fee}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="t-stack" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Starting Stack
            </label>
            <input
              id="t-stack"
              type="number"
              min="100"
              step="100"
              bind:value={form.startingStack}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="t-min" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Min Players
            </label>
            <input
              id="t-min"
              type="number"
              min="2"
              bind:value={form.minPlayers}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="t-max" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Max Players
            </label>
            <input
              id="t-max"
              type="number"
              min="2"
              bind:value={form.maxPlayers}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="t-speed" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Speed
            </label>
            <select
              id="t-speed"
              bind:value={form.speed}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="regular">Regular</option>
              <option value="turbo">Turbo</option>
              <option value="hyper">Hyper</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="t-late-level" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Late Reg Until Level
            </label>
            <input
              id="t-late-level"
              type="number"
              min="0"
              bind:value={form.lateRegLevel}
              placeholder="0 = disabled"
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="t-blinds" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Blind Structure
            </label>
            <select
              id="t-blinds"
              bind:value={form.blindStructureId}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              {#if blindStructures.length === 0}
                <option value={0}>Loading…</option>
              {:else}
                {#each blindStructures as b}
                  <option value={b.id}>
                    {b.name} · start {b.startingStack}
                  </option>
                {/each}
              {/if}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label for="t-reentry" class="flex items-center gap-2 text-[11px] font-bold text-white/80 cursor-pointer py-1">
              <input
                id="t-reentry"
                type="checkbox"
                bind:checked={form.allowReEntry}
                class="w-4 h-4 accent-gold"
              />
              <span>Allow Re-entry</span>
            </label>
            {#if form.allowReEntry}
              <input
                type="number"
                min="1"
                bind:value={form.maxReEntries}
                placeholder="Max re-entries"
                class="w-full rounded-lg px-2 py-1.5 text-[10px] text-white outline-none mt-1"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            {/if}
          </div>
          <div>
            <label for="t-bounty" class="flex items-center gap-2 text-[11px] font-bold text-white/80 cursor-pointer py-1">
              <input
                id="t-bounty"
                type="checkbox"
                bind:checked={form.isBounty}
                class="w-4 h-4 accent-gold"
              />
              <span>Bounty (KO)</span>
            </label>
            {#if form.isBounty}
              <input
                type="number"
                min="0"
                step="0.01"
                bind:value={form.bountyAmount}
                placeholder="Bounty per KO"
                class="w-full rounded-lg px-2 py-1.5 text-[10px] text-white outline-none mt-1"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            {/if}
          </div>
        </div>

        <div class="rounded-xl p-3 space-y-2" style="background: rgba(139,92,246,0.08); border: 1px solid rgba(139,92,246,0.25);">
          <p class="text-[10px] uppercase tracking-wider text-cyan font-bold">
            🎟️ Satellite (optional)
          </p>

          <div>
            <label for="t-sat-target" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Target Tournament (empty = not a satellite)
            </label>
            <select
              id="t-sat-target"
              bind:value={form.satelliteTargetId}
              class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value={null}>— None —</option>
              {#each tournaments as t}
                {#if t.id}
                  <option value={t.id}>
                    #{t.id} {t.name} (${t.buyIn})
                  </option>
                {/if}
              {/each}
            </select>
          </div>

          {#if form.satelliteTargetId}
            <div>
              <label for="t-sat-seats" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Seats Awarded
              </label>
              <input
                id="t-sat-seats"
                type="number"
                min="1"
                bind:value={form.seatsAwarded}
                class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1">
                Top N finishers get a free ticket to the target tournament.
              </p>
            </div>
          {/if}
        </div>

        <button
          on:click={createTournament}
          disabled={creating || !form.name.trim()}
          class="w-full btn-gold disabled:opacity-40"
        >
          {creating ? 'Creating…' : '✓ Create Tournament'}
        </button>

        {#if error}
          <p class="text-xs text-red-300 text-center">{error}</p>
        {/if}
      </div>
    {/if}

    <h2 class="text-base font-extrabold mb-3 px-1 text-white/90">All Tournaments</h2>
    <div class="space-y-2">
      {#each tournaments as t}
        {@const sc = statusColor(t.status)}
        <div
          class="rounded-2xl p-3"
          style="background: rgba(16,26,58,0.7); border: 1px solid {sc}40;"
        >
          <div class="flex items-start justify-between mb-2">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span
                  class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                  style="background: {sc}25; color: {sc}; border: 1px solid {sc}60;"
                >
                  {t.status}
                </span>
                <span class="text-[9px] text-white/40">#{t.id}</span>
                {#if t.lateRegLevel > 0}
                  <span class="text-[9px] text-cyan/80 font-mono">
                    LR≤L{t.lateRegLevel}
                  </span>
                {/if}
                {#if t.allowReEntry}
                  <span class="text-[9px] text-violet font-mono">
                    RE×{t.maxReEntries}
                  </span>
                {/if}
                {#if t.isBounty}
                  <span class="text-[9px] text-orange-400 font-mono">
                    KO ${t.bountyAmount}
                  </span>
                {/if}
                {#if t.satelliteTargetId}
                  <span class="text-[9px] text-pink-400 font-mono">
                    🎟️→#{t.satelliteTargetId}×{t.seatsAwarded}
                  </span>
                {/if}
              </div>
              <p class="text-sm font-extrabold text-white truncate">{t.name}</p>
              <p class="text-[10px] text-white/40">
                {t.variant.toUpperCase()} · {t.format} · {t.buyIn > 0 ? `$${t.buyIn}` : 'FREE'}
              </p>
            </div>
            <div class="text-right shrink-0 ml-2">
              <p class="text-[11px] font-bold text-emerald-400 tabular-nums">
                {t.registeredCount}/{t.maxPlayers}
              </p>
              <p class="text-[9px] text-white/40">players</p>
            </div>
          </div>

          {#if t.status === 'running' || t.status === 'final_table' || t.status === 'paused'}
            <div class="text-[10px] text-white/50 mb-2">
              Level {t.currentLevel} · Prize ${Number(t.totalPrizePool || 0).toFixed(2)}
            </div>
          {/if}

          <div class="flex gap-2">
            {#if (t.status === 'registering' || t.status === 'scheduled') && t.registeredCount >= t.minPlayers}
              <button
                on:click={() => startTournament(t.id)}
                class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white active:scale-95"
                style="background: linear-gradient(180deg, #22c55e, #15803d);"
              >
                🚀 Start
              </button>
            {/if}
            {#if t.status === 'running' || t.status === 'final_table'}
              <button
                on:click={() => pauseTournament(t.id)}
                class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white active:scale-95"
                style="background: linear-gradient(180deg, #f59e0b, #b45309);"
              >
                ⏸️ Pause
              </button>
            {/if}
            {#if t.status === 'paused'}
              <button
                on:click={() => resumeTournament(t.id)}
                class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white active:scale-95"
                style="background: linear-gradient(180deg, #22c55e, #15803d);"
              >
                ▶️ Resume
              </button>
            {/if}
            {#if t.status !== 'finished' && t.status !== 'cancelled'}
              <button
                on:click={() => cancelTournament(t.id)}
                class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-red-300 active:scale-95"
                style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35);"
              >
                ❌ Cancel
              </button>
            {/if}
            {#if t.status === 'finished' || t.status === 'cancelled'}
              <div class="flex-1 text-center text-[10px] text-white/40 py-1.5">
                {t.status === 'finished' ? '🏁 Finished' : '❌ Cancelled'}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if tournaments.length === 0 && !loading}
      <div class="card text-center py-8">
        <p class="text-3xl mb-2">🎫</p>
        <p class="text-white/50 text-sm">No tournaments yet</p>
      </div>
    {/if}
        <!-- ============================================================ -->
    <!-- D6.1: RECURRING TEMPLATES -->
    <!-- ============================================================ -->
    <div class="flex items-center justify-between mt-6 mb-3">
      <h2 class="text-base font-extrabold px-1 text-white/90">
        🗓️ Recurring Tournaments
      </h2>
      <button
        on:click={() => (showTemplateForm = !showTemplateForm)}
        class="text-[10px] font-bold text-gold active:opacity-70 px-2 py-1 rounded-full"
        style="background: rgba(212,175,55,0.15);"
      >
        {showTemplateForm ? '✕ Close' : '+ New Template'}
      </button>
    </div>

    {#if showTemplateForm}
      <div class="card space-y-3 mb-3">
        <div>
          <label for="tpl-name" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
            Template Name
          </label>
          <input
            id="tpl-name"
            type="text"
            bind:value={tform.name}
            placeholder="e.g. Daily Freeroll"
            class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
          />
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="tpl-variant" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Game Type
            </label>
            <select
              id="tpl-variant"
              bind:value={tform.variant}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="holdem">Hold'em</option>
              <option value="omaha4">Omaha 4</option>
              <option value="omaha5">Omaha 5</option>
            </select>
          </div>
          <div>
            <label for="tpl-mode" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Mode
            </label>
            <select
              id="tpl-mode"
              bind:value={tform.mode}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="free">Free</option>
              <option value="real">Real</option>
            </select>
          </div>
          <div>
            <label for="tpl-format" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Format
            </label>
            <select
              id="tpl-format"
              bind:value={tform.format}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="sng">SNG</option>
              <option value="mtt">MTT</option>
              <option value="freeroll">Freeroll</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="tpl-buyin" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Buy-in
            </label>
            <input
              id="tpl-buyin"
              type="number"
              min="0"
              step="0.01"
              bind:value={tform.buyIn}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="tpl-stack" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Stack
            </label>
            <input
              id="tpl-stack"
              type="number"
              min="100"
              step="100"
              bind:value={tform.startingStack}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
          <div>
            <label for="tpl-max" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Max
            </label>
            <input
              id="tpl-max"
              type="number"
              min="2"
              bind:value={tform.maxPlayers}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>
        </div>

        <div>
          <label for="tpl-blinds" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
            Blind Structure
          </label>
          <select
            id="tpl-blinds"
            bind:value={tform.blindStructureId}
            class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
          >
            {#if blindStructures.length === 0}
              <option value={0}>Loading…</option>
            {:else}
              {#each blindStructures as b}
                <option value={b.id}>{b.name}</option>
              {/each}
            {/if}
          </select>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <div>
            <label for="tpl-sched-type" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Schedule
            </label>
            <select
              id="tpl-sched-type"
              bind:value={tform.scheduleType}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          {#if tform.scheduleType !== 'hourly'}
            <div>
              <label for="tpl-time" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Time (UTC)
              </label>
              <input
                id="tpl-time"
                type="text"
                bind:value={tform.scheduleTime}
                placeholder="14:00"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none font-mono"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
          {/if}
          {#if tform.scheduleType === 'weekly'}
            <div>
              <label for="tpl-day" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Day
              </label>
              <select
                id="tpl-day"
                bind:value={tform.scheduleDay}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>
          {/if}
        </div>

        <button
          on:click={createTemplate}
          disabled={creatingTemplate || !tform.name.trim()}
          class="w-full btn-gold disabled:opacity-40"
        >
          {creatingTemplate ? 'Creating…' : '✓ Create Template'}
        </button>

        {#if error}
          <p class="text-xs text-red-300 text-center">{error}</p>
        {/if}
      </div>
    {/if}

    {#if templates.length === 0}
      <div class="card text-center py-6 mb-4">
        <p class="text-2xl mb-1">🗓️</p>
        <p class="text-white/50 text-xs">No recurring templates yet</p>
      </div>
    {:else}
      <div class="space-y-2 mb-4">
        {#each templates as tpl}
          <div
            class="rounded-2xl p-3"
            style="background: rgba(16,26,58,0.7); border: 1px solid {tpl.isActive ? 'rgba(16,185,129,0.4)' : 'rgba(107,114,128,0.3)'};"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                  <span
                    class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                    style="background: {tpl.isActive ? 'rgba(16,185,129,0.25)' : 'rgba(107,114,128,0.25)'}; color: {tpl.isActive ? '#6ee7b7' : '#9ca3af'}; border: 1px solid {tpl.isActive ? 'rgba(16,185,129,0.5)' : 'rgba(107,114,128,0.5)'};"
                  >
                    {tpl.isActive ? 'ACTIVE' : 'PAUSED'}
                  </span>
                  <span class="text-[9px] text-cyan/80 font-mono">
                    {tpl.scheduleType}
                    {tpl.scheduleType !== 'hourly' ? ` @ ${tpl.scheduleTime}` : ''}
                    {tpl.scheduleType === 'weekly' ? ` (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][tpl.scheduleDay]})` : ''}
                  </span>
                </div>
                <p class="text-sm font-extrabold text-white truncate">{tpl.name}</p>
                <p class="text-[10px] text-white/40">
                  {tpl.variant.toUpperCase()} · {tpl.format} · {tpl.buyIn > 0 ? `$${tpl.buyIn}` : 'FREE'}
                </p>
              </div>
              <div class="text-right shrink-0 ml-2">
                <p class="text-[9px] text-white/40">Next run</p>
                <p class="text-[10px] font-mono text-gold">{fmtDate(tpl.nextRunAt)}</p>
                {#if tpl.lastRunAt}
                  <p class="text-[9px] text-white/30 mt-0.5">
                    Last: {fmtDate(tpl.lastRunAt)}
                  </p>
                {/if}
              </div>
            </div>

            <div class="flex gap-2">
              <button
                on:click={() => toggleTemplate(tpl.id, !tpl.isActive)}
                class="flex-1 rounded-lg py-1.5 text-[11px] font-bold active:scale-95"
                style="background: {tpl.isActive ? 'rgba(245,158,11,0.15)' : 'linear-gradient(180deg, #22c55e, #15803d)'}; color: {tpl.isActive ? '#fcd34d' : 'white'}; border: 1px solid {tpl.isActive ? 'rgba(245,158,11,0.35)' : 'transparent'};"
              >
                {tpl.isActive ? '⏸️ Pause' : '▶️ Activate'}
              </button>
              <button
                on:click={() => deleteTemplate(tpl.id)}
                class="rounded-lg px-3 py-1.5 text-[11px] font-bold text-red-300 active:scale-95"
                style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35);"
              >
                🗑️
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(6,78,59,0.95); border: 1px solid rgba(34,197,94,0.5);"
    >
      <p class="text-xs font-bold text-emerald-100">{toast}</p>
    </div>
  {/if}
</div>
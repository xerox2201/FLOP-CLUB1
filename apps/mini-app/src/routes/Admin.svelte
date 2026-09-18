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

  let activeTab: 'tournaments' | 'tables' = 'tournaments';

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
    scheduledStart: '',
  };

  // ============ TABLES STATE ============
  let tables: any[] = [];
  let tablesLoading = false;
  let showTableForm = false;
  let creatingTable = false;
  let tableFilter: 'all' | 'holdem' | 'omaha4' | 'omaha5' = 'all';

  let tableForm = {
    name: '',
    variant: 'holdem',
    mode: 'free',
    speed: 'regular',
    small_blind: 1,
    big_blind: 2,
    ante: 0,
    min_buyin: 100,
    max_buyin: 1000,
    rake_pct: 0.03,
    seats: 6,
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

      const tplRes = await fetch(`${API}/api/admin/tournament-templates`, {
        headers: headers(),
      }).then((r) => r.json());
      templates = tplRes.templates || [];
      blindStructures = b.structures || [];
      if (blindStructures.length > 0 && !form.blindStructureId) {
        form.blindStructureId = blindStructures[0].id;
      }

      await loadTables();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function loadTables() {
    tablesLoading = true;
    try {
      const res = await fetch(`${API}/api/admin/tables`, { headers: headers() });
      const data = await res.json();
      tables = data.tables || [];
    } catch (e: any) {
      console.error('[tables]', e);
    } finally {
      tablesLoading = false;
    }
  }

  function resetTableForm() {
    tableForm = {
      name: '',
      variant: 'holdem',
      mode: 'free',
      speed: 'regular',
      small_blind: 1,
      big_blind: 2,
      ante: 0,
      min_buyin: 100,
      max_buyin: 1000,
      rake_pct: 0.03,
      seats: 6,
    };
  }

  async function createTable() {
    if (!tableForm.name.trim()) {
      error = 'Table name is required';
      return;
    }
    creatingTable = true;
    error = '';
    try {
      const payload = {
        name: tableForm.name,
        variant: tableForm.variant,
        mode: tableForm.mode,
        speed: tableForm.speed,
        small_blind: Number(tableForm.small_blind) || 1,
        big_blind: Number(tableForm.big_blind) || 2,
        ante: Number(tableForm.ante) || 0,
        min_buyin: Number(tableForm.min_buyin) || 0,
        max_buyin: Number(tableForm.max_buyin) || 0,
        rake_pct: Number(tableForm.rake_pct) || 0,
        seats: Number(tableForm.seats) || 6,
      };
      const res = await fetch(`${API}/api/admin/tables`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`✅ Table "${payload.name}" created`);
        showTableForm = false;
        resetTableForm();
        await loadTables();
      } else {
        error = data.error || 'create_table_failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      creatingTable = false;
    }
  }

  async function deleteTable(id: number, name: string) {
    if (!confirm(`Delete table "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API}/api/admin/tables/${id}`, {
        method: 'DELETE',
        headers: headers(),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`🗑️ Table "${name}" deleted`);
        await loadTables();
      } else {
        error =
          data.error === 'table_has_players'
            ? 'Table has live players — kick them first'
            : data.error || 'delete_failed';
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function toggleTable(id: number, active: boolean) {
    try {
      const res = await fetch(`${API}/api/admin/tables/${id}/toggle`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ active }),
      });
      if (res.ok) {
        flash(active ? '▶️ Table activated' : '⏸️ Table paused');
        await loadTables();
      } else {
        error = 'toggle_failed';
      }
    } catch (e: any) {
      error = e.message;
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
        scheduledStart: form.scheduledStart
          ? new Date(form.scheduledStart).toISOString()
          : null,
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
        form.scheduledStart = '';
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
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    adminSecret = '';
    authed = false;
    stats = null;
    tournaments = [];
    tables = [];
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

  function variantLabel(v: string): string {
    if (v === 'holdem') return "Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }

  function variantColor(v: string): string {
    if (v === 'holdem') return '#3b82f6';
    if (v === 'omaha4') return '#ef4444';
    if (v === 'omaha5') return '#10b981';
    return '#d4af37';
  }

  $: filteredTables =
    tableFilter === 'all'
      ? tables
      : tables.filter((t) => t.variant === tableFilter);

  $: tablesByVariant = {
    holdem: tables.filter((t) => t.variant === 'holdem').length,
    omaha4: tables.filter((t) => t.variant === 'omaha4').length,
    omaha5: tables.filter((t) => t.variant === 'omaha5').length,
  };

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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <h1 class="text-xl font-extrabold flex-1 flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
      <span>Admin Panel</span>
    </h1>
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
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
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
    {/if}

    <!-- ============ TAB SWITCHER ============ -->
    <div
      class="rounded-2xl p-1 grid grid-cols-2 gap-1 mb-4"
      style="
        background: linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9));
        border: 1px solid rgba(212,175,55,0.2);
      "
    >
      <button
        on:click={() => (activeTab = 'tournaments')}
        class="py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5"
        style="
          background: {activeTab === 'tournaments'
            ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
            : 'transparent'};
          color: {activeTab === 'tournaments' ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          {activeTab === 'tournaments'
            ? 'box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);'
            : ''}
        "
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
        Tournaments
      </button>
      <button
        on:click={() => (activeTab = 'tables')}
        class="py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5"
        style="
          background: {activeTab === 'tables'
            ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
            : 'transparent'};
          color: {activeTab === 'tables' ? '#0a0800' : 'rgba(255,255,255,0.65)'};
          {activeTab === 'tables'
            ? 'box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);'
            : ''}
        "
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
        Tables ({tables.length})
      </button>
    </div>

    {#if activeTab === 'tournaments'}
      <!-- ===================================================== -->
      <!-- TOURNAMENTS TAB -->
      <!-- ===================================================== -->

      <div class="flex gap-2 mb-3">
        <button
          on:click={() => (showCreate = !showCreate)}
          class="flex-1 btn-gold flex items-center justify-center gap-2"
        >
          {#if showCreate}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <span>Close</span>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Create Tournament</span>
          {/if}
        </button>
        <button
          on:click={loadAll}
          aria-label="Refresh"
          class="w-12 rounded-xl text-white/70 active:scale-95 flex items-center justify-center"
          style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
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

          <div>
            <label for="t-start" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Scheduled Start (optional)
            </label>
            <input
              id="t-start"
              type="datetime-local"
              bind:value={form.scheduledStart}
              class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none font-mono"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25); color-scheme: dark;"
            />
            <p class="text-[9px] text-white/40 mt-1">
              Leave empty for "registering" mode — tournament starts when enough players join or manually.
            </p>
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
            <p class="text-[10px] uppercase tracking-wider text-cyan font-bold flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                <path d="M13 5v2M13 11v2M13 17v2" />
              </svg>
              <span>Satellite (optional)</span>
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
            {#if creating}
              <span>Creating…</span>
            {:else}
              <span class="inline-flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12l4 4 10-10" />
                </svg>
                Create Tournament
              </span>
            {/if}
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
                    <span class="text-[9px] text-pink-400 font-mono inline-flex items-center gap-0.5">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                      </svg>
                      →#{t.satelliteTargetId}×{t.seatsAwarded}
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
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white active:scale-95 inline-flex items-center justify-center gap-1"
                  style="background: linear-gradient(180deg, #22c55e, #15803d);"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
                    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
                  </svg>
                  Start
                </button>
              {/if}
              {#if t.status === 'running' || t.status === 'final_table'}
                <button
                  on:click={() => pauseTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white active:scale-95 inline-flex items-center justify-center gap-1"
                  style="background: linear-gradient(180deg, #f59e0b, #b45309);"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                  Pause
                </button>
              {/if}
              {#if t.status === 'paused'}
                <button
                  on:click={() => resumeTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white active:scale-95 inline-flex items-center justify-center gap-1"
                  style="background: linear-gradient(180deg, #22c55e, #15803d);"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4l14 8-14 8V4z" />
                  </svg>
                  Resume
                </button>
              {/if}
              {#if t.status !== 'finished' && t.status !== 'cancelled'}
                <button
                  on:click={() => cancelTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-red-300 active:scale-95 inline-flex items-center justify-center gap-1"
                  style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35);"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M15 9l-6 6M9 9l6 6" />
                  </svg>
                  Cancel
                </button>
              {/if}
              {#if t.status === 'finished' || t.status === 'cancelled'}
                <div class="flex-1 text-center text-[10px] text-white/40 py-1.5 inline-flex items-center justify-center gap-1">
                  {#if t.status === 'finished'}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <path d="M4 21V4" />
                      <path d="M4 4h14l-3 4 3 4H4" />
                    </svg>
                    Finished
                  {:else}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                    Cancelled
                  {/if}
                </div>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      {#if tournaments.length === 0 && !loading}
        <div class="card text-center py-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2">
            <path d="M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
            <path d="M13 5v2M13 11v2M13 17v2" />
          </svg>
          <p class="text-white/50 text-sm">No tournaments yet</p>
        </div>
      {/if}

      <!-- ============================================================ -->
      <!-- D6.1: RECURRING TEMPLATES -->
      <!-- ============================================================ -->
      <div class="flex items-center justify-between mt-6 mb-3">
        <h2 class="text-base font-extrabold px-1 text-white/90 flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Recurring Tournaments
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
            {#if creatingTemplate}
              <span>Creating…</span>
            {:else}
              <span class="inline-flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12l4 4 10-10" />
                </svg>
                Create Template
              </span>
            {/if}
          </button>

          {#if error}
            <p class="text-xs text-red-300 text-center">{error}</p>
          {/if}
        </div>
      {/if}

      {#if templates.length === 0}
        <div class="card text-center py-6 mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-1">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
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
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold active:scale-95 inline-flex items-center justify-center gap-1"
                  style="background: {tpl.isActive ? 'rgba(245,158,11,0.15)' : 'linear-gradient(180deg, #22c55e, #15803d)'}; color: {tpl.isActive ? '#fcd34d' : 'white'}; border: 1px solid {tpl.isActive ? 'rgba(245,158,11,0.35)' : 'transparent'};"
                >
                  {#if tpl.isActive}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                    Pause
                  {:else}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 4l14 8-14 8V4z" />
                    </svg>
                    Activate
                  {/if}
                </button>
                <button
                  on:click={() => deleteTemplate(tpl.id)}
                  class="rounded-lg px-3 py-1.5 text-[11px] font-bold text-red-300 active:scale-95 flex items-center justify-center"
                  style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35);"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      <!-- ===================================================== -->
      <!-- TABLES TAB -->
      <!-- ===================================================== -->

      <!-- Summary by variant -->
      <div class="grid grid-cols-3 gap-2 mb-4">
        <div class="card !p-2.5 text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold" style="color: #3b82f6;">Hold'em</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{tablesByVariant.holdem}</p>
        </div>
        <div class="card !p-2.5 text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold" style="color: #ef4444;">Omaha 4</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{tablesByVariant.omaha4}</p>
        </div>
        <div class="card !p-2.5 text-center">
          <p class="text-[9px] text-white/40 uppercase font-bold" style="color: #10b981;">Omaha 5</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{tablesByVariant.omaha5}</p>
        </div>
      </div>

      <!-- Filter chips -->
      <div class="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1">
        {#each [
          { key: 'all', label: 'All Tables' },
          { key: 'holdem', label: "Hold'em" },
          { key: 'omaha4', label: 'Omaha 4' },
          { key: 'omaha5', label: 'Omaha 5' },
        ] as f}
          <button
            on:click={() => (tableFilter = f.key as any)}
            class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider"
            style="
              background: {tableFilter === f.key
                ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                : 'rgba(15,31,58,0.7)'};
              color: {tableFilter === f.key ? '#0a0800' : 'rgba(255,255,255,0.7)'};
              border: 1px solid {tableFilter === f.key ? 'transparent' : 'rgba(212,175,55,0.2)'};
            "
          >
            {f.label}
          </button>
        {/each}
      </div>

      <div class="flex gap-2 mb-3">
        <button
          on:click={() => (showTableForm = !showTableForm)}
          class="flex-1 btn-gold flex items-center justify-center gap-2"
        >
          {#if showTableForm}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            <span>Close</span>
          {:else}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Add Table</span>
          {/if}
        </button>
        <button
          on:click={loadTables}
          aria-label="Refresh"
          class="w-12 rounded-xl text-white/70 active:scale-95 flex items-center justify-center"
          style="background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3);"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
          </svg>
        </button>
      </div>

      {#if showTableForm}
        <div class="card space-y-3 mb-4">
          <div>
            <label for="tb-name" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Table Name
            </label>
            <input
              id="tb-name"
              type="text"
              bind:value={tableForm.name}
              placeholder="e.g. Holdem 1/2"
              class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label for="tb-variant" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Variant
              </label>
              <select
                id="tb-variant"
                bind:value={tableForm.variant}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              >
                <option value="holdem">Hold'em</option>
                <option value="omaha4">Omaha 4</option>
                <option value="omaha5">Omaha 5</option>
              </select>
            </div>
            <div>
              <label for="tb-mode" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Mode
              </label>
              <select
                id="tb-mode"
                bind:value={tableForm.mode}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              >
                <option value="free">Free</option>
                <option value="real">Real</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label for="tb-speed" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Speed
              </label>
              <select
                id="tb-speed"
                bind:value={tableForm.speed}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              >
                <option value="regular">Regular</option>
                <option value="turbo">Turbo</option>
                <option value="hyper">Hyper</option>
              </select>
            </div>
            <div>
              <label for="tb-seats" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Seats (2-10)
              </label>
              <input
                id="tb-seats"
                type="number"
                min="2"
                max="10"
                bind:value={tableForm.seats}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <label for="tb-sb" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Small Blind
              </label>
              <input
                id="tb-sb"
                type="number"
                min="0"
                step="0.01"
                bind:value={tableForm.small_blind}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
            <div>
              <label for="tb-bb" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Big Blind
              </label>
              <input
                id="tb-bb"
                type="number"
                min="0"
                step="0.01"
                bind:value={tableForm.big_blind}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
            <div>
              <label for="tb-ante" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Ante
              </label>
              <input
                id="tb-ante"
                type="number"
                min="0"
                step="0.01"
                bind:value={tableForm.ante}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label for="tb-min" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Min Buy-in
              </label>
              <input
                id="tb-min"
                type="number"
                min="0"
                step="0.01"
                bind:value={tableForm.min_buyin}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
            <div>
              <label for="tb-max" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
                Max Buy-in
              </label>
              <input
                id="tb-max"
                type="number"
                min="0"
                step="0.01"
                bind:value={tableForm.max_buyin}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
              />
            </div>
          </div>

          <div>
            <label for="tb-rake" class="block text-[10px] uppercase tracking-wider text-white/50 font-bold mb-1">
              Rake (0-1)
            </label>
            <input
              id="tb-rake"
              type="number"
              min="0"
              max="1"
              step="0.01"
              bind:value={tableForm.rake_pct}
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(139,92,246,0.25);"
            />
            <p class="text-[9px] text-white/40 mt-1">
              e.g. 0.03 = 3% rake
            </p>
          </div>

          <button
            on:click={createTable}
            disabled={creatingTable || !tableForm.name.trim()}
            class="w-full btn-gold disabled:opacity-40"
          >
            {#if creatingTable}
              <span>Creating…</span>
            {:else}
              <span class="inline-flex items-center justify-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12l4 4 10-10" />
                </svg>
                Create Table
              </span>
            {/if}
          </button>

          {#if error}
            <p class="text-xs text-red-300 text-center">{error}</p>
          {/if}
        </div>
      {/if}

      {#if tablesLoading}
        <div class="space-y-2">
          {#each Array(3) as _}
            <div class="rounded-2xl p-3 h-[80px] shimmer" style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"></div>
          {/each}
        </div>
      {:else if filteredTables.length === 0}
        <div class="card text-center py-8">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(212,175,55,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-2">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <p class="text-white/50 text-sm">No tables {tableFilter === 'all' ? 'yet' : `in ${tableFilter}`}</p>
          <p class="text-white/40 text-[11px] mt-1">Click "Add Table" to create one</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each filteredTables as tb}
            {@const accent = variantColor(tb.variant)}
            <div
              class="rounded-2xl p-3 relative overflow-hidden"
              style="
                background: linear-gradient(135deg, rgba(15,31,58,0.85) 0%, rgba(7,14,27,0.95) 100%);
                border: 1.5px solid {tb.is_active ? accent + '50' : 'rgba(107,114,128,0.4)'};
                {tb.is_active ? '' : 'opacity: 0.65;'}
              "
            >
              <div class="absolute left-0 top-0 bottom-0 w-1" style="background: linear-gradient(180deg, {accent}, {accent}66);"></div>

              <div class="pl-2">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <span
                        class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                        style="background: {accent}25; color: {accent}; border: 1px solid {accent}60;"
                      >
                        {variantLabel(tb.variant)}
                      </span>
                      <span
                        class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                        style="background: {tb.mode === 'free' ? 'rgba(16,185,129,0.2)' : 'rgba(212,175,55,0.2)'}; color: {tb.mode === 'free' ? '#6ee7b7' : '#f4e5a8'};"
                      >
                        {tb.mode}
                      </span>
                      {#if !tb.is_active}
                        <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase" style="background: rgba(107,114,128,0.25); color: #9ca3af; border: 1px solid rgba(107,114,128,0.5);">
                          PAUSED
                        </span>
                      {/if}
                      <span class="text-[9px] text-white/40">#{tb.id}</span>
                    </div>
                    <p class="text-sm font-extrabold text-white truncate">{tb.name}</p>
                    <p class="text-[10px] text-white/50 font-mono tabular-nums">
                      {tb.blinds?.sb}/{tb.blinds?.bb}{tb.blinds?.ante ? ` (ante ${tb.blinds.ante})` : ''} · {tb.seats} seats
                    </p>
                  </div>
                  <div class="text-right shrink-0 ml-2">
                    <p class="text-[11px] font-bold text-emerald-400 tabular-nums">
                      {tb.live_players || 0}/{tb.seats}
                    </p>
                    <p class="text-[9px] text-white/40">live</p>
                  </div>
                </div>

                <div class="flex gap-2">
                  <button
                    on:click={() => toggleTable(tb.id, !tb.is_active)}
                    class="flex-1 rounded-lg py-1.5 text-[11px] font-bold active:scale-95 inline-flex items-center justify-center gap-1"
                    style="background: {tb.is_active ? 'rgba(245,158,11,0.15)' : 'linear-gradient(180deg, #22c55e, #15803d)'}; color: {tb.is_active ? '#fcd34d' : 'white'}; border: 1px solid {tb.is_active ? 'rgba(245,158,11,0.35)' : 'transparent'};"
                  >
                    {#if tb.is_active}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      Pause
                    {:else}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 4l14 8-14 8V4z" />
                      </svg>
                      Activate
                    {/if}
                  </button>
                  <button
                    on:click={() => deleteTable(tb.id, tb.name)}
                    class="rounded-lg px-3 py-1.5 text-[11px] font-bold text-red-300 active:scale-95 flex items-center justify-center"
                    style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35);"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
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
<script lang="ts">
  import { formatUSD } from '../lib/format';
  import { onMount } from 'svelte';
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';

  export let onBack: () => void = () => {};

  const API = '';
  const STORAGE_KEY = 'admin_secret';

  let adminSecret = '';
  let authed = false;
  let loading = false;
  let error = '';
  let toast = '';
  let toastIcon: string | null = null;

  type Tab =
    | 'overview'
    | 'tournaments'
    | 'tables'
    | 'players'
    | 'anticheat'
    | 'wallet'
    | 'broadcast'
    | 'settings';
  let activeTab: Tab = 'overview';

  // ============ OVERVIEW ============
  let overview: any = null;
  let liveRooms: any[] = [];
  let overviewLoading = false;

  // ============ TOURNAMENTS ============
  let tournaments: any[] = [];
  let blindStructures: any[] = [];
  let templates: any[] = [];
  let tourneyFilter = 'all';
  let showCreate = false;
  let creating = false;
  let showTemplateForm = false;
  let creatingTemplate = false;

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
    allowRebuy: false,
    maxRebuys: 3,
    rebuyAmount: 0,
    rebuyStack: 0,
    rebuyUntilLevel: 0,
    allowAddon: false,
    addonAmount: 0,
    addonStack: 0,
    addonAtLevel: 0,
  };
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
    allowRebuy: false,
    maxRebuys: 3,
    rebuyAmount: 0,
    rebuyStack: 0,
    rebuyUntilLevel: 0,
    allowAddon: false,
    addonAmount: 0,
    addonStack: 0,
    addonAtLevel: 0,
  };

  // ============ TABLES ============
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

  // ============ PLAYERS ============
  let players: any[] = [];
  let playersTotal = 0;
  let playersLoading = false;
  let playersSearch = '';
  let playersFilter: 'all' | 'active' | 'banned' | 'high_risk' = 'all';
  let selectedPlayer: any = null;
  let playerDetail: any = null;
  let playerHistory: any = null;
  let playerDetailLoading = false;
  let walletAdjustAmount = 0;
  let walletAdjustReason = '';
  let walletAdjusting = false;

  // ============ ANTI-CHEAT ============
  let anticheat: any = null;
  let riskyUsers: any[] = [];
  let anticheatEvents: any[] = [];
  let shadowbanned: any[] = [];
  let shadowbanBusy: number | null = null;
  let anticheatFilter: 'all' | 'unresolved' | 'resolved' = 'unresolved';
  let anticheatLoading = false;

  // ============ WALLET ============
  let walletActions: any[] = [];

  // ============ BROADCAST ============
  let broadcasts: any[] = [];
  let bcastForm = { title: '', message: '', target: 'all', severity: 'info' };
  let broadcasting = false;
  let showBroadcastForm = false;

  // ============ SETTINGS ============
  let settings: Record<string, any> = {};
  let actionsLog: any[] = [];
  let settingsLoading = false;
  let settingsSaving = false;

  function headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminSecret}`,
    };
  }

  function flash(msg: string, icon?: string) {
    toast = msg;
    toastIcon = icon ?? null;
    setTimeout(() => {
      toast = '';
      toastIcon = null;
    }, 3500);
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
        await loadTab('overview');
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

  async function loadTab(tab: Tab) {
    activeTab = tab;
    error = '';
    if (tab === 'overview') await loadOverview();
    else if (tab === 'tournaments') await loadTournaments();
    else if (tab === 'tables') await loadTables();
    else if (tab === 'players') await loadPlayers();
    else if (tab === 'anticheat') await loadAnticheat();
    else if (tab === 'wallet') await loadWallet();
    else if (tab === 'broadcast') await loadBroadcasts();
    else if (tab === 'settings') await loadSettings();
  }

  // ============ LOADERS ============
  async function loadOverview() {
    overviewLoading = true;
    try {
      const [o, l] = await Promise.all([
        fetch(`${API}/api/admin/overview`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/admin/live`, { headers: headers() }).then((r) => r.json()),
      ]);
      overview = o;
      liveRooms = l.rooms || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      overviewLoading = false;
    }
  }

  async function loadTournaments() {
    try {
      const [t, b, tpl] = await Promise.all([
        fetch(`${API}/api/admin/tournaments`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/blind-structures`).then((r) => r.json()),
        fetch(`${API}/api/admin/tournament-templates`, { headers: headers() }).then((r) =>
          r.json(),
        ),
      ]);
      tournaments = t.tournaments || [];
      blindStructures = b.structures || [];
      templates = tpl.templates || [];
      if (blindStructures.length > 0 && !form.blindStructureId) {
        form.blindStructureId = blindStructures[0].id;
      }
      if (blindStructures.length > 0 && !tform.blindStructureId) {
        tform.blindStructureId = blindStructures[0].id;
      }
    } catch (e: any) {
      error = e.message;
    }
  }

  async function loadTables() {
    tablesLoading = true;
    try {
      const res = await fetch(`${API}/api/admin/tables`, { headers: headers() });
      const data = await res.json();
      tables = data.tables || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      tablesLoading = false;
    }
  }

  async function loadPlayers() {
    playersLoading = true;
    try {
      const qs = new URLSearchParams();
      if (playersSearch) qs.set('search', playersSearch);
      if (playersFilter !== 'all') qs.set('filter', playersFilter);
      qs.set('limit', '50');
      const res = await fetch(`${API}/api/admin/users?${qs}`, { headers: headers() });
      const data = await res.json();
      players = data.users || [];
      playersTotal = data.total || 0;
    } catch (e: any) {
      error = e.message;
    } finally {
      playersLoading = false;
    }
  }

  async function loadPlayerDetail(id: number) {
    playerDetailLoading = true;
    try {
      const [d, h] = await Promise.all([
        fetch(`${API}/api/admin/users/${id}`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/admin/users/${id}/history?limit=20`, { headers: headers() }).then((r) =>
          r.json(),
        ),
      ]);
      playerDetail = d.user;
      playerHistory = h;
    } catch (e: any) {
      error = e.message;
    } finally {
      playerDetailLoading = false;
    }
  }

  async function loadAnticheat() {
    anticheatLoading = true;
    try {
      const resolvedParam =
        anticheatFilter === 'resolved'
          ? '?resolved=true'
          : anticheatFilter === 'unresolved'
            ? '?resolved=false'
            : '';
      const [s, r, e, sb] = await Promise.all([
        fetch(`${API}/api/admin/anticheat/stats`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/admin/anticheat/risky-users`, { headers: headers() }).then((r) =>
          r.json(),
        ),
        fetch(`${API}/api/admin/anticheat/events${resolvedParam}`, { headers: headers() }).then(
          (r) => r.json(),
        ),
        fetch(`${API}/api/admin/anticheat/shadowbanned`, { headers: headers() }).then((r) =>
          r.json(),
        ),
      ]);
      anticheat = s;
      riskyUsers = r.users || [];
      anticheatEvents = e.events || [];
      shadowbanned = sb.users || [];
    } catch (err: any) {
      error = err.message;
    } finally {
      anticheatLoading = false;
    }
  }

  async function loadWallet() {
    try {
      const res = await fetch(`${API}/api/admin/actions?limit=50`, { headers: headers() });
      const data = await res.json();
      walletActions = (data.actions || []).filter(
        (a: any) =>
          a.action === 'adjust_wallet' || a.action === 'ban_user' || a.action === 'unban_user',
      );
    } catch (e: any) {
      error = e.message;
    }
  }

  async function loadBroadcasts() {
    try {
      const res = await fetch(`${API}/api/admin/broadcasts`, { headers: headers() });
      const data = await res.json();
      broadcasts = data.broadcasts || [];
    } catch (e: any) {
      error = e.message;
    }
  }

  async function loadSettings() {
    settingsLoading = true;
    try {
      const [s, a] = await Promise.all([
        fetch(`${API}/api/admin/settings`, { headers: headers() }).then((r) => r.json()),
        fetch(`${API}/api/admin/actions?limit=30`, { headers: headers() }).then((r) => r.json()),
      ]);
      settings = s.settings || {};
      actionsLog = a.actions || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      settingsLoading = false;
    }
  }

  // ============ ACTIONS — TOURNAMENTS ============
  async function createTournament() {
    if (!form.name.trim()) {
      error = 'Name required';
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
        scheduledStart: form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null,
        maxRebuys: Number(form.maxRebuys) || 0,
        rebuyAmount: Number(form.rebuyAmount) || 0,
        rebuyStack: Number(form.rebuyStack) || 0,
        rebuyUntilLevel: Number(form.rebuyUntilLevel) || 0,
        addonAmount: Number(form.addonAmount) || 0,
        addonStack: Number(form.addonStack) || 0,
        addonAtLevel: Number(form.addonAtLevel) || 0,
      };
      const res = await fetch(`${API}/api/tournaments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`Tournament #${data.tournamentId} created`, 'success');
        showCreate = false;
        form.name = '';
        form.scheduledStart = '';
        await loadTournaments();
      } else error = data.error || 'create_failed';
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
      body: '{}',
    });
    if (res.ok) {
      flash(`Started #${id}`, 'play');
      await loadTournaments();
    } else error = 'start_failed';
  }

  async function pauseTournament(id: number) {
    if (!confirm(`Pause #${id}?`)) return;
    const res = await fetch(`${API}/api/admin/tournaments/${id}/pause`, {
      method: 'POST',
      headers: headers(),
      body: '{}',
    });
    if (res.ok) {
      flash(`Paused #${id}`, 'pause');
      await loadTournaments();
    } else error = 'pause_failed';
  }

  async function resumeTournament(id: number) {
    const res = await fetch(`${API}/api/admin/tournaments/${id}/resume`, {
      method: 'POST',
      headers: headers(),
      body: '{}',
    });
    if (res.ok) {
      flash(`Resumed #${id}`, 'play');
      await loadTournaments();
    } else error = 'resume_failed';
  }

  async function cancelTournament(id: number) {
    if (!confirm(`Cancel #${id} + refund?`)) return;
    const res = await fetch(`${API}/api/admin/tournaments/${id}/cancel`, {
      method: 'POST',
      headers: headers(),
      body: '{}',
    });
    const data = await res.json();
    if (res.ok) {
      flash(`Cancelled (${data.refunded} refunded)`, 'close');
      await loadTournaments();
    } else error = data.error || 'cancel_failed';
  }

  async function createTemplate() {
    if (!tform.name.trim()) {
      error = 'Name required';
      return;
    }
    creatingTemplate = true;
    error = '';
    try {
      const payload = { ...tform, blindStructureId: Number(tform.blindStructureId) };
      const res = await fetch(`${API}/api/admin/tournament-templates`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`Template #${data.templateId} created`, 'success');
        showTemplateForm = false;
        tform.name = '';
        await loadTournaments();
      } else error = data.error || 'create_failed';
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
      flash(active ? 'Activated' : 'Paused', active ? 'play' : 'pause');
      await loadTournaments();
    }
  }

  async function deleteTemplate(id: number) {
    if (!confirm(`Delete template #${id}?`)) return;
    const res = await fetch(`${API}/api/admin/tournament-templates/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (res.ok) {
      flash('Deleted', 'trash');
      await loadTournaments();
    }
  }

  // ============ ACTIONS — TABLES ============
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
      error = 'Name required';
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
        flash(`Table "${payload.name}" created`, 'success');
        showTableForm = false;
        resetTableForm();
        await loadTables();
      } else error = data.error || 'create_failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      creatingTable = false;
    }
  }

  async function deleteTable(id: number, name: string) {
    if (!confirm(`Delete table "${name}"?`)) return;
    const res = await fetch(`${API}/api/admin/tables/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    const data = await res.json();
    if (res.ok) {
      flash('Deleted', 'trash');
      await loadTables();
    } else error = data.error === 'table_has_players' ? 'Table has live players' : data.error;
  }

  async function toggleTable(id: number, active: boolean) {
    const res = await fetch(`${API}/api/admin/tables/${id}/toggle`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      flash(active ? 'Activated' : 'Paused', active ? 'play' : 'pause');
      await loadTables();
    }
  }

  // ============ ACTIONS — PLAYERS ============
  async function openPlayer(p: any) {
    selectedPlayer = p;
    playerDetail = null;
    playerHistory = null;
    walletAdjustAmount = 0;
    walletAdjustReason = '';
    await loadPlayerDetail(p.id);
  }

  function closePlayer() {
    selectedPlayer = null;
    playerDetail = null;
    playerHistory = null;
  }

  async function banPlayer(id: number, ban: boolean) {
    const reason = prompt(ban ? 'Ban reason:' : 'Unban reason:') ?? 'admin action';
    const res = await fetch(`${API}/api/admin/users/${id}/ban`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ban, reason }),
    });
    if (res.ok) {
      flash(ban ? 'Banned' : 'Unbanned', ban ? 'close' : 'success');
      await loadPlayerDetail(id);
      await loadPlayers();
    } else error = 'ban_failed';
  }

  async function adjustWallet(id: number) {
    if (!walletAdjustAmount) return;
    walletAdjusting = true;
    try {
      const res = await fetch(`${API}/api/admin/users/${id}/wallet`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          amount: walletAdjustAmount,
          reason: walletAdjustReason || 'admin adjustment',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`Balance: ${formatUSD(data.newBalance)}`, 'dollar');
        walletAdjustAmount = 0;
        walletAdjustReason = '';
        await loadPlayerDetail(id);
        await loadPlayers();
      } else error = data.error || 'adjust_failed';
    } finally {
      walletAdjusting = false;
    }
  }

  // ============ ACTIONS — ANTI-CHEAT ============
  async function resolveEvent(id: number) {
    const note = prompt('Resolution note (optional):') ?? '';
    const res = await fetch(`${API}/api/admin/anticheat/events/${id}/resolve`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ note }),
    });
    if (res.ok) {
      flash('Resolved', 'success');
      await loadAnticheat();
    }
  }

  async function banRiskyUser(userId: number) {
    if (!confirm(`Ban user #${userId}?`)) return;
    const res = await fetch(`${API}/api/admin/anticheat/user/${userId}/ban`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ban: true, reason: 'anticheat' }),
    });
    if (res.ok) {
      flash('Banned', 'close');
      await loadAnticheat();
    }
  }

  async function toggleShadowban(userId: number, isShadow: boolean) {
    shadowbanBusy = userId;
    try {
      const url = isShadow
        ? `${API}/api/admin/anticheat/user/${userId}/unshadowban`
        : `${API}/api/admin/anticheat/user/${userId}/shadowban`;
      const res = await fetch(url, { method: 'POST', headers: headers() });
      if (res.ok) {
        flash(isShadow ? 'Unshadowbanned' : 'Shadowbanned', isShadow ? 'success' : 'shield');
        await loadAnticheat();
      } else {
        error = 'toggle failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      shadowbanBusy = null;
    }
  }

  // ============ ACTIONS — BROADCAST ============
  async function createBroadcast() {
    if (!bcastForm.title.trim() || !bcastForm.message.trim()) {
      error = 'Title and message required';
      return;
    }
    broadcasting = true;
    error = '';
    try {
      const res = await fetch(`${API}/api/admin/broadcasts`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(bcastForm),
      });
      const data = await res.json();
      if (res.ok) {
        flash(`Broadcast #${data.broadcastId} sent`, 'broadcast');
        showBroadcastForm = false;
        bcastForm = { title: '', message: '', target: 'all', severity: 'info' };
        await loadBroadcasts();
      } else error = data.error || 'broadcast_failed';
    } finally {
      broadcasting = false;
    }
  }

  async function deleteBroadcast(id: number) {
    if (!confirm(`Delete broadcast #${id}?`)) return;
    const res = await fetch(`${API}/api/admin/broadcasts/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    if (res.ok) {
      flash('Deleted', 'trash');
      await loadBroadcasts();
    }
  }

  // ============ ACTIONS — SETTINGS ============
  async function saveSettings() {
    settingsSaving = true;
    try {
      const payload: Record<string, any> = {};
      for (const k of Object.keys(settings)) {
        payload[k] = settings[k].value;
      }
      const res = await fetch(`${API}/api/admin/settings`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        flash('Settings saved', 'success');
        await loadSettings();
      } else error = 'save_failed';
    } finally {
      settingsSaving = false;
    }
  }

  async function toggleSetting(key: string) {
    settings[key] = { ...settings[key], value: !settings[key].value };
  }

  // ============ HELPERS ============
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

  function fmtMoney(n: any): string {
    return formatUSD(n);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    adminSecret = '';
    authed = false;
  }

  function statusColor(s: string): string {
    if (s === 'running') return '#10b981';
    if (s === 'final_table') return '#d4af37';
    if (s === 'registering') return '#22d3ee';
    if (s === 'scheduled') return '#3b82f6';
    if (s === 'finished') return '#6b7280';
    if (s === 'paused') return '#f59e0b';
    if (s === 'cancelled') return '#ef4444';
    return '#6b7280';
  }

  function variantColor(v: string): string {
    if (v === 'holdem') return '#3b82f6';
    if (v === 'omaha4') return '#ef4444';
    if (v === 'omaha5') return '#10b981';
    return '#d4af37';
  }

  function variantLabel(v: string): string {
    if (v === 'holdem') return "Hold'em";
    if (v === 'omaha4') return 'Omaha 4';
    if (v === 'omaha5') return 'Omaha 5';
    return v;
  }

  $: filteredTables =
    tableFilter === 'all' ? tables : tables.filter((t) => t.variant === tableFilter);

  $: filteredTournaments =
    tourneyFilter === 'all' ? tournaments : tournaments.filter((t) => t.status === tourneyFilter);

  $: tablesByVariant = {
    holdem: tables.filter((t) => t.variant === 'holdem').length,
    omaha4: tables.filter((t) => t.variant === 'omaha4').length,
    omaha5: tables.filter((t) => t.variant === 'omaha5').length,
  };

  const TABS: { key: Tab; label: string; paths: string[] }[] = [
    {
      key: 'overview',
      label: 'Overview',
      paths: ['M3 13h8V3H3zM13 21h8V11h-8zM13 3v6h8V3zM3 21h8v-6H3z'],
    },
    {
      key: 'tournaments',
      label: 'Tournaments',
      paths: [
        'M6 9H4.5a2.5 2.5 0 0 1 0-5H6',
        'M18 9h1.5a2.5 2.5 0 0 0 0-5H18',
        'M4 22h16',
        'M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22',
        'M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22',
        'M18 2H6v7a6 6 0 0 0 12 0V2z',
      ],
    },
    {
      key: 'tables',
      label: 'Tables',
      paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z'],
    },
    {
      key: 'players',
      label: 'Players',
      paths: [
        'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2',
        'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
        'M23 21v-2a4 4 0 0 0-3-3.87',
        'M16 3.13a4 4 0 0 1 0 7.75',
      ],
    },
    {
      key: 'anticheat',
      label: 'Anti-Cheat',
      paths: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M12 8v4', 'M12 16h.01'],
    },
    {
      key: 'wallet',
      label: 'Wallet',
      paths: [
        'M21 12V7H5a2 2 0 0 1 0-4h14v4',
        'M3 5v14a2 2 0 0 0 2 2h16v-5',
        'M18 12a2 2 0 0 0 0 4h4v-4z',
      ],
    },
    {
      key: 'broadcast',
      label: 'Broadcast',
      paths: [
        'M11 5L6 9H2v6h4l5 4V5z',
        'M15.54 8.46a5 5 0 0 1 0 7.07',
        'M19.07 4.93a10 10 0 0 1 0 14.14',
      ],
    },
    {
      key: 'settings',
      label: 'Settings',
      paths: [
        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
        'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
      ],
    },
  ];

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

  <!-- HEADER -->
  <div class="flex items-center gap-2 mt-3 mb-4">
    <button
      on:click={onBack}
      aria-label="Back"
      class="w-10 h-10 rounded-full flex items-center justify-center text-white/70 active:scale-95"
      style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.25);"
    >
      <Icon name="arrow-left" size={18} color="#ffffff" />
    </button>
    <h1 class="text-xl font-extrabold flex-1 flex items-center gap-2">
      <Icon name="settings" size={20} />
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
    <!-- LOGIN -->
    <div class="card space-y-3 mt-8">
      <div class="text-center mb-2">
        <div class="flex justify-center mb-2">
          <Icon name="lock" size={48} color="#d4af37" />
        </div>
        <p class="text-sm text-white/60">Enter admin secret to continue</p>
      </div>
      <input
        type="password"
        bind:value={adminSecret}
        on:keydown={(e) => e.key === 'Enter' && login()}
        placeholder="Admin secret"
        class="w-full rounded-xl px-3 py-3 text-sm text-white outline-none"
        style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
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
    <!-- TABS -->
    <div class="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar pb-1">
      {#each TABS as tab}
        <button
          on:click={() => loadTab(tab.key)}
          class="shrink-0 px-3 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1.5"
          style="
            background: {activeTab === tab.key
            ? 'linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%)'
            : 'linear-gradient(180deg, rgba(15,31,58,0.7), rgba(11,19,36,0.9))'};
            color: {activeTab === tab.key ? '#0a0800' : 'rgba(255,255,255,0.65)'};
            border: 1px solid {activeTab === tab.key ? 'transparent' : 'rgba(212,175,55,0.15)'};
          "
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            {#each tab.paths as d}<path {d} />{/each}
          </svg>
          {tab.label}
        </button>
      {/each}
    </div>

    {#if error}
      <div
        class="rounded-xl p-3 mb-3"
        style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);"
      >
        <p class="text-xs text-red-300 font-bold text-center">{error}</p>
      </div>
    {/if}

    <!-- TAB: OVERVIEW -->
    {#if activeTab === 'overview'}
      {#if overviewLoading || !overview}
        <div class="space-y-2">
          {#each Array(3) as _}
            <div
              class="rounded-2xl p-3 h-[100px] shimmer"
              style="background: linear-gradient(180deg, rgba(15,31,58,0.6), rgba(11,19,36,0.8));"
            ></div>
          {/each}
        </div>
      {:else}
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="card !p-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Users</p>
              <Icon name="users" size={14} color="#60a5fa" />
            </div>
            <p class="text-2xl font-extrabold text-white tabular-nums">{overview.users.total}</p>
            <div class="flex gap-2 mt-2 text-[10px]">
              <span class="text-emerald-400 font-bold">+{overview.users.new24h} 24h</span>
              <span class="text-white/40">·</span>
              <span class="text-red-300 font-bold">{overview.users.banned} banned</span>
            </div>
            {#if overview.users.highRisk > 0}
              <p class="text-[10px] text-orange-400 font-bold mt-1 flex items-center gap-1">
                <Icon name="warning" size={11} color="#fb923c" />
                <span>{overview.users.highRisk} high risk</span>
              </p>
            {/if}
          </div>

          <div class="card !p-3">
            <div class="flex items-center justify-between mb-2">
              <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold">Tables</p>
              <Icon name="tables" size={14} color="#d4af37" />
            </div>
            <p class="text-2xl font-extrabold text-white tabular-nums">
              {overview.tables.active}<span class="text-white/40 text-sm"
                >/{overview.tables.total}</span
              >
            </p>
            <div class="flex gap-2 mt-2 text-[10px] font-mono">
              <span class="text-blue-400">{overview.tables.byVariant.holdem}HE</span>
              <span class="text-red-400">{overview.tables.byVariant.omaha4}O4</span>
              <span class="text-emerald-400">{overview.tables.byVariant.omaha5}O5</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-3">
          <div class="card !p-3">
            <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">
              Tournaments
            </p>
            <p class="text-2xl font-extrabold text-white tabular-nums">
              {overview.tournaments.total}
            </p>
            <div class="flex gap-2 mt-2 text-[10px]">
              {#if overview.tournaments.running > 0}
                <span class="text-emerald-400 font-bold">● {overview.tournaments.running} live</span
                >
              {/if}
              {#if overview.tournaments.registering > 0}
                <span class="text-cyan-400 font-bold">{overview.tournaments.registering} open</span>
              {/if}
            </div>
            <p class="text-[10px] text-gold font-mono mt-1">
              Rake: {fmtMoney(overview.tournaments.totalRake)}
            </p>
          </div>

          <div class="card !p-3">
            <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Wallet</p>
            <p class="text-2xl font-extrabold text-gold tabular-nums">
              {fmtMoney(overview.wallet.totalBalance)}
            </p>
            <p class="text-[10px] text-white/50 mt-1">{overview.wallet.totalWallets} wallets</p>
            <p class="text-[10px] text-white/40 font-mono">
              avg {fmtMoney(overview.wallet.avgBalance)}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mb-3">
          <button
            on:click={() => loadTab('anticheat')}
            class="card !p-3 text-left active:scale-[0.98] transition"
            style={overview.anticheat.unresolved > 0 ? 'border-color: rgba(239,68,68,0.5);' : ''}
          >
            <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">
              Anti-Cheat
            </p>
            <p
              class="text-2xl font-extrabold tabular-nums"
              style="color: {overview.anticheat.unresolved > 0 ? '#ef4444' : '#6b7280'};"
            >
              {overview.anticheat.unresolved}
            </p>
            <p class="text-[10px] text-white/50 mt-1">unresolved</p>
            {#if overview.anticheat.highRisk > 0}
              <p class="text-[10px] text-orange-400 font-bold mt-1">
                {overview.anticheat.highRisk} high-risk users
              </p>
            {/if}
          </button>

          <div class="card !p-3">
            <p class="text-[9px] text-white/40 uppercase tracking-wider font-bold mb-2">Live Now</p>
            <p class="text-2xl font-extrabold text-emerald-400 tabular-nums">
              {overview.live.rooms}
            </p>
            <p class="text-[10px] text-white/50 mt-1">active rooms</p>
            <p class="text-[10px] text-white/40 font-mono">
              {overview.live.players} players · {overview.live.hands} hands
            </p>
          </div>
        </div>

        {#if liveRooms.length > 0}
          <h3 class="text-sm font-extrabold text-white mb-2 mt-4 flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span>Live Rooms</span>
          </h3>
          <div class="space-y-2 mb-4">
            {#each liveRooms as r}
              <div
                class="rounded-2xl p-3"
                style="background: rgba(16,26,58,0.7); border: 1px solid rgba(16,185,129,0.4);"
              >
                <div class="flex items-center justify-between mb-2">
                  <p class="text-sm font-extrabold text-white">Table #{r.tableId}</p>
                  <span class="text-[10px] font-mono text-emerald-400"
                    >{r.phase} · hand #{r.handNo}</span
                  >
                </div>
                <div class="flex justify-between text-[10px] text-white/50">
                  <span>Pot: {fmtMoney(r.pot)}</span>
                  <span>{r.players.length} players</span>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <h3 class="text-sm font-extrabold text-white mb-2 mt-4 flex items-center gap-2">
          <Icon name="users" size={16} />
          <span>Recent Signups</span>
        </h3>
        <div class="space-y-1.5 mb-4">
          {#each overview.recentUsers as u}
            <div
              class="rounded-xl px-3 py-2 flex items-center gap-2"
              style="background: rgba(16,26,58,0.5); border: 1px solid rgba(37,99,235,0.15);"
            >
              <p class="flex-1 text-[11px] font-bold text-white truncate">
                {u.displayName || 'Anon'}
              </p>
              {#if u.isBanned}<span class="text-[9px] text-red-300 font-bold">BANNED</span>{/if}
              <span class="text-[9px] text-white/40 font-mono">{fmtDate(u.createdAt)}</span>
            </div>
          {/each}
        </div>

        <button
          on:click={loadOverview}
          class="w-full btn-gold py-2.5 text-[12px] flex items-center justify-center gap-2"
        >
          <Icon name="refresh" size={14} color="#0a0800" />
          <span>Refresh</span>
        </button>
      {/if}
    {/if}

    <!-- TAB: TOURNAMENTS -->
    {#if activeTab === 'tournaments'}
      <div class="flex gap-2 mb-3">
        <button
          on:click={() => (showCreate = !showCreate)}
          class="flex-1 btn-gold flex items-center justify-center gap-2"
        >
          {#if showCreate}
            <Icon name="close" size={14} color="#0a0800" />
            <span>Close</span>
          {:else}
            <Icon name="plus" size={14} color="#0a0800" />
            <span>Create Tournament</span>
          {/if}
        </button>
        <button
          on:click={loadTournaments}
          aria-label="Refresh tournaments"
          class="w-12 rounded-xl text-white/70 active:scale-95 flex items-center justify-center"
          style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>

      {#if showCreate}
        <div class="card space-y-4 mb-4">
          <div>
            <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1">
              Tournament Name
            </span>
            <input
              type="text"
              bind:value={form.name}
              placeholder="e.g. Daily Freeroll #1"
              class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <p class="text-[9px] text-white/40 mt-1 leading-snug">
              Display name shown to all players in the tournaments list.
            </p>
          </div>

          <div>
            <label
              for="t-start"
              class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
            >
              Scheduled Start <span class="text-white/30 normal-case font-normal">(optional)</span>
            </label>
            <input
              id="t-start"
              type="datetime-local"
              bind:value={form.scheduledStart}
              class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none font-mono"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25); color-scheme: dark;"
            />
            <p class="text-[9px] text-white/40 mt-1 leading-snug">
              Leave empty for instant SNG. Set a future UTC time to auto-start an MTT.
            </p>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Variant</span
              >
              <select
                bind:value={form.variant}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              >
                <option value="holdem">Hold'em</option>
                <option value="omaha4">Omaha 4</option>
                <option value="omaha5">Omaha 5</option>
              </select>
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Poker variant. Hold'em = 2 hole cards, Omaha = 4 or 5.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Mode</span
              >
              <select
                bind:value={form.mode}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              >
                <option value="free">Free</option>
                <option value="real">Real</option>
              </select>
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Free = play money chips. Real = USD balance.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Format</span
              >
              <select
                bind:value={form.format}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              >
                <option value="sng">SNG</option>
                <option value="mtt">MTT</option>
                <option value="freeroll">Freeroll</option>
              </select>
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                SNG = starts when full. MTT = scheduled. Freeroll = no buy-in.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Buy-in ($)</span
              >
              <input
                type="number"
                bind:value={form.buyIn}
                placeholder="0"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Entry cost in USD. Use 0 for freeroll.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Fee ($)</span
              >
              <input
                type="number"
                bind:value={form.fee}
                placeholder="0"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Platform rake per player. Standard: SNG 6%, MTT 8%.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Starting Stack</span
              >
              <input
                type="number"
                bind:value={form.startingStack}
                placeholder="1500"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Chips each player starts with. Typical: 1500 SNG, 5000 Turbo MTT.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2">
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Min Players</span
              >
              <input
                type="number"
                bind:value={form.minPlayers}
                placeholder="2"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Won't start below this. Typical: 2 for HU, 6 for SNG, 10+ for MTT.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Max Players</span
              >
              <input
                type="number"
                bind:value={form.maxPlayers}
                placeholder="9"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Hard cap on seats. Typical: 9 for SNG, 100+ for MTT.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Speed</span
              >
              <select
                bind:value={form.speed}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              >
                <option value="regular">Regular</option>
                <option value="turbo">Turbo</option>
                <option value="hyper">Hyper</option>
              </select>
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Action timer per turn. Regular 30s, Turbo 10s, Hyper 8s.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Late Reg Level</span
              >
              <input
                type="number"
                bind:value={form.lateRegLevel}
                placeholder="0"
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              />
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Last blind level allowing late registration. 0 = disabled.
              </p>
            </div>
            <div>
              <span class="block text-[10px] uppercase tracking-wider text-white/60 font-bold mb-1"
                >Blind Structure</span
              >
              <select
                bind:value={form.blindStructureId}
                class="w-full rounded-lg px-2 py-2.5 text-xs text-white outline-none"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
              >
                {#each blindStructures as b}<option value={b.id}>{b.name}</option>{/each}
              </select>
              <p class="text-[9px] text-white/40 mt-1 leading-snug">
                Predefined blind progression (sb/bb/ante per level).
              </p>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label
                class="flex items-center gap-2 text-[11px] font-bold text-white/80 py-1 cursor-pointer"
              >
                <input
                  type="checkbox"
                  bind:checked={form.allowReEntry}
                  class="w-4 h-4 accent-gold"
                />
                <span>Allow Re-entry</span>
              </label>
              <p class="text-[9px] text-white/40 leading-snug pl-6">
                Eliminated players can buy back in during late reg.
              </p>
            </div>
            <div>
              <label
                class="flex items-center gap-2 text-[11px] font-bold text-white/80 py-1 cursor-pointer"
              >
                <input type="checkbox" bind:checked={form.isBounty} class="w-4 h-4 accent-gold" />
                <span>Bounty Mode</span>
              </label>
              <p class="text-[9px] text-white/40 leading-snug pl-6">
                Killer earns extra prize per elimination (paid from fee).
              </p>
            </div>
          </div>
          <!-- ══════════ REBUY / ADDON ══════════ -->
          <div
            class="rounded-xl p-3"
            style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.25);"
          >
            <p
              class="text-[10px] uppercase tracking-wider text-blue-300 font-extrabold mb-3 flex items-center gap-1.5"
            >
              <Icon name="refresh" size={12} color="#93c5fd" />
              <span>Rebuy / Addon</span>
            </p>

            <!-- Rebuy -->
            <label
              class="flex items-center gap-2 text-[11px] font-bold text-white/80 py-1 cursor-pointer mb-2"
            >
              <input
                type="checkbox"
                bind:checked={form.allowRebuy}
                class="w-4 h-4 accent-blue-500"
              />
              <span>Enable Rebuy</span>
            </label>
            {#if form.allowRebuy}
              <div class="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <span class="block text-[9px] text-white/50 font-bold mb-1">Max Rebuys</span>
                  <input
                    type="number"
                    min="0"
                    bind:value={form.maxRebuys}
                    placeholder="3"
                    class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                    style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                  />
                  <p class="text-[9px] text-white/40 mt-0.5">0 = unlimited</p>
                </div>
                <div>
                  <span class="block text-[9px] text-white/50 font-bold mb-1">Rebuy $ Cost</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    bind:value={form.rebuyAmount}
                    placeholder="0"
                    class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                    style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                  />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <span class="block text-[9px] text-white/50 font-bold mb-1">Rebuy Stack</span>
                  <input
                    type="number"
                    min="0"
                    bind:value={form.rebuyStack}
                    placeholder="0 (use starting stack)"
                    class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                    style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                  />
                </div>
                <div>
                  <span class="block text-[9px] text-white/50 font-bold mb-1">Until Level</span>
                  <input
                    type="number"
                    min="0"
                    bind:value={form.rebuyUntilLevel}
                    placeholder="6"
                    class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                    style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                  />
                </div>
              </div>
            {/if}

            <!-- Addon -->
            <label
              class="flex items-center gap-2 text-[11px] font-bold text-white/80 py-1 cursor-pointer mt-3 mb-2"
            >
              <input
                type="checkbox"
                bind:checked={form.allowAddon}
                class="w-4 h-4 accent-blue-500"
              />
              <span>Enable Addon</span>
            </label>
            {#if form.allowAddon}
              <div class="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <span class="block text-[9px] text-white/50 font-bold mb-1">Addon $ Cost</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    bind:value={form.addonAmount}
                    placeholder="0"
                    class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                    style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.3);"
                  />
                </div>
                <div>
                  <span class="block text-[9px] text-white/50 font-bold mb-1">Addon Stack</span>
                  <input
                    type="number"
                    min="0"
                    bind:value={form.addonStack}
                    placeholder="0 (use starting stack)"
                    class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                    style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.3);"
                  />
                </div>
              </div>
              <div>
                <span class="block text-[9px] text-white/50 font-bold mb-1">At Level</span>
                <input
                  type="number"
                  min="0"
                  bind:value={form.addonAtLevel}
                  placeholder="6"
                  class="w-full rounded-lg px-2 py-2 text-xs text-white outline-none"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.3);"
                />
                <p class="text-[9px] text-white/40 mt-0.5">Addon offered only at this level</p>
              </div>
            {/if}
          </div>
          <!-- ══════════ SUBMIT ══════════ -->
          <button
            on:click={createTournament}
            disabled={creating}
            class="w-full btn-gold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {#if creating}
              <span>Creating…</span>
            {:else}
              <Icon name="check" size={14} color="#0a0800" />
              <span>Create</span>
            {/if}
          </button>
        </div>
      {/if}

      <div class="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {#each ['all', 'running', 'registering', 'scheduled', 'finished'] as f}
          <button
            on:click={() => (tourneyFilter = f)}
            class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style="background: {tourneyFilter === f
              ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
              : 'rgba(15,31,58,0.7)'}; color: {tourneyFilter === f
              ? '#0a0800'
              : 'rgba(255,255,255,0.65)'};"
          >
            {f}
          </button>
        {/each}
      </div>

      <div class="space-y-2 mb-4">
        {#each filteredTournaments as t}
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
                    >{t.status}</span
                  >
                  <span class="text-[9px] text-white/40">#{t.id}</span>
                </div>
                <p class="text-sm font-extrabold text-white truncate">{t.name}</p>
                <p class="text-[10px] text-white/40">
                  {t.variant.toUpperCase()} · {t.format} · {t.buyIn > 0 ? `$${t.buyIn}` : 'FREE'}
                </p>
                {#if t.allowRebuy || t.allowAddon}
                  <div class="flex gap-1.5 mt-1">
                    {#if t.allowRebuy}
                      <span
                        class="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1"
                        style="background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.4);"
                      >
                        <Icon name="refresh" size={9} color="#93c5fd" />
                        <span>Rebuy</span>
                      </span>
                    {/if}
                    {#if t.allowAddon}
                      <span
                        class="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider inline-flex items-center gap-1"
                        style="background: rgba(37,99,235,0.2); color: #93c5fd; border: 1px solid rgba(37,99,235,0.4);"
                      >
                        <Icon name="gift" size={9} color="#93c5fd" />
                        <span>Addon</span>
                      </span>
                    {/if}
                  </div>
                {/if}
              </div>
              <div class="text-right shrink-0 ml-2">
                <p class="text-[11px] font-bold text-emerald-400 tabular-nums">
                  {t.registeredCount}/{t.maxPlayers}
                </p>
                <p class="text-[9px] text-white/40">players</p>
              </div>
            </div>
            <div class="flex gap-2">
              {#if (t.status === 'registering' || t.status === 'scheduled') && t.registeredCount >= t.minPlayers}
                <button
                  on:click={() => startTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white flex items-center justify-center gap-1"
                  style="background: linear-gradient(180deg, #22c55e, #15803d);"
                >
                  <Icon name="play" size={10} color="#ffffff" />
                  <span>Start</span>
                </button>
              {/if}
              {#if t.status === 'running' || t.status === 'final_table'}
                <button
                  on:click={() => pauseTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white flex items-center justify-center gap-1"
                  style="background: linear-gradient(180deg, #f59e0b, #b45309);"
                >
                  <Icon name="pause" size={10} color="#ffffff" />
                  <span>Pause</span>
                </button>
              {/if}
              {#if t.status === 'paused'}
                <button
                  on:click={() => resumeTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white flex items-center justify-center gap-1"
                  style="background: linear-gradient(180deg, #22c55e, #15803d);"
                >
                  <Icon name="play" size={10} color="#ffffff" />
                  <span>Resume</span>
                </button>
              {/if}
              {#if t.status !== 'finished' && t.status !== 'cancelled'}
                <button
                  on:click={() => cancelTournament(t.id)}
                  class="flex-1 rounded-lg py-1.5 text-[11px] font-bold text-red-300 flex items-center justify-center gap-1"
                  style="background: rgba(220,38,38,0.15); border: 1px solid rgba(220,38,38,0.35);"
                >
                  <Icon name="close" size={10} color="#fca5a5" />
                  <span>Cancel</span>
                </button>
              {/if}
            </div>
          </div>
        {/each}
        {#if filteredTournaments.length === 0}
          <div class="card text-center py-6">
            <p class="text-white/50 text-sm">No tournaments in "{tourneyFilter}"</p>
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-between mt-4 mb-3">
        <h2 class="text-sm font-extrabold text-white flex items-center gap-2">
          <Icon name="calendar" size={16} />
          <span>Recurring Templates</span>
        </h2>
        <button
          on:click={() => (showTemplateForm = !showTemplateForm)}
          class="text-[10px] font-bold text-gold px-2 py-1 rounded-full"
          style="background: rgba(212,175,55,0.15);"
        >
          {showTemplateForm ? 'Close' : '+ New'}
        </button>
      </div>

      {#if showTemplateForm}
        <div class="card space-y-3 mb-3">
          <input
            type="text"
            bind:value={tform.name}
            placeholder="Template name"
            class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
          />
          <div class="grid grid-cols-3 gap-2">
            <select
              bind:value={tform.variant}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="holdem">Hold'em</option><option value="omaha4">Omaha 4</option><option
                value="omaha5">Omaha 5</option
              >
            </select>
            <select
              bind:value={tform.mode}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="free">Free</option><option value="real">Real</option>
            </select>
            <select
              bind:value={tform.scheduleType}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="hourly">Hourly</option><option value="daily">Daily</option><option
                value="weekly">Weekly</option
              >
            </select>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <input
              type="number"
              bind:value={tform.buyIn}
              placeholder="Buy-in"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <input
              type="number"
              bind:value={tform.startingStack}
              placeholder="Stack"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <input
              type="number"
              bind:value={tform.maxPlayers}
              placeholder="Max"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
          </div>
          <select
            bind:value={tform.blindStructureId}
            class="w-full rounded-lg px-2 py-2.5 text-xs text-white"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
          >
            {#each blindStructures as b}<option value={b.id}>{b.name}</option>{/each}
          </select>
          {#if tform.scheduleType !== 'hourly'}
            <input
              type="text"
              bind:value={tform.scheduleTime}
              placeholder="14:00"
              class="w-full rounded-lg px-2 py-2.5 text-xs text-white font-mono"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
          {/if}
          <!-- Rebuy / Addon (template) -->
          <div
            class="rounded-xl p-3"
            style="background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.25);"
          >
            <p
              class="text-[10px] uppercase tracking-wider text-blue-300 font-extrabold mb-3 flex items-center gap-1.5"
            >
              <Icon name="refresh" size={12} color="#93c5fd" />
              <span>Rebuy / Addon</span>
            </p>

            <label
              class="flex items-center gap-2 text-[11px] font-bold text-white/80 py-1 cursor-pointer mb-2"
            >
              <input
                type="checkbox"
                bind:checked={tform.allowRebuy}
                class="w-4 h-4 accent-blue-500"
              />
              <span>Enable Rebuy</span>
            </label>
            {#if tform.allowRebuy}
              <div class="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  bind:value={tform.maxRebuys}
                  placeholder="Max"
                  class="rounded-lg px-2 py-2 text-xs text-white"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  bind:value={tform.rebuyAmount}
                  placeholder="$ Cost"
                  class="rounded-lg px-2 py-2 text-xs text-white"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                />
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  bind:value={tform.rebuyStack}
                  placeholder="Stack"
                  class="rounded-lg px-2 py-2 text-xs text-white"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                />
                <input
                  type="number"
                  min="0"
                  bind:value={tform.rebuyUntilLevel}
                  placeholder="Until L"
                  class="rounded-lg px-2 py-2 text-xs text-white"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(59,130,246,0.3);"
                />
              </div>
            {/if}

            <label
              class="flex items-center gap-2 text-[11px] font-bold text-white/80 py-1 cursor-pointer mt-3 mb-2"
            >
              <input
                type="checkbox"
                bind:checked={tform.allowAddon}
                class="w-4 h-4 accent-blue-500"
              />
              <span>Enable Addon</span>
            </label>
            {#if tform.allowAddon}
              <div class="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  bind:value={tform.addonAmount}
                  placeholder="$ Cost"
                  class="rounded-lg px-2 py-2 text-xs text-white"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.3);"
                />
                <input
                  type="number"
                  min="0"
                  bind:value={tform.addonStack}
                  placeholder="Stack"
                  class="rounded-lg px-2 py-2 text-xs text-white"
                  style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.3);"
                />
              </div>
              <input
                type="number"
                min="0"
                bind:value={tform.addonAtLevel}
                placeholder="At Level"
                class="w-full rounded-lg px-2 py-2 text-xs text-white"
                style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.3);"
              />
            {/if}
          </div>

          <button
            on:click={createTemplate}
            disabled={creatingTemplate}
            class="w-full btn-gold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {#if creatingTemplate}
              <span>Creating…</span>
            {:else}
              <Icon name="check" size={14} color="#0a0800" />
              <span>Create Template</span>
            {/if}
          </button>
        </div>
      {/if}

      <div class="space-y-2 mb-4">
        {#each templates as tpl}
          <div
            class="rounded-2xl p-3"
            style="background: rgba(16,26,58,0.7); border: 1px solid {tpl.isActive
              ? 'rgba(16,185,129,0.4)'
              : 'rgba(107,114,128,0.3)'};"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1 min-w-0">
                <span
                  class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                  style="background: {tpl.isActive
                    ? 'rgba(16,185,129,0.25)'
                    : 'rgba(107,114,128,0.25)'}; color: {tpl.isActive ? '#6ee7b7' : '#9ca3af'};"
                  >{tpl.isActive ? 'ACTIVE' : 'PAUSED'}</span
                >
                <p class="text-sm font-extrabold text-white truncate mt-1">{tpl.name}</p>
                <p class="text-[10px] text-white/40">
                  {tpl.scheduleType}{tpl.scheduleType !== 'hourly' ? ` @ ${tpl.scheduleTime}` : ''}
                </p>
              </div>
              <div class="text-right shrink-0 ml-2">
                <p class="text-[9px] text-white/40">Next</p>
                <p class="text-[10px] font-mono text-gold">{fmtDate(tpl.nextRunAt)}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button
                on:click={() => toggleTemplate(tpl.id, !tpl.isActive)}
                class="flex-1 rounded-lg py-1.5 text-[11px] font-bold flex items-center justify-center gap-1"
                style="background: {tpl.isActive
                  ? 'rgba(245,158,11,0.15)'
                  : 'linear-gradient(180deg, #22c55e, #15803d)'}; color: {tpl.isActive
                  ? '#fcd34d'
                  : 'white'};"
              >
                <Icon
                  name={tpl.isActive ? 'pause' : 'play'}
                  size={10}
                  color={tpl.isActive ? '#fcd34d' : '#ffffff'}
                />
                <span>{tpl.isActive ? 'Pause' : 'Activate'}</span>
              </button>
              <button
                on:click={() => deleteTemplate(tpl.id)}
                class="rounded-lg px-3 py-1.5 text-[11px] font-bold text-red-300 flex items-center"
                style="background: rgba(220,38,38,0.15);"
              >
                <Icon name="trash" size={12} color="#fca5a5" />
              </button>
            </div>
          </div>
        {/each}
        {#if templates.length === 0}
          <div class="card text-center py-4"><p class="text-white/50 text-xs">No templates</p></div>
        {/if}
      </div>
    {/if}

    <!-- TAB: TABLES -->
    {#if activeTab === 'tables'}
      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="card !p-2.5 text-center">
          <p class="text-[9px] font-bold" style="color:#3b82f6;">HE</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{tablesByVariant.holdem}</p>
        </div>
        <div class="card !p-2.5 text-center">
          <p class="text-[9px] font-bold" style="color:#ef4444;">O4</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{tablesByVariant.omaha4}</p>
        </div>
        <div class="card !p-2.5 text-center">
          <p class="text-[9px] font-bold" style="color:#10b981;">O5</p>
          <p class="text-xl font-extrabold text-white tabular-nums">{tablesByVariant.omaha5}</p>
        </div>
      </div>

      <div class="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {#each [{ k: 'all', l: 'All' }, { k: 'holdem', l: 'HE' }, { k: 'omaha4', l: 'O4' }, { k: 'omaha5', l: 'O5' }] as f}
          <button
            on:click={() => (tableFilter = f.k as any)}
            class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style="background: {tableFilter === f.k
              ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
              : 'rgba(15,31,58,0.7)'}; color: {tableFilter === f.k
              ? '#0a0800'
              : 'rgba(255,255,255,0.65)'};">{f.l}</button
          >
        {/each}
      </div>

      <div class="flex gap-2 mb-3">
        <button
          on:click={() => (showTableForm = !showTableForm)}
          class="flex-1 btn-gold flex items-center justify-center gap-2"
        >
          {#if showTableForm}
            <Icon name="close" size={14} color="#0a0800" />
            <span>Close</span>
          {:else}
            <Icon name="plus" size={14} color="#0a0800" />
            <span>Add Table</span>
          {/if}
        </button>
        <button
          on:click={loadTables}
          class="w-12 rounded-xl text-white/70 flex items-center justify-center"
          style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>

      {#if showTableForm}
        <div class="card space-y-3 mb-4">
          <input
            type="text"
            bind:value={tableForm.name}
            placeholder="Table name"
            class="w-full rounded-lg px-3 py-2.5 text-sm text-white"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
          />
          <div class="grid grid-cols-2 gap-2">
            <select
              bind:value={tableForm.variant}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="holdem">Hold'em</option><option value="omaha4">Omaha 4</option><option
                value="omaha5">Omaha 5</option
              >
            </select>
            <select
              bind:value={tableForm.mode}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="free">Free</option><option value="real">Real</option>
            </select>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <input
              type="number"
              bind:value={tableForm.small_blind}
              placeholder="SB"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <input
              type="number"
              bind:value={tableForm.big_blind}
              placeholder="BB"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <input
              type="number"
              bind:value={tableForm.ante}
              placeholder="Ante"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
          </div>
          <div class="grid grid-cols-3 gap-2">
            <input
              type="number"
              bind:value={tableForm.min_buyin}
              placeholder="Min buy"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <input
              type="number"
              bind:value={tableForm.max_buyin}
              placeholder="Max buy"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
            <input
              type="number"
              bind:value={tableForm.seats}
              placeholder="Seats"
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            />
          </div>
          <input
            type="number"
            step="0.01"
            bind:value={tableForm.rake_pct}
            placeholder="Rake (0.03 = 3%)"
            class="w-full rounded-lg px-2 py-2.5 text-xs text-white"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
          />
          <button
            on:click={createTable}
            disabled={creatingTable}
            class="w-full btn-gold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {#if creatingTable}
              <span>Creating…</span>
            {:else}
              <Icon name="check" size={14} color="#0a0800" />
              <span>Create Table</span>
            {/if}
          </button>
        </div>
      {/if}

      {#if tablesLoading}
        <p class="text-white/40 text-center py-8">Loading…</p>
      {:else if filteredTables.length === 0}
        <div class="card text-center py-8">
          <p class="text-white/50 text-sm">No tables in this filter</p>
        </div>
      {:else}
        <div class="space-y-2">
          {#each filteredTables as tb}
            {@const accent = variantColor(tb.variant)}
            <div
              class="rounded-2xl p-3 relative overflow-hidden"
              style="background: linear-gradient(135deg, rgba(15,31,58,0.85), rgba(7,14,27,0.95)); border: 1.5px solid {tb.is_active
                ? accent + '50'
                : 'rgba(107,114,128,0.4)'}; {tb.is_active ? '' : 'opacity: 0.65;'}"
            >
              <div
                class="absolute left-0 top-0 bottom-0 w-1"
                style="background: linear-gradient(180deg, {accent}, {accent}66);"
              ></div>
              <div class="pl-2">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span
                        class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                        style="background: {accent}25; color: {accent}; border: 1px solid {accent}60;"
                        >{variantLabel(tb.variant)}</span
                      >
                      <span
                        class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                        style="background: {tb.mode === 'free'
                          ? 'rgba(16,185,129,0.2)'
                          : 'rgba(212,175,55,0.2)'}; color: {tb.mode === 'free'
                          ? '#6ee7b7'
                          : '#f4e5a8'};">{tb.mode}</span
                      >
                      {#if !tb.is_active}<span
                          class="text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                          style="background: rgba(107,114,128,0.25); color: #9ca3af;">PAUSED</span
                        >{/if}
                      <span class="text-[9px] text-white/40">#{tb.id}</span>
                    </div>
                    <p class="text-sm font-extrabold text-white truncate">{tb.name}</p>
                    <p class="text-[10px] text-white/50 font-mono tabular-nums">
                      {tb.blinds?.sb}/{tb.blinds?.bb} · {tb.seats} seats
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
                    class="flex-1 rounded-lg py-1.5 text-[11px] font-bold flex items-center justify-center gap-1"
                    style="background: {tb.is_active
                      ? 'rgba(245,158,11,0.15)'
                      : 'linear-gradient(180deg, #22c55e, #15803d)'}; color: {tb.is_active
                      ? '#fcd34d'
                      : 'white'};"
                  >
                    <Icon
                      name={tb.is_active ? 'pause' : 'play'}
                      size={10}
                      color={tb.is_active ? '#fcd34d' : '#ffffff'}
                    />
                    <span>{tb.is_active ? 'Pause' : 'Activate'}</span>
                  </button>
                  <button
                    on:click={() => deleteTable(tb.id, tb.name)}
                    class="rounded-lg px-3 py-1.5 text-[11px] font-bold text-red-300 flex items-center"
                    style="background: rgba(220,38,38,0.15);"
                  >
                    <Icon name="trash" size={12} color="#fca5a5" />
                  </button>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- TAB: PLAYERS -->
    {#if activeTab === 'players'}
      <div class="flex gap-2 mb-3">
        <input
          type="text"
          bind:value={playersSearch}
          on:keydown={(e) => e.key === 'Enter' && loadPlayers()}
          placeholder="Search by name, username, telegram id…"
          class="flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
          style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
        />
        <button
          on:click={loadPlayers}
          aria-label="Search players"
          class="px-3 rounded-xl text-white/70 flex items-center justify-center"
          style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="search" size={16} />
        </button>
      </div>

      <div class="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar">
        {#each [{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'banned', l: 'Banned' }, { k: 'high_risk', l: 'High Risk' }] as f}
          <button
            on:click={() => {
              playersFilter = f.k as any;
              loadPlayers();
            }}
            class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            style="background: {playersFilter === f.k
              ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
              : 'rgba(15,31,58,0.7)'}; color: {playersFilter === f.k
              ? '#0a0800'
              : 'rgba(255,255,255,0.65)'};">{f.l}</button
          >
        {/each}
      </div>

      <p class="text-[10px] text-white/50 mb-2">{playersTotal} players found</p>

      {#if playersLoading}
        <p class="text-white/40 text-center py-8">Loading…</p>
      {:else}
        <div class="space-y-1.5">
          {#each players as p}
            <button
              on:click={() => openPlayer(p)}
              class="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2"
              style="background: rgba(16,26,58,0.7); border: 1px solid {p.isBanned
                ? 'rgba(239,68,68,0.4)'
                : 'rgba(37,99,235,0.15)'};"
            >
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                style="background: {p.isBanned
                  ? 'rgba(239,68,68,0.2)'
                  : 'rgba(59,130,246,0.2)'}; color: {p.isBanned ? '#fca5a5' : '#93c5fd'};"
              >
                {(p.displayName || 'A')[0].toUpperCase()}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-[12px] font-extrabold text-white truncate">
                    {p.displayName || 'Anon'}
                  </p>
                  {#if p.isBanned}<span
                      class="text-[8px] font-bold text-red-300 px-1 rounded"
                      style="background: rgba(239,68,68,0.2);">BANNED</span
                    >{/if}
                  {#if p.riskScore >= 65}<span
                      class="text-[8px] font-bold text-orange-300 px-1 rounded"
                      style="background: rgba(245,158,11,0.2);">RISK {p.riskScore}</span
                    >{/if}
                </div>
                <p class="text-[9px] text-white/40 font-mono truncate">
                  @{p.username || 'anon'} · tg:{p.telegramId}
                </p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-[11px] font-bold text-gold tabular-nums">{fmtMoney(p.balanceUsd)}</p>
                <p class="text-[9px] text-white/40">{p.freeChips} chips</p>
              </div>
            </button>
          {/each}
          {#if players.length === 0}
            <div class="card text-center py-6">
              <p class="text-white/50 text-sm">No players found</p>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- TAB: ANTI-CHEAT -->
    {#if activeTab === 'anticheat'}
      {#if anticheatLoading}
        <p class="text-white/40 text-center py-8">Loading…</p>
      {:else}
        {#if anticheat}
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div class="card !p-3 text-center">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Unresolved</p>
              <p
                class="text-2xl font-extrabold tabular-nums"
                style="color: {anticheat.unresolvedTotal > 0 ? '#ef4444' : '#6b7280'};"
              >
                {anticheat.unresolvedTotal}
              </p>
            </div>
            <div class="card !p-3 text-center">
              <p class="text-[9px] text-white/40 uppercase font-bold mb-1">High-Risk Users</p>
              <p
                class="text-2xl font-extrabold tabular-nums"
                style="color: {anticheat.highRiskUsers > 0 ? '#f59e0b' : '#6b7280'};"
              >
                {anticheat.highRiskUsers}
              </p>
            </div>
          </div>

          {#if anticheat.byType && anticheat.byType.length > 0}
            <div class="card !p-3 mb-3">
              <p class="text-[10px] text-white/40 uppercase font-bold mb-2">Events by Type</p>
              <div class="flex flex-wrap gap-1.5">
                {#each anticheat.byType as t}
                  <span
                    class="text-[10px] font-mono px-2 py-1 rounded"
                    style="background: rgba(239,68,68,0.15); color: #fca5a5;"
                  >
                    {t.type}: {t.count}
                  </span>
                {/each}
              </div>
            </div>
          {/if}
        {/if}

        <!-- Risky Users -->
        <h3 class="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
          <Icon name="warning" size={16} color="#fb923c" />
          <span>Risky Users</span>
        </h3>
        <div class="space-y-1.5 mb-4">
          {#each riskyUsers as u}
            <div
              class="rounded-xl px-3 py-2 flex items-center gap-2"
              style="background: rgba(16,26,58,0.7); border: 1px solid rgba(245,158,11,0.35);"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-[12px] font-extrabold text-white truncate">{u.display_name}</p>
                  <span class="text-[9px] font-bold text-orange-300">Score {u.score}</span>
                  {#if u.is_banned}<span class="text-[8px] font-bold text-red-300">BANNED</span
                    >{/if}
                </div>
                <p class="text-[9px] text-white/40 font-mono">tg:{u.telegram_id}</p>
              </div>
              {#if !u.is_banned}
                <button
                  on:click={() => banRiskyUser(u.user_id)}
                  class="rounded-lg px-3 py-1.5 text-[10px] font-bold text-red-300"
                  style="background: rgba(220,38,38,0.15);">Ban</button
                >
              {/if}
            </div>
          {/each}
          {#if riskyUsers.length === 0}
            <div class="card text-center py-4">
              <p class="text-white/50 text-xs flex items-center justify-center gap-1.5">
                <Icon name="success" size={12} color="#6ee7b7" />
                <span>No risky users</span>
              </p>
            </div>
          {/if}
        </div>

        <!-- Shadowbanned -->
        <h3 class="text-sm font-extrabold text-white mb-2 mt-4 flex items-center gap-2">
          <Icon name="shield" size={16} color="#93c5fd" />
          <span>Shadowbanned / Banned</span>
        </h3>
        <div class="space-y-1.5 mb-4">
          {#each shadowbanned as u}
            {@const isShadow = u.action_taken === 'shadowban'}
            <div
              class="rounded-xl px-3 py-2 flex items-center gap-2"
              style="background: rgba(16,26,58,0.7); border: 1px solid {isShadow
                ? 'rgba(37,99,235,0.4)'
                : 'rgba(239,68,68,0.4)'};"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span
                    class="text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase"
                    style="background: {isShadow
                      ? 'rgba(37,99,235,0.25)'
                      : 'rgba(239,68,68,0.25)'}; color: {isShadow ? '#93c5fd' : '#fca5a5'};"
                  >
                    {isShadow ? 'SHADOW' : 'BANNED'}
                  </span>
                  <p class="text-[12px] font-extrabold text-white truncate">
                    {u.display_name || `User #${u.user_id}`}
                  </p>
                  <span class="text-[9px] text-orange-300 font-bold">Score {u.score}</span>
                </div>
                <p class="text-[9px] text-white/40 font-mono mt-0.5">
                  tg:{u.telegram_id} · {fmtDate(u.last_updated)}
                </p>
              </div>
              {#if isShadow}
                <button
                  on:click={() => toggleShadowban(u.user_id, true)}
                  disabled={shadowbanBusy === u.user_id}
                  class="rounded-lg px-3 py-1.5 text-[10px] font-bold disabled:opacity-40"
                  style="background: linear-gradient(180deg, #22c55e, #15803d); color: white;"
                >
                  {shadowbanBusy === u.user_id ? '…' : 'Unshadowban'}
                </button>
              {/if}
            </div>
          {/each}
          {#if shadowbanned.length === 0}
            <div class="card text-center py-4">
              <p class="text-white/50 text-xs flex items-center justify-center gap-1.5">
                <Icon name="success" size={12} color="#6ee7b7" />
                <span>No shadowbanned users</span>
              </p>
            </div>
          {/if}
        </div>

        <!-- Events -->
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-sm font-extrabold text-white flex items-center gap-2">
            <Icon name="warning" size={16} color="#ef4444" />
            <span>Events</span>
          </h3>
          <div class="flex gap-1">
            {#each [{ k: 'unresolved', l: 'Open' }, { k: 'resolved', l: 'Done' }, { k: 'all', l: 'All' }] as f}
              <button
                on:click={() => {
                  anticheatFilter = f.k as any;
                  loadAnticheat();
                }}
                class="px-2 py-1 rounded-full text-[9px] font-bold"
                style="background: {anticheatFilter === f.k
                  ? 'rgba(212,175,55,0.3)'
                  : 'rgba(15,31,58,0.7)'}; color: {anticheatFilter === f.k
                  ? '#f4e5a8'
                  : 'rgba(255,255,255,0.6)'};">{f.l}</button
              >
            {/each}
          </div>
        </div>
        <div class="space-y-1.5">
          {#each anticheatEvents as e}
            <div
              class="rounded-xl px-3 py-2"
              style="background: rgba(16,26,58,0.7); border: 1px solid {e.resolved
                ? 'rgba(107,114,128,0.3)'
                : 'rgba(239,68,68,0.4)'};"
            >
              <div class="flex items-center gap-1.5 mb-1">
                <span
                  class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                  style="background: rgba(239,68,68,0.2); color: #fca5a5;">{e.type}</span
                >
                <span class="text-[9px] text-white/40">sev {e.severity}</span>
                {#if e.resolved}
                  <span class="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
                    <Icon name="check" size={10} color="#6ee7b7" />
                    <span>DONE</span>
                  </span>
                {/if}
                <span class="text-[9px] text-white/30 ml-auto font-mono"
                  >{fmtDate(e.created_at)}</span
                >
              </div>
              <p class="text-[11px] text-white/80">
                <span class="font-bold">{e.user_name}</span>
                {#if e.other_name}<span class="text-white/50"> vs </span><span class="font-bold"
                    >{e.other_name}</span
                  >{/if}
              </p>
              {#if !e.resolved}
                <div class="flex gap-1.5 mt-2">
                  <button
                    on:click={() => resolveEvent(e.id)}
                    class="flex-1 rounded-lg py-1 text-[10px] font-bold text-white"
                    style="background: linear-gradient(180deg, #22c55e, #15803d);">Resolve</button
                  >
                  <button
                    on:click={() => banRiskyUser(e.user_id)}
                    class="rounded-lg px-3 py-1 text-[10px] font-bold text-red-300"
                    style="background: rgba(220,38,38,0.15);">Ban</button
                  >
                </div>
              {/if}
            </div>
          {/each}
          {#if anticheatEvents.length === 0}
            <div class="card text-center py-4"><p class="text-white/50 text-xs">No events</p></div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- TAB: WALLET -->
    {#if activeTab === 'wallet'}
      {#if overview}
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="card !p-3 text-center">
            <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Wallets</p>
            <p class="text-xl font-extrabold text-white tabular-nums">
              {overview.wallet.totalWallets}
            </p>
          </div>
          <div class="card !p-3 text-center">
            <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Total Balance</p>
            <p class="text-xl font-extrabold text-gold tabular-nums">
              {fmtMoney(overview.wallet.totalBalance)}
            </p>
          </div>
          <div class="card !p-3 text-center">
            <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Avg</p>
            <p class="text-xl font-extrabold text-cyan tabular-nums">
              {fmtMoney(overview.wallet.avgBalance)}
            </p>
          </div>
        </div>
      {/if}

      <div class="card !p-3 mb-4" style="border-color: rgba(96,165,250,0.3);">
        <p class="text-[11px] text-white/80 flex items-start gap-2">
          <Icon name="info" size={14} color="#93c5fd" />
          <span>
            <strong class="text-blue-300">Tip:</strong>
            To adjust a specific player's wallet, go to
            <button on:click={() => loadTab('players')} class="text-gold underline font-bold"
              >Players</button
            > tab → click a player → Adjust Wallet.
          </span>
        </p>
      </div>

      <h3 class="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
        <Icon name="receipt" size={16} />
        <span>Recent Wallet Activity</span>
      </h3>
      <div class="space-y-1.5">
        {#each walletActions as a}
          <div
            class="rounded-xl px-3 py-2"
            style="background: rgba(16,26,58,0.7); border: 1px solid rgba(37,99,235,0.15);"
          >
            <div class="flex items-center gap-2">
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                style="background: {a.action === 'adjust_wallet'
                  ? 'rgba(212,175,55,0.2)'
                  : 'rgba(239,68,68,0.2)'}; color: {a.action === 'adjust_wallet'
                  ? '#f4e5a8'
                  : '#fca5a5'};">{a.action}</span
              >
              <span class="text-[9px] text-white/40">user #{a.targetId}</span>
              <span class="text-[9px] text-white/30 ml-auto font-mono">{fmtDate(a.createdAt)}</span>
            </div>
            {#if a.payload?.amount}
              <p
                class="text-[11px] mt-1 font-bold"
                style="color: {a.payload.amount > 0 ? '#6ee7b7' : '#fca5a5'};"
              >
                {a.payload.amount > 0 ? '+' : ''}{fmtMoney(a.payload.amount)}
                {#if a.payload.reason}<span class="text-white/50 text-[10px] font-normal">
                    — {a.payload.reason}</span
                  >{/if}
              </p>
            {/if}
          </div>
        {/each}
        {#if walletActions.length === 0}
          <div class="card text-center py-6">
            <p class="text-white/50 text-sm">No wallet activity yet</p>
          </div>
        {/if}
      </div>
    {/if}
    <!-- TAB: BROADCAST -->
    {#if activeTab === 'broadcast'}
      <div class="flex gap-2 mb-3">
        <button
          on:click={() => (showBroadcastForm = !showBroadcastForm)}
          class="flex-1 btn-gold flex items-center justify-center gap-2"
        >
          {#if showBroadcastForm}
            <Icon name="close" size={14} color="#0a0800" />
            <span>Close</span>
          {:else}
            <Icon name="plus" size={14} color="#0a0800" />
            <span>New Broadcast</span>
          {/if}
        </button>
        <button
          on:click={loadBroadcasts}
          aria-label="Refresh broadcasts"
          class="w-12 rounded-xl text-white/70 flex items-center justify-center"
          style="background: rgba(37,99,235,0.15); border: 1px solid rgba(37,99,235,0.3);"
        >
          <Icon name="refresh" size={18} />
        </button>
      </div>

      {#if showBroadcastForm}
        <div class="card space-y-3 mb-4">
          <input
            type="text"
            bind:value={bcastForm.title}
            placeholder="Title"
            class="w-full rounded-lg px-3 py-2.5 text-sm text-white"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
          />
          <textarea
            bind:value={bcastForm.message}
            placeholder="Message…"
            rows="4"
            class="w-full rounded-lg px-3 py-2.5 text-sm text-white outline-none"
            style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25); resize: vertical;"
          ></textarea>
          <div class="grid grid-cols-2 gap-2">
            <select
              bind:value={bcastForm.target}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="banned">Banned Only</option>
              <option value="high_risk">High Risk</option>
            </select>
            <select
              bind:value={bcastForm.severity}
              class="rounded-lg px-2 py-2.5 text-xs text-white"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(37,99,235,0.25);"
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>
          <button
            on:click={createBroadcast}
            disabled={broadcasting}
            class="w-full btn-gold disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {#if broadcasting}
              <span>Sending…</span>
            {:else}
              <Icon name="broadcast" size={14} color="#0a0800" />
              <span>Send Broadcast</span>
            {/if}
          </button>
        </div>
      {/if}

      <h3 class="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
        <Icon name="bell" size={16} />
        <span>Sent Broadcasts</span>
      </h3>
      <div class="space-y-2">
        {#each broadcasts as b}
          {@const sevColor =
            b.severity === 'danger'
              ? '#ef4444'
              : b.severity === 'warning'
                ? '#f59e0b'
                : b.severity === 'success'
                  ? '#10b981'
                  : '#3b82f6'}
          <div
            class="rounded-2xl p-3"
            style="background: rgba(16,26,58,0.7); border: 1px solid {sevColor}40;"
          >
            <div class="flex items-start justify-between mb-1">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-extrabold text-white truncate">{b.title}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span
                    class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style="background: {sevColor}25; color: {sevColor};">{b.severity}</span
                  >
                  <span class="text-[9px] text-white/40">→ {b.target}</span>
                  <span class="text-[9px] text-white/40">· {b.readCount} read</span>
                </div>
              </div>
              <span class="text-[9px] text-white/30 font-mono ml-2 shrink-0"
                >{fmtDate(b.createdAt)}</span
              >
            </div>
            <p class="text-[11px] text-white/70 mt-2">{b.message}</p>
            <button
              on:click={() => deleteBroadcast(b.id)}
              class="mt-2 text-[10px] font-bold text-red-300 flex items-center gap-1"
            >
              <Icon name="trash" size={10} color="#fca5a5" />
              <span>Delete</span>
            </button>
          </div>
        {/each}
        {#if broadcasts.length === 0}
          <div class="card text-center py-6">
            <p class="text-white/50 text-sm">No broadcasts yet</p>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB: SETTINGS -->
    {#if activeTab === 'settings'}
      {#if settingsLoading}
        <p class="text-white/40 text-center py-8">Loading…</p>
      {:else}
        <h3 class="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
          <Icon name="settings" size={16} />
          <span>Panel Settings</span>
        </h3>
        <div class="card !p-0 overflow-hidden mb-3">
          {#each Object.entries(settings) as [key, val]}
            <div
              class="flex items-center justify-between px-4 py-3"
              style="border-bottom: 1px solid rgba(212,175,55,0.08);"
            >
              <div>
                <p class="text-[12px] font-bold text-white capitalize">{key.replace(/_/g, ' ')}</p>
                <p class="text-[9px] text-white/40 font-mono">{key}</p>
              </div>
              <button
                on:click={() => toggleSetting(key)}
                aria-label="Toggle {key}"
                class="w-12 h-7 rounded-full relative transition-all shrink-0"
                style="background: {val.value
                  ? 'linear-gradient(180deg, #f4e5a8, #d4af37)'
                  : 'rgba(255,255,255,0.15)'};"
              >
                <span
                  class="absolute top-1 w-5 h-5 rounded-full bg-white transition-all"
                  style="left: {val.value ? '26px' : '4px'}; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"
                ></span>
              </button>
            </div>
          {/each}
        </div>

        <button
          on:click={saveSettings}
          disabled={settingsSaving}
          class="w-full btn-gold disabled:opacity-40 mb-5 flex items-center justify-center gap-2"
        >
          {#if settingsSaving}
            <span>Saving…</span>
          {:else}
            <Icon name="success" size={14} color="#0a0800" />
            <span>Save Settings</span>
          {/if}
        </button>

        <h3 class="text-sm font-extrabold text-white mb-2 flex items-center gap-2">
          <Icon name="receipt" size={16} />
          <span>Action Log</span>
        </h3>
        <div class="space-y-1.5">
          {#each actionsLog as a}
            <div
              class="rounded-xl px-3 py-2"
              style="background: rgba(16,26,58,0.5); border: 1px solid rgba(37,99,235,0.15);"
            >
              <div class="flex items-center gap-2">
                <span
                  class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                  style="background: rgba(37,99,235,0.2); color: #60a5fa;">{a.action}</span
                >
                {#if a.targetType}<span class="text-[9px] text-white/40"
                    >{a.targetType} #{a.targetId}</span
                  >{/if}
                <span class="text-[9px] text-white/30 ml-auto font-mono"
                  >{fmtDate(a.createdAt)}</span
                >
              </div>
            </div>
          {/each}
          {#if actionsLog.length === 0}
            <div class="card text-center py-4"><p class="text-white/50 text-xs">No actions</p></div>
          {/if}
        </div>
      {/if}
    {/if}
  {/if}

  {#if toast}
    <div
      class="fixed top-20 left-1/2 -translate-x-1/2 z-40 rounded-2xl px-4 py-2 max-w-[90%]"
      style="background: rgba(6,78,59,0.95); border: 1px solid rgba(34,197,94,0.5);"
    >
      <p class="text-xs font-bold text-emerald-100 flex items-center gap-2">
        {#if toastIcon}
          <Icon name={toastIcon} size={14} color="#a7f3d0" />
        {/if}
        <span>{toast}</span>
      </p>
    </div>
  {/if}
</div>

<!-- ============ PLAYER DETAIL MODAL ============ -->
{#if selectedPlayer}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center px-4"
    style="background: rgba(5,8,15,0.92); backdrop-filter: blur(8px);"
    on:click={closePlayer}
    on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && closePlayer()}
    role="button"
    tabindex="-1"
    aria-label="Close player details"
  >
    <div
      class="w-full max-w-md rounded-3xl p-5 max-h-[85vh] overflow-y-auto no-scrollbar"
      style="background: linear-gradient(180deg, #101a3a, #080d24); border: 1.5px solid rgba(37,99,235,0.4); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
      on:click={(e) => e.stopPropagation()}
      on:keydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      {#if playerDetailLoading || !playerDetail}
        <p class="text-white/40 text-center py-8">Loading…</p>
      {:else}
        <div class="flex items-start justify-between mb-4">
          <div class="flex items-center gap-3">
            <div
              class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold"
              style="background: {playerDetail.isBanned
                ? 'rgba(239,68,68,0.25)'
                : 'rgba(59,130,246,0.25)'}; color: {playerDetail.isBanned ? '#fca5a5' : '#93c5fd'};"
            >
              {(playerDetail.displayName || 'A')[0].toUpperCase()}
            </div>
            <div>
              <p class="text-base font-extrabold text-white">
                {playerDetail.displayName || 'Anon'}
              </p>
              <p class="text-[10px] text-white/40 font-mono">
                @{playerDetail.username || 'anon'} · tg:{playerDetail.telegramId}
              </p>
            </div>
          </div>
          <button
            on:click={closePlayer}
            aria-label="Close"
            class="w-8 h-8 rounded-full flex items-center justify-center text-white/50"
            style="background: rgba(255,255,255,0.08);"
          >
            <Icon name="close" size={14} color="rgba(255,255,255,0.5)" />
          </button>
        </div>

        <div class="flex gap-1.5 mb-4 flex-wrap">
          {#if playerDetail.isBanned}<span
              class="text-[9px] font-bold px-2 py-1 rounded-full"
              style="background: rgba(239,68,68,0.2); color: #fca5a5;">BANNED</span
            >{/if}
          {#if playerDetail.riskScore >= 65}<span
              class="text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1"
              style="background: rgba(245,158,11,0.2); color: #fcd34d;"
            >
              <Icon name="warning" size={10} color="#fcd34d" />
              <span>RISK {playerDetail.riskScore}</span>
            </span>{/if}
          <span
            class="text-[9px] font-bold px-2 py-1 rounded-full"
            style="background: rgba(37,99,235,0.15); color: #93c5fd;"
            >{playerDetail.language || 'en'}</span
          >
        </div>

        <div class="grid grid-cols-3 gap-2 mb-4">
          <div class="rounded-xl p-2.5 text-center" style="background: rgba(0,0,0,0.4);">
            <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Balance</p>
            <p class="text-[13px] font-extrabold text-gold tabular-nums">
              {fmtMoney(playerDetail.balanceUsd)}
            </p>
          </div>
          <div class="rounded-xl p-2.5 text-center" style="background: rgba(0,0,0,0.4);">
            <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Chips</p>
            <p class="text-[13px] font-extrabold text-emerald-400 tabular-nums">
              {playerDetail.freeChips}
            </p>
          </div>
          <div class="rounded-xl p-2.5 text-center" style="background: rgba(0,0,0,0.4);">
            <p class="text-[9px] text-white/40 uppercase font-bold mb-1">Hands</p>
            <p class="text-[13px] font-extrabold text-white tabular-nums">
              {playerDetail.totalHands}
            </p>
          </div>
        </div>

        <div class="mb-4">
          {#if playerDetail.isBanned}
            <button
              on:click={() => banPlayer(playerDetail.id, false)}
              class="w-full rounded-xl py-2.5 text-[12px] font-extrabold flex items-center justify-center gap-1.5"
              style="background: linear-gradient(180deg, #22c55e, #15803d); color: white;"
            >
              <Icon name="success" size={14} color="#ffffff" />
              <span>Unban User</span>
            </button>
          {:else}
            <button
              on:click={() => banPlayer(playerDetail.id, true)}
              class="w-full rounded-xl py-2.5 text-[12px] font-extrabold flex items-center justify-center gap-1.5"
              style="background: rgba(220,38,38,0.2); color: #fca5a5; border: 1px solid rgba(220,38,38,0.4);"
            >
              <Icon name="close" size={14} color="#fca5a5" />
              <span>Ban User</span>
            </button>
          {/if}
        </div>

        <div
          class="rounded-xl p-3 mb-4"
          style="background: rgba(212,175,55,0.08); border: 1px solid rgba(212,175,55,0.25);"
        >
          <p
            class="text-[10px] font-extrabold text-gold uppercase tracking-wider mb-2 flex items-center gap-1.5"
          >
            <Icon name="dollar" size={12} color="#d4af37" />
            <span>Adjust Wallet</span>
          </p>
          <div class="flex gap-2 mb-2">
            <input
              type="number"
              step="0.01"
              bind:value={walletAdjustAmount}
              placeholder="+10 or -5"
              class="flex-1 rounded-lg px-3 py-2 text-sm text-white font-mono"
              style="background: rgba(0,0,0,0.5); border: 1px solid rgba(212,175,55,0.3);"
            />
            <button
              on:click={() => adjustWallet(playerDetail.id)}
              disabled={walletAdjusting || !walletAdjustAmount}
              class="rounded-lg px-4 text-[11px] font-extrabold disabled:opacity-40"
              style="background: linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15); color: #0a0800;"
            >
              {walletAdjusting ? '…' : 'Apply'}
            </button>
          </div>
          <input
            type="text"
            bind:value={walletAdjustReason}
            placeholder="Reason (optional)"
            class="w-full rounded-lg px-3 py-2 text-[11px] text-white"
            style="background: rgba(0,0,0,0.5); border: 1px solid rgba(212,175,55,0.2);"
          />
          <div class="flex gap-1.5 mt-2">
            {#each [1, 5, 10, 50, 100, -10] as amt}
              <button
                on:click={() => (walletAdjustAmount = amt)}
                class="flex-1 py-1 rounded text-[10px] font-bold"
                style="background: rgba(212,175,55,0.15); color: #f4e5a8;"
                >{amt > 0 ? '+' : ''}{amt}</button
              >
            {/each}
          </div>
        </div>

        {#if playerHistory?.transactions?.length > 0}
          <p
            class="text-[10px] font-extrabold text-white/50 uppercase tracking-wider mb-2 mt-4 flex items-center gap-1.5"
          >
            <Icon name="receipt" size={12} color="rgba(255,255,255,0.5)" />
            <span>Recent Transactions</span>
          </p>
          <div class="space-y-1 mb-4">
            {#each playerHistory.transactions.slice(0, 10) as t}
              <div
                class="flex justify-between text-[10px] py-1.5"
                style="border-bottom: 1px solid rgba(255,255,255,0.05);"
              >
                <span class="text-white/60 font-mono">{t.kind}</span>
                <span class="font-bold" style="color: {t.amount > 0 ? '#6ee7b7' : '#fca5a5'};"
                  >{t.amount > 0 ? '+' : ''}{fmtMoney(t.amount)}</span
                >
              </div>
            {/each}
          </div>
        {/if}

        {#if playerHistory?.tournaments?.length > 0}
          <p
            class="text-[10px] font-extrabold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5"
          >
            <Icon name="trophy" size={12} color="rgba(255,255,255,0.5)" />
            <span>Recent Tournaments</span>
          </p>
          <div class="space-y-1">
            {#each playerHistory.tournaments.slice(0, 5) as tr}
              <div class="rounded-lg px-2 py-1.5" style="background: rgba(0,0,0,0.3);">
                <div class="flex justify-between">
                  <span class="text-[10px] font-bold text-white truncate">{tr.name}</span>
                  <span
                    class="text-[10px] font-mono"
                    style="color: {tr.finalPosition === 1 ? '#f4c95d' : 'rgba(255,255,255,0.6)'};"
                  >
                    {tr.finalPosition ? `#${tr.finalPosition}` : tr.status}
                  </span>
                </div>
                {#if tr.payout > 0}
                  <p class="text-[9px] text-emerald-400 font-mono mt-0.5">
                    Won {fmtMoney(tr.payout)}
                  </p>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

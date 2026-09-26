<script lang="ts">
  import { api } from '../lib/api';
  import PlayingCard from './PlayingCard.svelte';
  import Icon from './Icon.svelte';

  export let open: boolean = false;
  export let onClose: () => void = () => {};
  export let onReplay: (handId: number) => void = () => {};

  let view: 'list' | 'detail' = 'list';
  let hands: any[] = [];
  let selectedHand: any = null;
  let selectedDetail: any = null;
  let loading = false;
  let error = '';
  let activeTab: 'summary' | 'actions' | 'results' = 'summary';

  let searchQuery = '';
  let filter: 'all' | 'won' | 'lost' | 'real' | 'free' = 'all';

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  function fmtDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  $: myUserId = null;

  async function loadHands() {
    loading = true;
    error = '';
    try {
      const res = await api.getRecentHands(50);
      if (res.ok && res.data) hands = res.data.hands || [];
      else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  async function openHand(h: any) {
    selectedHand = h;
    loading = true;
    error = '';
    try {
      const res = await api.getHandDetail(h.id);
      if (res.ok && res.data) {
        selectedDetail = res.data;
        view = 'detail';
        activeTab = 'summary';
      } else error = res.error || 'failed';
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function goBack() {
    view = 'list';
    selectedHand = null;
    selectedDetail = null;
  }

  $: if (open && hands.length === 0 && !loading) loadHands();

  $: filteredHands = hands.filter((h) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const hay = `${h.handNo} ${h.tableName} ${h.variant}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filter === 'won') return h.isWin === true;
    if (filter === 'lost') return h.isWin === false;
    if (filter === 'real') return h.mode === 'real';
    if (filter === 'free') return h.mode === 'free';
    return true;
  });

  $: actionsByStreet = (() => {
    const result: Record<string, any[]> = {
      preflop: [],
      flop: [],
      turn: [],
      river: [],
    };
    if (!selectedDetail?.events) return result;

    let street = 'preflop';
    for (const evt of selectedDetail.events) {
      const phase = evt.payload?.phase;
      if (phase === 'flop') street = 'flop';
      else if (phase === 'turn') street = 'turn';
      else if (phase === 'river') street = 'river';
      if (evt.type === 'ACTION_TAKEN') result[street].push(evt.payload);
    }
    return result;
  })();
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[85] cursor-default"
    style="background: rgba(5,8,15,0.88); backdrop-filter: blur(6px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] flex flex-col w-[94%] max-w-[440px] rounded-3xl overflow-hidden"
    style="
      height: 84vh;
      max-height: 740px;
      background: linear-gradient(180deg, rgba(15,31,58,0.98), rgba(7,14,27,1));
      border: 1.5px solid rgba(212,175,55,0.35);
      box-shadow: 0 20px 60px rgba(0,0,0,0.95), 0 0 40px rgba(212,175,55,0.12);
    "
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-4 py-3.5 shrink-0"
      style="border-bottom: 1px solid rgba(212,175,55,0.15);"
    >
      {#if view === 'detail'}
        <button
          on:click={goBack}
          aria-label="Back"
          class="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 active:scale-95"
          style="background: rgba(30,58,138,0.4); border: 1px solid rgba(96,165,250,0.3);"
        >
          <Icon name="arrow-left" size={16} />
        </button>
      {:else}
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center"
          style="background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1)); border: 1px solid rgba(212,175,55,0.4);"
        >
          <Icon name="receipt" size={16} color="#d4af37" />
        </div>
      {/if}

      <h2 class="text-sm font-extrabold text-white flex-1 tracking-wide">
        {view === 'list' ? 'Hand History' : `Hand #${selectedHand?.handNo}`}
      </h2>

      {#if view === 'detail' && selectedHand}
        <button
          on:click={() => onReplay(selectedHand.id)}
          class="px-3 py-1.5 rounded-xl text-[10px] font-extrabold active:scale-95 flex items-center gap-1"
          style="
            background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
            color: #0a0800;
            box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);
          "
        >
          <Icon name="play" size={10} color="#0a0800" />
          <span>REPLAY</span>
        </button>
      {/if}

      <button
        on:click={onClose}
        aria-label="Close"
        class="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 active:scale-95"
        style="background: rgba(255,255,255,0.06);"
      >
        <Icon name="close" size={14} color="rgba(255,255,255,0.6)" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar">
      {#if loading}
        <div class="flex items-center justify-center h-full">
          <div
            class="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin"
          ></div>
        </div>
      {:else if error}
        <div class="flex items-center justify-center h-full p-4">
          <p class="text-red-300 text-sm font-bold">{error}</p>
        </div>
      {:else if view === 'list'}
        <!-- Search -->
        <div class="px-3 pt-3">
          <div class="relative">
            <span
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
            >
              <Icon name="search" size={14} color="rgba(255,255,255,0.4)" />
            </span>
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search hand # or table…"
              class="w-full rounded-xl pl-9 pr-3 py-2.5 text-[12px] text-white outline-none"
              style="background: rgba(0,0,0,0.4); border: 1px solid rgba(212,175,55,0.18);"
            />
          </div>
        </div>

        <!-- Filter chips -->
        <div class="flex gap-1.5 px-3 py-3 overflow-x-auto no-scrollbar">
          {#each [{ k: 'all', l: 'All' }, { k: 'won', l: 'Won' }, { k: 'lost', l: 'Lost' }, { k: 'real', l: 'Real' }, { k: 'free', l: 'Free' }] as f}
            <button
              on:click={() => (filter = f.k as any)}
              class="shrink-0 px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
              style="
                background: {filter === f.k
                ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                : 'rgba(15,31,58,0.7)'};
                color: {filter === f.k ? '#0a0800' : 'rgba(255,255,255,0.65)'};
                border: 1px solid {filter === f.k ? 'transparent' : 'rgba(212,175,55,0.2)'};
              "
            >
              {f.l}
            </button>
          {/each}
        </div>

        {#if filteredHands.length === 0}
          <div class="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div class="mb-3 flex justify-center">
              <Icon name="receipt" size={48} color="rgba(212,175,55,0.3)" />
            </div>
            <p class="text-white/40 text-sm font-bold">No hands found</p>
            <p class="text-white/30 text-[11px] mt-1">Play some hands to see your history</p>
          </div>
        {:else}
          <div class="p-3 pt-1 space-y-2">
            {#each filteredHands as h}
              {@const isWin = h.winners && h.winners.length > 0}
              <button
                on:click={() => openHand(h)}
                class="w-full text-left rounded-2xl p-3 active:scale-[0.99] transition relative overflow-hidden"
                style="
                  background: linear-gradient(135deg, rgba(15,31,58,0.7), rgba(7,14,27,0.9));
                  border: 1px solid {isWin ? 'rgba(16,185,129,0.25)' : 'rgba(212,175,55,0.15)'};
                "
              >
                <!-- Left accent -->
                <div
                  class="absolute left-0 top-0 bottom-0 w-1"
                  style="background: linear-gradient(180deg, {isWin ? '#10b981' : '#6b7280'}, {isWin
                    ? '#10b98166'
                    : '#6b728066'});"
                ></div>

                <div class="pl-2 flex items-center gap-3">
                  <!-- Status badge -->
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style="
                      background: {isWin ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)'};
                      border: 1.5px solid {isWin
                      ? 'rgba(16,185,129,0.4)'
                      : 'rgba(107,114,128,0.3)'};
                    "
                  >
                    {#if isWin}
                      <Icon name="check" size={16} color="#6ee7b7" />
                    {:else}
                      <Icon name="close" size={14} color="rgba(255,255,255,0.4)" />
                    {/if}
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                      <span class="text-[11px] font-extrabold text-white">Hand #{h.handNo}</span>
                      <span
                        class="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full tracking-wider"
                        style="
                          background: {h.mode === 'free'
                          ? 'rgba(16,185,129,0.2)'
                          : 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'};
                          color: {h.mode === 'free' ? '#6ee7b7' : '#0a0800'};
                        "
                      >
                        {h.mode === 'free' ? 'FREE' : 'REAL'}
                      </span>
                    </div>
                    <p class="text-[10px] text-white/50">
                      {h.variant?.toUpperCase() || 'HOLDEM'} · {h.playerCount || 0} players
                    </p>
                    <p class="text-[9px] text-white/30 font-mono mt-0.5">{fmtDate(h.startedAt)}</p>
                  </div>

                  <!-- Pot -->
                  <div class="text-right shrink-0">
                    <p class="text-[13px] font-extrabold text-gold tabular-nums">${fmt(h.pot)}</p>
                    {#if h.rake > 0}
                      <p class="text-[9px] text-white/40 tabular-nums">rake ${fmt(h.rake)}</p>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {:else if view === 'detail' && selectedDetail}
        <!-- Tabs -->
        <div
          class="flex shrink-0 sticky top-0 z-10"
          style="background: rgba(15,31,58,0.98); border-bottom: 1px solid rgba(212,175,55,0.15);"
        >
          {#each [['summary', 'SUMMARY'], ['actions', 'ACTIONS'], ['results', 'RESULTS']] as [key, label]}
            <button
              on:click={() => (activeTab = key as any)}
              class="flex-1 py-2.5 text-[10px] font-extrabold uppercase tracking-wider"
              style="
                color: {activeTab === key ? '#f4e5a8' : 'rgba(255,255,255,0.4)'};
                border-bottom: 2px solid {activeTab === key ? '#d4af37' : 'transparent'};
              "
            >
              {label}
            </button>
          {/each}
        </div>

        <div class="p-3">
          {#if activeTab === 'summary'}
            <div class="space-y-3">
              <!-- Info card -->
              <div
                class="rounded-2xl p-3"
                style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.15);"
              >
                <div class="text-[9px] uppercase tracking-widest text-gold/70 mb-2 font-bold">
                  Info
                </div>
                <div class="space-y-1.5 text-[11px] font-mono">
                  <div class="flex justify-between">
                    <span class="text-white/40">Date</span>
                    <span class="text-white/85">{fmtDate(selectedHand.startedAt)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-white/40">Table</span>
                    <span class="text-white/85 truncate ml-2"
                      >{selectedDetail.hand.tableName || selectedHand.tableName}</span
                    >
                  </div>
                  <div class="flex justify-between">
                    <span class="text-white/40">Blinds</span>
                    <span class="text-white/85 tabular-nums"
                      >${fmt(selectedHand.smallBlind)} / ${fmt(selectedHand.bigBlind)}</span
                    >
                  </div>
                  <div class="flex justify-between">
                    <span class="text-white/40">Players</span>
                    <span class="text-white/85">{selectedHand.playerCount}</span>
                  </div>
                </div>
              </div>

              <!-- Pot card -->
              <div
                class="rounded-2xl p-4"
                style="
                  background: linear-gradient(135deg, rgba(244,201,93,0.18), rgba(168,121,34,0.05));
                  border: 1.5px solid rgba(244,201,93,0.4);
                "
              >
                <div class="flex items-baseline justify-between mb-1">
                  <span class="text-[10px] uppercase tracking-widest text-gold/80 font-bold"
                    >Total Pot</span
                  >
                  <span class="text-xl font-extrabold text-gold tabular-nums"
                    >${fmt(selectedHand.pot)}</span
                  >
                </div>
                <div class="flex justify-between text-[10px] text-white/50">
                  <span>Rake</span>
                  <span class="tabular-nums">${fmt(selectedHand.rake)}</span>
                </div>
              </div>

              <!-- Board -->
              {#if selectedDetail.hand.community && selectedDetail.hand.community.length > 0}
                <div
                  class="rounded-2xl p-3"
                  style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.15);"
                >
                  <div class="text-[9px] uppercase tracking-widest text-gold/70 mb-2 font-bold">
                    Board ({selectedDetail.hand.community.length}/5)
                  </div>
                  <div class="flex gap-1.5 justify-center py-1">
                    {#each Array(5) as _, i}
                      {#if selectedDetail.hand.community[i]}
                        <PlayingCard
                          rank={selectedDetail.hand.community[i].r}
                          suit={suitChar(selectedDetail.hand.community[i].s)}
                          size="md"
                        />
                      {:else}
                        <div
                          class="w-[50px] h-[70px] rounded-md"
                          style="background: rgba(0,0,0,0.3);
                                    border: 1px dashed rgba(255,255,255,0.1);"
                        ></div>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Players -->
              <div
                class="rounded-2xl p-3"
                style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.15);"
              >
                <div class="text-[9px] uppercase tracking-widest text-gold/70 mb-2 font-bold">
                  Players ({selectedDetail.hand.players?.length || 0})
                </div>
                {#if !selectedDetail.hand.players || selectedDetail.hand.players.length === 0}
                  <p class="text-[11px] text-white/40">No player data</p>
                {:else}
                  <div class="space-y-1">
                    {#each selectedDetail.hand.players as p}
                      {@const won = selectedHand.winners.includes(p.seat)}
                      {@const sp = selectedDetail.hand.showdownPlayers?.find(
                        (x: any) => x.seat === p.seat,
                      )}
                      {@const hole = sp?.hole ?? []}
                      {@const best = sp?.best ?? []}
                      <div
                        class="px-2.5 py-2 rounded-xl"
                        style="
                             background: {won
                          ? 'linear-gradient(90deg, rgba(212,175,55,0.15), rgba(212,175,55,0.03))'
                          : 'rgba(0,0,0,0.25)'};
                             border: 1px solid {won
                          ? 'rgba(212,175,55,0.4)'
                          : 'rgba(255,255,255,0.04)'};
                             {won ? 'box-shadow: 0 0 10px rgba(212,175,55,0.15);' : ''}
                           "
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex items-center gap-2">
                            {#if won}
                              <Icon name="trophy" size={11} color="#f4c95d" />
                            {:else}
                              <span class="w-3"></span>
                            {/if}
                            <span
                              class="text-[11px] font-bold"
                              style="color: {won ? '#f4e5a8' : 'rgba(255,255,255,0.75)'};"
                            >
                              {p.displayName}
                            </span>
                            <span class="text-[9px] text-white/30 font-mono">S{p.seat}</span>
                          </div>
                          <span
                            class="text-[11px] font-mono tabular-nums"
                            style="color: {won ? '#d4af37' : 'rgba(255,255,255,0.6)'};"
                          >
                            ${fmt(p.stack)}
                          </span>
                        </div>
                        {#if hole.length > 0}
                          <div class="flex gap-1 mt-1.5">
                            {#each hole as c}
                              {@const isBest = best.some((b: any) => b.r === c.r && b.s === c.s)}
                              <div class="relative">
                                <PlayingCard
                                  rank={c.r}
                                  suit={suitChar(c.s)}
                                  size="xs"
                                  dim={!isBest && won}
                                />
                                {#if isBest}
                                  <div
                                    class="absolute -inset-0.5 rounded-md winning-card-glow pointer-events-none"
                                  ></div>
                                {/if}
                              </div>
                            {/each}
                            {#if sp?.handName}
                              <span
                                class="text-[9px] font-bold self-center ml-1"
                                style="color: {won ? '#f4c95d' : 'rgba(255,255,255,0.5)'};"
                              >
                                {sp.handName}
                              </span>
                            {/if}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {:else if activeTab === 'actions'}
            <div class="space-y-2">
              {#each [['preflop', 'Preflop'], ['flop', 'Flop'], ['turn', 'Turn'], ['river', 'River']] as [key, label]}
                {#if actionsByStreet[key]?.length > 0}
                  <div
                    class="rounded-2xl p-3"
                    style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.15);"
                  >
                    <div
                      class="text-[10px] uppercase tracking-widest text-gold/80 mb-2 font-bold flex items-center gap-2"
                    >
                      <span>{label}</span>
                      <span class="text-white/30 font-normal">· {actionsByStreet[key].length}</span>
                    </div>
                    <div class="space-y-1">
                      {#each actionsByStreet[key] as a}
                        <div class="flex items-center justify-between text-[11px] py-1">
                          <span class="text-white/70 font-semibold truncate">
                            {a.displayName || `Seat ${a.seat}`}
                          </span>
                          <div class="flex items-center gap-2 shrink-0">
                            <span
                              class="font-extrabold uppercase text-[10px] px-2 py-0.5 rounded-md"
                              style="
                                background: {a.action === 'FOLD'
                                ? 'rgba(239,68,68,0.15)'
                                : a.action === 'CALL'
                                  ? 'rgba(16,185,129,0.15)'
                                  : a.action === 'RAISE' || a.action === 'BET'
                                    ? 'rgba(59,130,246,0.15)'
                                    : 'rgba(139,92,246,0.15)'};
                                color: {a.action === 'FOLD'
                                ? '#fca5a5'
                                : a.action === 'CALL'
                                  ? '#6ee7b7'
                                  : a.action === 'RAISE' || a.action === 'BET'
                                    ? '#93c5fd'
                                    : '#c4b5fd'};
                              "
                            >
                              {a.action}
                            </span>
                            {#if a.amount > 0}
                              <span class="font-mono text-gold tabular-nums">${fmt(a.amount)}</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/each}
              {#if !actionsByStreet.preflop.length && !actionsByStreet.flop.length && !actionsByStreet.turn.length && !actionsByStreet.river.length}
                <div class="text-center py-8 text-white/40 text-sm">No actions recorded</div>
              {/if}
            </div>
          {:else if activeTab === 'results'}
            <div class="space-y-3">
              {#if selectedDetail.hand.players && selectedDetail.hand.players.length > 0}
                {#each selectedDetail.hand.players.filter( (p: any) => selectedHand.winners.includes(p.seat) ) as w}
                  <div
                    class="rounded-2xl p-4"
                    style="
                      background: linear-gradient(135deg, rgba(244,201,93,0.18), rgba(168,121,34,0.05));
                      border: 1.5px solid rgba(244,201,93,0.5);
                    "
                  >
                    <div class="flex items-center gap-2 mb-1.5">
                      <Icon name="trophy" size={16} color="#f4c95d" />
                      <span class="text-[13px] font-extrabold text-gold">{w.displayName}</span>
                    </div>
                    <p class="text-[10px] text-white/60">
                      Winner · Seat {w.seat} · ${fmt(w.stack)}
                    </p>
                  </div>
                {/each}
              {:else}
                <div
                  class="rounded-2xl p-3 text-center"
                  style="background: linear-gradient(135deg, rgba(244,201,93,0.15), rgba(168,121,34,0.05)); border: 1px solid rgba(244,201,93,0.4);"
                >
                  <p class="text-[11px] text-white/70">
                    Winners: Seats {selectedHand.winners.join(', ')}
                  </p>
                </div>
              {/if}

              <div
                class="rounded-2xl p-3"
                style="background: rgba(15,31,58,0.7); border: 1px solid rgba(212,175,55,0.15);"
              >
                <div class="text-[9px] uppercase tracking-widest text-gold/70 mb-2 font-bold">
                  Final
                </div>
                <div class="space-y-1.5 text-[11px] font-mono">
                  <div class="flex justify-between">
                    <span class="text-white/40">Pot</span>
                    <span class="text-white/85 tabular-nums">${fmt(selectedHand.pot)}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-white/40">Rake</span>
                    <span class="text-white/85 tabular-nums">${fmt(selectedHand.rake)}</span>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  @keyframes winning-card-glow-kf {
    0%,
    100% {
      box-shadow:
        0 0 6px rgba(244, 201, 93, 0.6),
        0 0 0 1.5px rgba(244, 201, 93, 0.8);
    }
    50% {
      box-shadow:
        0 0 16px rgba(244, 201, 93, 1),
        0 0 0 2px rgba(244, 201, 93, 1);
    }
  }
  .winning-card-glow {
    animation: winning-card-glow-kf 1.4s ease-in-out infinite;
    border-radius: 6px;
  }
</style>

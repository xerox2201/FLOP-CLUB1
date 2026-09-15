 <script lang="ts">
  import { api } from '../lib/api';
  import PlayingCard from './PlayingCard.svelte';

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
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return iso; }
  }

  async function loadHands() {
    loading = true;
    error = '';
    try {
      const res = await api.getRecentHands(30);
      if (res.ok && res.data) {
        hands = res.data.hands || [];
      } else {
        error = res.error || 'failed';
      }
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
      } else {
        error = res.error || 'failed';
      }
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

  $: if (open && hands.length === 0 && !loading) {
    loadHands();
  }

  $: actionsByStreet = (() => {
    const result: Record<string, any[]> = {
      preflop: [], flop: [], turn: [], river: []
    };
    if (!selectedDetail?.events) return result;

    let street = 'preflop';
    for (const evt of selectedDetail.events) {
      const phase = evt.payload?.phase;
      if (phase === 'flop') street = 'flop';
      else if (phase === 'turn') street = 'turn';
      else if (phase === 'river') street = 'river';

      if (evt.type === 'ACTION_TAKEN') {
        result[street].push(evt.payload);
      }
    }
    return result;
  })();
</script>

{#if open}
  <button
    aria-label="Close"
    class="fixed inset-0 z-[85] cursor-default"
    style="background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] flex flex-col w-[94%] max-w-[420px] rounded-2xl overflow-hidden"
    style="height: 80vh; max-height: 720px; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-3 border-b border-white/10 shrink-0">
      {#if view === 'detail'}
        <button
          on:click={goBack}
          class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 active:scale-95"
          style="background: rgba(255,255,255,0.06);"
        >←</button>
      {/if}
      <h2 class="text-sm font-extrabold text-white flex-1">
        {view === 'list' ? '📜 Hand History' : `Hand #${selectedHand?.handNo}`}
      </h2>

      {#if view === 'detail' && selectedHand}
        <button
          on:click={() => onReplay(selectedHand.id)}
          class="px-2.5 py-1.5 rounded-full text-[10px] font-extrabold text-black active:scale-95 flex items-center gap-1"
          style="background: #fbbf24;"
        >
          ▶ Replay
        </button>
      {/if}

      <button
        on:click={onClose}
        class="w-8 h-8 rounded-full flex items-center justify-center text-white/60 text-xl leading-none active:scale-95"
        style="background: rgba(255,255,255,0.06);"
      >×</button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      {#if loading}
        <div class="flex items-center justify-center h-full">
          <div class="text-white/50 text-sm">Loading…</div>
        </div>
      {:else if error}
        <div class="flex items-center justify-center h-full p-4">
          <div class="text-red-300 text-sm">{error}</div>
        </div>
      {:else if view === 'list'}
        {#if hands.length === 0}
          <div class="flex items-center justify-center h-full p-4">
            <div class="text-white/40 text-sm">No hands yet</div>
          </div>
        {:else}
          <div class="p-2 space-y-1.5">
            {#each hands as h}
              <button
                on:click={() => openHand(h)}
                class="w-full text-left rounded-xl p-3 active:scale-[0.99] transition"
                style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);"
              >
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] font-mono text-white/50">Hand #{h.handNo}</span>
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full {h.mode === 'free' ? 'text-emerald-300' : 'text-amber-300'}"
                    style="background: {h.mode === 'free' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};"
                  >
                    {h.mode === 'free' ? 'PLAY' : 'REAL'}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="text-[11px] text-white/70">
                      {h.variant.toUpperCase()} · {h.playerCount} players
                    </div>
                    <div class="text-[10px] text-white/40 mt-0.5">
                      {fmtDate(h.startedAt)}
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <div class="text-[12px] font-extrabold text-amber-400 tabular-nums">${fmt(h.pot)}</div>
                    {#if h.rake > 0}
                      <div class="text-[9px] text-white/40 tabular-nums">rake ${fmt(h.rake)}</div>
                    {/if}
                  </div>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {:else if view === 'detail' && selectedDetail}
        <!-- Tabs -->
        <div class="flex border-b border-white/10 shrink-0 sticky top-0 z-10" style="background: #0f172a;">
          {#each [['summary', 'SUMMARY'], ['actions', 'ACTIONS'], ['results', 'RESULTS']] as [key, label]}
            <button
              on:click={() => activeTab = key}
              class="flex-1 py-2.5 text-[11px] font-extrabold uppercase tracking-wider"
              style="color: {activeTab === key ? '#fbbf24' : 'rgba(255,255,255,0.4)'}; border-bottom: 2px solid {activeTab === key ? '#fbbf24' : 'transparent'};"
            >{label}</button>
          {/each}
        </div>

        <div class="p-3">
          {#if activeTab === 'summary'}
            <div class="space-y-3">
              <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div class="text-[10px] uppercase tracking-widest text-white/40 mb-2">Info</div>
                <div class="space-y-1 text-[11px] font-mono">
                  <div class="flex justify-between"><span class="text-white/50">Date</span><span class="text-white/80">{fmtDate(selectedHand.startedAt)}</span></div>
                  <div class="flex justify-between"><span class="text-white/50">Table</span><span class="text-white/80">{selectedDetail.hand.tableName || selectedHand.tableName}</span></div>
                  <div class="flex justify-between"><span class="text-white/50">Blinds</span><span class="text-white/80">${fmt(selectedHand.smallBlind)} / ${fmt(selectedHand.bigBlind)}</span></div>
                  <div class="flex justify-between"><span class="text-white/50">Players</span><span class="text-white/80">{selectedHand.playerCount}</span></div>
                </div>
              </div>

              <div class="rounded-xl p-3" style="background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.2);">
                <div class="flex justify-between mb-1">
                  <span class="text-[11px] text-white/60">Total Pot</span>
                  <span class="text-[14px] font-extrabold text-amber-400 tabular-nums">${fmt(selectedHand.pot)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-[10px] text-white/40">Rake</span>
                  <span class="text-[10px] text-white/60 tabular-nums">${fmt(selectedHand.rake)}</span>
                </div>
              </div>

              {#if selectedDetail.hand.community && selectedDetail.hand.community.length > 0}
                <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                  <div class="text-[10px] uppercase tracking-widest text-white/40 mb-2">Board</div>
                  <div class="flex gap-1">
                    {#each selectedDetail.hand.community as c}
                      <PlayingCard rank={c.r} suit={suitChar(c.s)} size="sm" />
                    {/each}
                  </div>
                </div>
              {/if}

              <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div class="text-[10px] uppercase tracking-widest text-white/40 mb-2">Players</div>
                {#if !selectedDetail.hand.players || selectedDetail.hand.players.length === 0}
                  <div class="text-[11px] text-white/40">No player data</div>
                {:else}
                  <div class="space-y-1">
                    {#each selectedDetail.hand.players as p}
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          {#if selectedHand.winners.includes(p.seat)}
                            <span class="text-xs">👑</span>
                          {:else}
                            <span class="w-3"></span>
                          {/if}
                          <span class="text-[11px] text-white/80">{p.displayName}</span>
                          <span class="text-[9px] text-white/40 font-mono">seat {p.seat}</span>
                        </div>
                        <span class="text-[11px] font-mono text-amber-400 tabular-nums">${fmt(p.stack)}</span>
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
                  <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                    <div class="text-[10px] uppercase tracking-widest text-amber-400/80 mb-2">{label}</div>
                    <div class="space-y-1">
                      {#each actionsByStreet[key] as a}
                        <div class="flex items-center justify-between text-[11px]">
                          <span class="text-white/60 font-mono">
                            {a.displayName || `Seat ${a.seat}`}
                          </span>
                          <div class="flex items-center gap-2">
                            <span class="font-bold text-white/90 uppercase">{a.action}</span>
                            {#if a.amount > 0}
                              <span class="font-mono text-amber-400 tabular-nums">${fmt(a.amount)}</span>
                            {/if}
                          </div>
                        </div>
                      {/each}
                    </div>
                  </div>
                {/if}
              {/each}
            </div>

          {:else if activeTab === 'results'}
            <div class="space-y-2">
              {#if selectedDetail.hand.players && selectedDetail.hand.players.length > 0}
                {#each selectedDetail.hand.players.filter((p: any) => selectedHand.winners.includes(p.seat)) as w}
                  <div class="rounded-xl p-3" style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.4);">
                    <div class="flex items-center gap-2 mb-1">
                      <span>👑</span>
                      <span class="text-[12px] font-bold text-amber-300">{w.displayName}</span>
                    </div>
                    <div class="text-[10px] text-white/60">Winner · Seat {w.seat} · ${fmt(w.stack)}</div>
                  </div>
                {/each}
              {:else}
                <div class="rounded-xl p-3" style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.4);">
                  <div class="text-[11px] text-white/60">Winners: {selectedHand.winners.join(', ')}</div>
                </div>
              {/if}
              <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
                <div class="text-[10px] uppercase tracking-widest text-white/40 mb-2">Final</div>
                <div class="space-y-1 text-[11px] font-mono">
                  <div class="flex justify-between"><span class="text-white/50">Pot</span><span class="text-white/80">${fmt(selectedHand.pot)}</span></div>
                  <div class="flex justify-between"><span class="text-white/50">Rake</span><span class="text-white/80">${fmt(selectedHand.rake)}</span></div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
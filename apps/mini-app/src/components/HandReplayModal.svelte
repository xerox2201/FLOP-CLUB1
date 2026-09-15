 <script lang="ts">
  import { onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import PlayingCard from './PlayingCard.svelte';
  import Avatar from './Avatar.svelte';

  export let open: boolean = false;
  export let handId: number | null = null;
  export let onClose: () => void = () => {};

  let loading = false;
  let error = '';
  let replay: any = null;
  let states: any[] = [];
  let step = 0;
  let playing = false;
  let speed = 1;
  let playInterval: any = null;

  function fmt(n: any): string {
    return Number(Number(n || 0).toFixed(2)).toFixed(2);
  }

  function suitChar(s: string): '♠' | '♥' | '♦' | '♣' {
    if (s === 's') return '♠';
    if (s === 'h') return '♥';
    if (s === 'd') return '♦';
    return '♣';
  }

  // 🔴 Layout بهتر برای تعداد بازیکن مختلف
  const ANGLE_MAP: Record<number, number[]> = {
    2: [270, 90],
    3: [270, 30, 150],
    4: [270, 0, 90, 180],
    5: [270, 340, 60, 120, 200],
    6: [270, 330, 30, 90, 150, 210],
  };

  function seatPos(idx: number, total: number): { x: number; y: number } {
    const angles = ANGLE_MAP[total] || ANGLE_MAP[6];
    const deg = angles[idx] ?? 270;
    const rad = (deg * Math.PI) / 180;
    // 🔴 ry کاهش پیدا کرد تا بازیکن‌ها از لبه دورتر بشن
    const rx = 38;
    const ry = 30;
    return {
      x: 50 + Math.cos(rad) * rx,
      y: 50 + Math.sin(rad) * ry,
    };
  }

  async function load() {
    if (!handId) return;
    loading = true;
    error = '';
    try {
      const res = await api.getHandReplay(handId);
      if (res.ok && res.data) {
        replay = res.data;
        states = buildStates(res.data);
        step = 0;
      } else {
        error = res.error || 'failed';
      }
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function buildStates(data: any): any[] {
    const { hand, initialSnapshot, events } = data;
    const initialPlayers = (initialSnapshot?.players || []).map((p: any) => ({
      seat: p.seat,
      userId: p.userId,
      displayName: p.displayName,
      stack: Number(p.stack || 0),
      betThisStreet: 0,
      folded: false,
      allIn: false,
    }));

    const blinds = initialSnapshot?.blinds || { sb: 0, bb: 0, ante: 0 };
    const initialPot = (blinds.sb || 0) + (blinds.bb || 0) + (blinds.ante || 0) * initialPlayers.length;

    const result: any[] = [];
    const currentState = {
      phase: 'preflop',
      pot: initialPot,
      community: [] as any[],
      players: JSON.parse(JSON.stringify(initialPlayers)),
      lastAction: null,
    };
    result.push(JSON.parse(JSON.stringify(currentState)));

    let prevPhase = 'preflop';
    const allCommunity = hand?.community_cards || [];

    for (const evt of events) {
      const payload = evt.payload || {};
      const phase = payload.phase;

      if (phase && phase !== prevPhase) {
        for (const p of currentState.players) p.betThisStreet = 0;
        prevPhase = phase;
        currentState.phase = phase;
      }

      if (payload.pot !== undefined) currentState.pot = Number(payload.pot);

      const seat = Number(payload.seat);
      const player = currentState.players.find((p: any) => p.seat === seat);
      if (player) {
        const action = String(payload.action || '').toUpperCase();
        const amount = Number(payload.amount || 0);

        if (action === 'FOLD') {
          player.folded = true;
        } else if (action === 'CALL') {
          const cost = Math.min(amount || player.betThisStreet, player.stack);
          player.stack = Math.max(0, player.stack - cost);
          player.betThisStreet += cost;
          if (player.stack === 0) player.allIn = true;
        } else if (action === 'RAISE' || action === 'BET') {
          const prev = player.betThisStreet;
          const increment = Math.max(0, amount - prev);
          player.stack = Math.max(0, player.stack - increment);
          player.betThisStreet = amount;
          if (player.stack === 0) player.allIn = true;
        }
      }

      if (currentState.phase === 'flop') {
        currentState.community = allCommunity.slice(0, 3);
      } else if (currentState.phase === 'turn') {
        currentState.community = allCommunity.slice(0, 4);
      } else if (currentState.phase === 'river' || currentState.phase === 'showdown') {
        currentState.community = allCommunity.slice(0, 5);
      }

      currentState.lastAction = {
        seat,
        action: payload.action,
        amount: payload.amount || 0,
        displayName: player?.displayName || `Seat ${seat}`,
      };

      result.push(JSON.parse(JSON.stringify(currentState)));
    }

    const winners = hand?.winner_seats || [];
    const lastState = result[result.length - 1];
    for (const p of lastState.players) {
      if (winners.includes(p.seat)) (p as any).isWinner = true;
    }

    return result;
  }

  function togglePlay() {
    if (playing) {
      stopPlay();
      playing = false;
    } else {
      if (step >= states.length - 1) step = 0;
      playing = true;
      startPlay();
    }
  }

  function startPlay() {
    stopPlay();
    const interval = 1500 / speed;
    playInterval = setInterval(() => {
      if (step < states.length - 1) {
        step++;
      } else {
        stopPlay();
        playing = false;
      }
    }, interval);
  }

  function stopPlay() {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  }

  function skip(delta: number) {
    step = Math.max(0, Math.min(states.length - 1, step + delta));
  }

  function setSpeed(s: number) {
    speed = s;
    if (playing) startPlay();
  }

  function goToStreet(street: string) {
    const idx = states.findIndex((s: any) => s.phase === street);
    if (idx >= 0) step = idx;
  }

  $: if (open && handId && !loading && (!replay || replay.hand?.id !== handId)) {
    load();
  }

  $: if (!open) {
    stopPlay();
    playing = false;
  }

  $: currentState = states[step] || null;
  $: currentStreet = currentState?.phase || 'preflop';
  $: progressPct = states.length > 1 ? (step / (states.length - 1)) * 100 : 0;

  onDestroy(() => stopPlay());
</script>

{#if open}
  <button aria-label="Close" class="fixed inset-0 z-[85] cursor-default" style="background: rgba(0,0,0,0.85); backdrop-filter: blur(4px);" on:click={onClose}></button>

  <div
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] flex flex-col w-[96%] max-w-[440px] rounded-2xl overflow-hidden"
    style="height: 88vh; max-height: 780px; background: #0f172a; border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 20px 60px rgba(0,0,0,0.9);"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
      <button on:click={onClose} class="w-8 h-8 rounded-full flex items-center justify-center text-white/70 active:scale-95" style="background: rgba(255,255,255,0.06);">←</button>
      <h2 class="text-sm font-extrabold text-white flex-1">🎬 Hand Replay</h2>
      {#if replay?.hand}
        <span class="text-[10px] font-mono text-white/50">Hand #{replay.hand.hand_no}</span>
      {/if}
    </div>

    {#if loading}
      <div class="flex-1 flex items-center justify-center">
        <div class="text-white/50 text-sm">Loading…</div>
      </div>
    {:else if error}
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="text-red-300 text-sm">{error}</div>
      </div>
    {:else if currentState && replay?.hand}
      <!-- Table -->
      <div class="flex-1 relative" style="min-height: 0;">
        <div class="absolute inset-0 flex items-center justify-center p-3">
          <div class="relative w-full" style="aspect-ratio: 1 / 1; max-width: 380px;">

            <!-- Outer rim -->
            <div class="absolute -inset-2 rounded-[50%]" style="background: #050a0a; box-shadow: 0 8px 30px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.9);"></div>

            <!-- Felt -->
            <div class="absolute inset-0 rounded-[50%] overflow-hidden" style="background: radial-gradient(ellipse at 50% 45%, #1a5c3a 0%, #0d3d24 55%, #072a1a 100%);">
              <div class="absolute inset-0 rounded-[50%]" style="box-shadow: inset 0 0 60px rgba(0,0,0,0.7);"></div>
            </div>

            <!-- 🔴 Community cards - وسط میز -->
            <div class="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 z-[5]">
              {#each Array(5) as _, i}
                {#if currentState.community[i]}
                  <div class="scale-[0.7] origin-center">
                    <PlayingCard rank={currentState.community[i].r} suit={suitChar(currentState.community[i].s)} size="sm" />
                  </div>
                {:else}
                  <div class="w-7 h-11 rounded-md bg-black/30 border border-white/5"></div>
                {/if}
              {/each}
            </div>

            <!-- 🔴 Pot - زیر community cards -->
            {#if currentState.pot > 0}
              <div class="absolute top-[62%] left-1/2 -translate-x-1/2 z-[10]">
                <div class="rounded-full px-3 py-0.5 flex items-center gap-1.5" style="background: rgba(0,0,0,0.92); border: 1.5px solid #d97706; box-shadow: 0 2px 10px rgba(0,0,0,0.9);">
                  <span class="text-[8px] uppercase tracking-widest font-extrabold text-white/70">POT</span>
                  <span class="text-[11px] font-extrabold text-amber-400 tabular-nums">${fmt(currentState.pot)}</span>
                </div>
              </div>
            {/if}

            <!-- Players -->
            {#each currentState.players as p, i}
              {@const pos = seatPos(i, currentState.players.length)}
              {@const isActor = currentState.lastAction?.seat === p.seat && step > 0}
              <div class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[20] pointer-events-none" style="left: {pos.x}%; top: {pos.y}%;">
                <div class="relative">
                  <div
                    class="rounded-full p-[2px] bg-black {p.folded ? 'opacity-30' : ''}"
                    style="border: 2.5px solid {p.isWinner ? '#fbbf24' : (isActor ? '#f97316' : '#e5e7eb')}; box-shadow: 0 3px 10px rgba(0,0,0,0.9){p.isWinner ? ', 0 0 18px rgba(251,191,36,0.9)' : ''}{isActor ? ', 0 0 14px rgba(249,115,22,0.8)' : ''};"
                  >
                    <div class="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-amber-700 to-amber-900 flex items-center justify-center">
                      <Avatar avatarId="spade" size="sm" />
                      {#if p.isWinner}
                        <div class="absolute inset-0 rounded-full flex items-center justify-center" style="background: linear-gradient(135deg, #fbbf24, #b45309);">
                          <span class="text-[8px] font-black text-black">WIN</span>
                        </div>
                      {/if}
                    </div>
                  </div>
                  {#if p.folded}
                    <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/75">
                      <span class="text-[7px] font-extrabold text-white">FOLD</span>
                    </div>
                  {/if}
                </div>
                <div class="mt-1 px-1.5 py-0.5 bg-white flex flex-col items-center" style="border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.8); min-width: 56px;">
                  <p class="text-[9px] font-extrabold text-black leading-none whitespace-nowrap max-w-[72px] overflow-hidden text-ellipsis">{p.displayName}</p>
                  <p class="text-[9px] font-extrabold text-amber-600 leading-tight tabular-nums">${fmt(p.stack)}</p>
                </div>
                {#if p.betThisStreet > 0 && !p.folded}
                  <div class="mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-amber-400 tabular-nums" style="background: rgba(0,0,0,0.9); border: 1px solid rgba(245,158,11,0.5);">
                    bet ${fmt(p.betThisStreet)}
                  </div>
                {/if}
                {#if p.allIn}
                  <span class="mt-0.5 text-[7px] font-extrabold bg-red-600 rounded-full px-1.5 py-0.5 text-white">ALL-IN</span>
                {/if}
              </div>
            {/each}

            <!-- Last action bubble -->
            {#if currentState.lastAction && step > 0}
              {@const actor = currentState.players.find((x: any) => x.seat === currentState.lastAction.seat)}
              {#if actor}
                {@const pos = seatPos(currentState.players.indexOf(actor), currentState.players.length)}
                <div class="absolute -translate-x-1/2 -translate-y-1/2 z-[25] pointer-events-none" style="left: {pos.x}%; top: {pos.y - 14}%;">
                  <div class="rounded-full px-2.5 py-1 text-[10px] font-extrabold whitespace-nowrap shadow-lg" style="background: rgba(249,115,22,0.98); color: white; border: 1.5px solid white;">
                    {currentState.lastAction.action}
                    {#if currentState.lastAction.amount > 0}
                      <span class="tabular-nums">${fmt(currentState.lastAction.amount)}</span>
                    {/if}
                  </div>
                </div>
              {/if}
            {/if}
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="px-3 py-2 border-t border-white/10 shrink-0">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] font-mono text-white/40 tabular-nums shrink-0">{step + 1}/{states.length}</span>
          <input
            type="range"
            min="0"
            max={states.length - 1}
            bind:value={step}
            class="flex-1 replay-slider"
            style="--progress: {progressPct}%"
            on:input={() => { if (playing) { stopPlay(); playing = false; } }}
          />
          <span class="text-[10px] font-mono text-amber-400 tabular-nums shrink-0 uppercase">{currentStreet}</span>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-center gap-2 mb-2">
          <button on:click={() => setSpeed(1)} class="w-8 h-8 rounded-full text-[10px] font-extrabold {speed === 1 ? 'bg-amber-500 text-black' : 'text-white/60'}" style="background: {speed === 1 ? '' : 'rgba(255,255,255,0.06)'};">1×</button>
          <button on:click={() => setSpeed(2)} class="w-8 h-8 rounded-full text-[10px] font-extrabold {speed === 2 ? 'bg-amber-500 text-black' : 'text-white/60'}" style="background: {speed === 2 ? '' : 'rgba(255,255,255,0.06)'};">2×</button>
          <button on:click={() => setSpeed(4)} class="w-8 h-8 rounded-full text-[10px] font-extrabold {speed === 4 ? 'bg-amber-500 text-black' : 'text-white/60'}" style="background: {speed === 4 ? '' : 'rgba(255,255,255,0.06)'};">4×</button>

          <div class="w-px h-5 bg-white/10 mx-1"></div>

          <button on:click={() => skip(-5)} class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 active:scale-95" style="background: rgba(255,255,255,0.06);">⏮</button>
          <button on:click={togglePlay} class="w-11 h-11 rounded-full flex items-center justify-center text-black font-bold active:scale-95" style="background: #fbbf24;">{playing ? '⏸' : '▶'}</button>
          <button on:click={() => skip(5)} class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 active:scale-95" style="background: rgba(255,255,255,0.06);">⏭</button>
        </div>

        <!-- Street tabs -->
        <div class="flex gap-1.5">
          {#each [['preflop', 'Preflop'], ['flop', 'Flop'], ['turn', 'Turn'], ['river', 'River']] as [key, label]}
            <button
              on:click={() => goToStreet(key)}
              class="flex-1 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider transition"
              style="background: {currentStreet === key ? '#fbbf24' : 'rgba(255,255,255,0.06)'}; color: {currentStreet === key ? 'black' : 'rgba(255,255,255,0.6)'};"
            >{label}</button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .replay-slider {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    border-radius: 9999px;
    background: linear-gradient(to right, #fbbf24 0%, #fbbf24 var(--progress, 0%), rgba(255,255,255,0.1) var(--progress, 0%), rgba(255,255,255,0.1) 100%);
    outline: none;
    cursor: pointer;
  }
  .replay-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #fff;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.8), 0 0 0 2px rgba(251,191,36,0.4);
  }
  .replay-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #fff;
    cursor: pointer;
  }
</style>
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { api } from '../lib/api';
  import PlayingCard from './PlayingCard.svelte';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';

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

  const ANGLE_MAP: Record<number, number[]> = {
    2: [90, 270],
    3: [90, 210, 330],
    4: [90, 180, 270, 0],
    5: [90, 162, 234, 306, 18],
    6: [90, 150, 210, 270, 330, 30],
    7: [90, 141, 193, 244, 296, 347, 38],
    8: [90, 135, 180, 225, 270, 315, 0, 45],
    9: [90, 130, 170, 210, 250, 290, 330, 10, 50],
  };

  function seatPos(idx: number, total: number): { x: number; y: number } {
    const angles = ANGLE_MAP[total] || ANGLE_MAP[6];
    const deg = angles[idx] ?? 90;
    const rad = (deg * Math.PI) / 180;
    const rx = total === 2 ? 36 : 42;
    const ry = total === 2 ? 32 : 34;
    return { x: 50 + Math.cos(rad) * rx, y: 50 + Math.sin(rad) * ry };
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
    const initialPot =
      (blinds.sb || 0) + (blinds.bb || 0) + (blinds.ante || 0) * initialPlayers.length;

    const result: any[] = [];
    const currentState: any = {
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
  <button
    aria-label="Close"
    class="fixed inset-0 z-[85] cursor-default"
    style="background: rgba(5,8,15,0.88); backdrop-filter: blur(6px);"
    on:click={onClose}
  ></button>

  <div
    class="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[90] flex flex-col w-[96%] max-w-[440px] rounded-3xl overflow-hidden"
    style="
      height: 90vh;
      max-height: 780px;
      background: linear-gradient(180deg, rgba(15,31,58,0.98), rgba(7,14,27,1));
      border: 1.5px solid rgba(212,175,55,0.35);
      box-shadow: 0 20px 60px rgba(0,0,0,0.95), 0 0 40px rgba(212,175,55,0.12);
    "
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-3 py-2.5 shrink-0"
      style="border-bottom: 1px solid rgba(212,175,55,0.15);"
    >
      <button
        on:click={onClose}
        aria-label="Back"
        class="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 active:scale-95"
        style="background: rgba(30,58,138,0.4); border: 1px solid rgba(96,165,250,0.3);"
      >
        <Icon name="arrow-left" size={16} color="rgba(255,255,255,0.7)" />
      </button>

      <div class="flex-1 flex items-center gap-2">
        <div
          class="w-7 h-7 rounded-lg flex items-center justify-center"
          style="background: linear-gradient(180deg, rgba(212,175,55,0.2), rgba(168,122,21,0.1)); border: 1px solid rgba(212,175,55,0.4);"
        >
          <Icon name="play" size={12} color="#d4af37" />
        </div>
        <h2 class="text-sm font-extrabold text-white tracking-wide">Hand Replay</h2>
      </div>

      {#if replay?.hand}
        <span
          class="text-[10px] font-mono px-2 py-1 rounded-md"
          style="background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.6);"
        >
          #{replay.hand.hand_no}
        </span>
      {/if}
    </div>

    {#if loading}
      <div class="flex-1 flex items-center justify-center">
        <div class="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin"></div>
      </div>
    {:else if error}
      <div class="flex-1 flex items-center justify-center p-4">
        <p class="text-red-300 text-sm font-bold">{error}</p>
      </div>
    {:else if currentState && replay?.hand}
      <!-- Table -->
      <div class="flex-1 relative" style="min-height: 0;">
        <div class="absolute inset-0 flex items-center justify-center p-3">
          <div class="relative w-full" style="aspect-ratio: 1 / 1; max-width: 380px;">
            <!-- Outer rim -->
            <div
              class="absolute -inset-2 rounded-[50%]"
              style="
                background: linear-gradient(180deg, #2a2a2a, #0a0a0a);
                box-shadow: 0 8px 30px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.9);
              "
            ></div>

            <!-- Gold trim -->
            <div
              class="absolute -inset-1 rounded-[50%]"
              style="border: 2px solid rgba(212,175,55,0.5); box-shadow: inset 0 0 20px rgba(212,175,55,0.15);"
            ></div>

            <!-- Felt -->
            <div
              class="absolute inset-0 rounded-[50%] overflow-hidden"
              style="background: radial-gradient(ellipse at 50% 45%, #1a5c3a 0%, #0d3d24 55%, #072a1a 100%);"
            >
              <div
                class="absolute inset-0 rounded-[50%]"
                style="box-shadow: inset 0 0 60px rgba(0,0,0,0.7);"
              ></div>
            </div>

            <!-- Community cards -->
            <div
              class="absolute top-[44%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 z-[5]"
            >
              {#each Array(5) as _, i}
                {#if currentState.community[i]}
                  <div class="scale-[0.75] origin-center">
                    <PlayingCard
                      rank={currentState.community[i].r}
                      suit={suitChar(currentState.community[i].s)}
                      size="sm"
                    />
                  </div>
                {:else}
                  <div
                    class="w-8 h-12 rounded-md"
                    style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06);"
                  ></div>
                {/if}
              {/each}
            </div>

            <!-- Pot -->
            {#if currentState.pot > 0}
              <div class="absolute top-[62%] left-1/2 -translate-x-1/2 z-[10]">
                <div
                  class="rounded-full px-3 py-0.5 flex items-center gap-1.5"
                  style="
                    background: rgba(0,0,0,0.92);
                    border: 1.5px solid #d4af37;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.9);
                  "
                >
                  <span class="text-[8px] uppercase tracking-widest font-extrabold text-white/70"
                    >POT</span
                  >
                  <span class="text-[11px] font-extrabold text-gold tabular-nums"
                    >${fmt(currentState.pot)}</span
                  >
                </div>
              </div>
            {/if}

            <!-- Players -->
            {#each currentState.players as p, i}
              {@const pos = seatPos(i, currentState.players.length)}
              {@const isActor = currentState.lastAction?.seat === p.seat && step > 0}
              <div
                class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-[20] pointer-events-none"
                style="left: {pos.x}%; top: {pos.y}%;"
              >
                <div class="relative">
                  <div
                    class="rounded-full p-[2px]"
                    style="
                      background: linear-gradient(180deg,
                        {p.isWinner ? '#f4e5a8' : isActor ? '#3b82f6' : '#1e3a8a'} 0%,
                        {p.isWinner ? '#d4af37' : isActor ? '#1e3a8a' : '#0f1f3a'} 50%,
                        {p.isWinner ? '#a87a15' : isActor ? '#1e3a8a' : '#05080f'} 100%);
                      box-shadow: 0 3px 10px rgba(0,0,0,0.9){p.isWinner
                      ? ', 0 0 18px rgba(212,175,55,0.9)'
                      : ''}{isActor ? ', 0 0 14px rgba(59,130,246,0.8)' : ''};
                      {p.folded ? 'opacity: 0.35; filter: grayscale(0.7);' : ''}
                    "
                  >
                    <div
                      class="relative w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#1a3a5c] to-[#05080f] flex items-center justify-center"
                    >
                      <Avatar avatarId="spade" size="sm" />
                    </div>
                  </div>
                  {#if p.folded}
                    <div class="absolute -bottom-1 left-1/2 -translate-x-1/2">
                      <span
                        class="text-[7px] font-extrabold text-white/90 px-1.5 py-0.5 rounded-full tracking-wider"
                        style="background: linear-gradient(180deg, #4b5563, #1f2937);"
                      >
                        FOLD
                      </span>
                    </div>
                  {/if}
                  {#if p.allIn}
                    <div class="absolute -top-1.5 left-1/2 -translate-x-1/2">
                      <span
                        class="text-[7px] font-extrabold text-white px-1.5 py-0.5 rounded-full tracking-wider"
                        style="background: linear-gradient(180deg, #ef4444, #991b1b); border: 1px solid #fca5a5;"
                      >
                        ALL-IN
                      </span>
                    </div>
                  {/if}
                </div>

                <div
                  class="mt-1 px-2 py-0.5 flex flex-col items-center rounded-md"
                  style="
                    background: linear-gradient(180deg, #f5f5f5 0%, #d4d4d4 100%);
                    border: 1.5px solid {p.isWinner ? '#d4af37' : 'rgba(0,0,0,0.5)'};
                    min-width: 60px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.8);
                  "
                >
                  <p
                    class="text-[9px] font-extrabold text-black leading-none whitespace-nowrap max-w-[72px] overflow-hidden text-ellipsis"
                  >
                    {p.displayName}
                  </p>
                  <p
                    class="text-[9px] font-extrabold leading-tight tabular-nums"
                    style="color: #a87a15;"
                  >
                    ${fmt(p.stack)}
                  </p>
                </div>

                {#if p.betThisStreet > 0 && !p.folded}
                  <div
                    class="mt-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold tabular-nums"
                    style="
                      background: rgba(0,0,0,0.9);
                      border: 1px solid rgba(212,175,55,0.6);
                      color: #f4c95d;
                    "
                  >
                    ${fmt(p.betThisStreet)}
                  </div>
                {/if}
              </div>
            {/each}

            <!-- Last action bubble -->
            {#if currentState.lastAction && step > 0}
              {@const actor = currentState.players.find(
                (x: any) => x.seat === currentState.lastAction.seat,
              )}
              {#if actor}
                {@const pos = seatPos(
                  currentState.players.indexOf(actor),
                  currentState.players.length,
                )}
                <div
                  class="absolute -translate-x-1/2 -translate-y-1/2 z-[25] pointer-events-none"
                  style="left: {pos.x}%; top: {pos.y - 14}%;"
                >
                  <div
                    class="rounded-full px-2.5 py-1 text-[10px] font-extrabold whitespace-nowrap shadow-lg"
                    style="
                      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
                      color: white;
                      border: 1.5px solid rgba(255,255,255,0.4);
                    "
                  >
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

      <!-- Controls -->
      <div class="px-3 py-3 shrink-0" style="border-top: 1px solid rgba(212,175,55,0.15);">
        <!-- Progress -->
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[10px] font-mono text-white/50 tabular-nums shrink-0">
            {step + 1}/{states.length}
          </span>
          <input
            type="range"
            min="0"
            max={states.length - 1}
            bind:value={step}
            class="flex-1 replay-slider"
            style="--progress: {progressPct}%"
            on:input={() => {
              if (playing) {
                stopPlay();
                playing = false;
              }
            }}
          />
          <span
            class="text-[10px] font-mono text-gold tabular-nums shrink-0 uppercase font-extrabold"
          >
            {currentStreet}
          </span>
        </div>

        <!-- Playback -->
        <div class="flex items-center justify-center gap-2 mb-3">
          <!-- Speed -->
          <div
            class="flex rounded-xl overflow-hidden shrink-0"
            style="background: rgba(0,0,0,0.35); border: 1px solid rgba(212,175,55,0.2);"
          >
            {#each [1, 2, 4] as s}
              <button
                on:click={() => setSpeed(s)}
                class="w-8 h-8 text-[10px] font-extrabold transition"
                style="
                  background: {speed === s
                  ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                  : 'transparent'};
                  color: {speed === s ? '#0a0800' : 'rgba(255,255,255,0.6)'};
                "
              >
                {s}×
              </button>
            {/each}
          </div>

          <!-- Skip prev -->
          <button
            on:click={() => skip(-5)}
            class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 active:scale-95"
            style="background: rgba(255,255,255,0.06);"
            aria-label="Skip back"
          >
            <span style="transform: rotate(180deg); display: inline-flex;">
              <Icon name="play" size={14} color="rgba(255,255,255,0.7)" />
            </span>
          </button>

          <!-- Play/pause -->
          <button
            on:click={togglePlay}
            class="w-12 h-12 rounded-full flex items-center justify-center text-near-black active:scale-95"
            style="
              background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
              box-shadow: 0 3px 0 #7a560a, 0 6px 14px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,235,170,0.5);
            "
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {#if playing}
              <Icon name="pause" size={18} color="#0a0800" />
            {:else}
              <Icon name="play" size={18} color="#0a0800" />
            {/if}
          </button>

          <!-- Skip next -->
          <button
            on:click={() => skip(5)}
            class="w-9 h-9 rounded-full flex items-center justify-center text-white/70 active:scale-95"
            style="background: rgba(255,255,255,0.06);"
            aria-label="Skip forward"
          >
            <Icon name="play" size={14} color="rgba(255,255,255,0.7)" />
          </button>
        </div>

        <!-- Street tabs -->
        <div class="flex gap-1.5">
          {#each [['preflop', 'PREFLOP'], ['flop', 'FLOP'], ['turn', 'TURN'], ['river', 'RIVER']] as [key, label]}
            <button
              on:click={() => goToStreet(key)}
              class="flex-1 py-2 rounded-xl text-[9px] font-extrabold uppercase tracking-wider transition"
              style="
                background: {currentStreet === key
                ? 'linear-gradient(180deg, #f4e5a8, #d4af37 45%, #a87a15)'
                : 'rgba(0,0,0,0.35)'};
                color: {currentStreet === key ? '#0a0800' : 'rgba(255,255,255,0.5)'};
                border: 1px solid {currentStreet === key ? 'transparent' : 'rgba(212,175,55,0.15)'};
              "
            >
              {label}
            </button>
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
    background: linear-gradient(
      to right,
      #d4af37 0%,
      #d4af37 var(--progress, 0%),
      rgba(255, 255, 255, 0.1) var(--progress, 0%),
      rgba(255, 255, 255, 0.1) 100%
    );
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
    border: 2px solid #d4af37;
    cursor: pointer;
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.8),
      0 0 0 3px rgba(212, 175, 55, 0.3);
  }
  .replay-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    border: 2px solid #d4af37;
    cursor: pointer;
  }
</style>

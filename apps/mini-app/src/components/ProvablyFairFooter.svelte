<script lang="ts">
  import Icon from './Icon.svelte';
  import { api } from '../lib/api';
  import { t, tError, type MessageKey } from '../i18n';
  import { get } from 'svelte/store';
  import {
    verifyHand,
    type FairProof,
    type FairVerdict,
  } from '../../../../packages/shared/src/fair/verifier.js';

  /** The table's gameState; serverSeedHash / revealSeed / clientSeed / nonce. */
  export let gameState: any = null;

  let open = false;

  $: hash = gameState?.serverSeedHash ?? '';
  $: seed = gameState?.revealSeed ?? '';
  $: clientSeed = gameState?.clientSeed ?? '';
  $: nonce = gameState?.nonce ?? null;
  $: tableId = Number(gameState?.tableId ?? 0);
  $: shortHash = hash ? `${hash.slice(0, 8)}…` : '';

  type Verdict = {
    state: 'ok' | 'pending' | 'not_found' | 'failed' | 'error';
    detail: string;
  };

  /** Translates at call time; the store value is already reactive at render time. */
  function tr(key: MessageKey, params?: Record<string, string | number>): string {
    return get(t)(key, params);
  }

  let verifying = false;
  let verdict: Verdict | null = null;
  let verdictCommitment = '';

  let localVerdict: FairVerdict | null = null;
  let serverVerified: boolean | null = null;

  let mySeedInput = '';
  let mySeed = '';
  let seedStatus = '';
  let seedStatusKey: MessageKey | null = null;
  let seedStatusParams: Record<string, string | number> | undefined;
  let seedBusy = false;
  let seedLoadedFor = '';

  // A new hand means a new commitment: drop the previous verdict.
  $: if (hash !== verdictCommitment) {
    verdictCommitment = hash;
    verdict = null;
    localVerdict = null;
    serverVerified = null;
    verifying = false;
  }

  $: if (open && tableId > 0 && seedLoadedFor !== String(tableId)) {
    seedLoadedFor = String(tableId);
    void loadMySeed(tableId);
  }

  async function loadMySeed(id: number): Promise<void> {
    const res = await api.getFairClientSeed(id);
    if (res.ok && res.data) {
      mySeed = res.data.seed ?? '';
      mySeedInput = mySeed;
      seedStatus = mySeed ? '' : 'No seed set for this table yet.';
    } else {
      seedStatus = SEED_ERRORS[res.error ?? ''] ?? res.error ?? 'Could not load your seed.';
    }
  }

  async function saveMySeed(): Promise<void> {
    if (seedBusy || tableId <= 0) return;
    seedBusy = true;
    seedStatus = '';
    const res = await api.setFairClientSeed(tableId, mySeedInput.trim());
    seedBusy = false;
    if (res.ok && res.data) {
      mySeed = mySeedInput.trim();
      seedStatus = 'Saved. It applies from the next hand.';
      return;
    }
    const err = res.error ?? '';
    seedStatus = SEED_ERRORS[err] ?? `Could not save (${err || res.status}).`;
  }

  async function verify(): Promise<void> {
    if (!hash || verifying) return;
    verifying = true;
    verdict = null;
    localVerdict = null;
    serverVerified = null;

    // 1) Fetch the proof: commitment, revealed seed, client seed and board.
    const res = await api.verifyFairHand(hash);
    verifying = false;

    if (!res.ok) {
      verdict = { state: 'error', detail: res.error ?? 'request_failed' };
      return;
    }

    const data: any = res.data ?? {};
    if (data.pending) {
      verdict = {
        state: 'pending',
        detail: 'Hand in progress. The seed is revealed when the hand ends.',
      };
      return;
    }
    if (data.found === false) {
      verdict = { state: 'not_found', detail: 'No commitment stored for this hand.' };
      return;
    }

    serverVerified = !!data.verified;

    // 2) Re-run the verifier locally: this browser rebuilds the deck itself.
    if (data.proof) {
      try {
        localVerdict = await verifyHand(data.proof as FairProof);
      } catch (e: any) {
        verdict = { state: 'error', detail: `Local verification failed: ${e.message}` };
        return;
      }
    }

    const ok = localVerdict ? localVerdict.ok : serverVerified;
    verdict = ok
      ? {
          state: 'ok',
          detail: localVerdict
            ? 'Verified locally in this browser: commitment, deck and board all match.'
            : 'Verified by the server. Local re-check was unavailable for this hand.',
        }
      : { state: 'failed', detail: 'Verification failed. Do not trust this hand.' };
  }

  function checkLabel(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return 'n/a';
    return value ? 'ok' : 'FAIL';
  }
</script>

{#if hash}
  <button class="pf-footer" on:click={() => (open = true)} aria-label="Provably Fair">
    Provably Fair · {shortHash}
  </button>
{/if}

{#if open}
  <div class="pf-backdrop"></div>
  <div class="pf-modal" role="dialog" aria-modal="true" aria-label="Provably Fair">
    <div class="pf-head">
      <span class="pf-title">Provably Fair</span>
      <button class="pf-close" on:click={() => (open = false)} aria-label="Close">
        <Icon name="close" size={12} color="rgba(255,255,255,0.85)" />
      </button>
    </div>

    <p class="pf-label">Commitment · SHA-256 of the server seed</p>
    <p class="pf-mono">{hash}</p>

    {#if seed}
      <p class="pf-label">Server seed · revealed, this hand is over</p>
      <p class="pf-mono">{seed}</p>
    {:else}
      <p class="pf-note">
        This hash is the commitment. When the hand ends, the seed is revealed. SHA256(seed) must
        equal the hash above.
      </p>
    {/if}

    <p class="pf-label">Client seed · nonce ({nonce ?? '—'})</p>
    <p class="pf-mono">{clientSeed || '—'}</p>

    <p class="pf-label">Your client seed · table #{tableId || '—'}</p>
    <div class="pf-row">
      <input
        class="pf-input"
        type="text"
        maxlength="64"
        placeholder="8-64 chars: A-Z a-z 0-9 - _"
        bind:value={mySeedInput}
        disabled={seedBusy}
      />
      <button class="pf-btn pf-btn--sm" on:click={saveMySeed} disabled={seedBusy}>Save</button>
    </div>
    {#if seedStatus}
      <p class="pf-note">{seedStatus}</p>
    {/if}

    <button class="pf-btn" on:click={verify} disabled={verifying}>
      {verifying ? 'Verifying…' : 'Verify locally'}
    </button>

    <p class="pf-note">
      Player-controlled entropy is mixed into the deck (deck-v2): shuffle seed = HMAC-SHA256(server
      seed, "combined client seed:nonce"). The check above runs in this browser, with the same code
      the server uses, so no trust in the server verdict is required.
    </p>

    {#if verdict}
      <p class="pf-verdict pf-verdict--{verdict.state}">
        {#if verdict.state === 'ok'}Verified{:else if verdict.state === 'pending'}Pending{:else if verdict.state === 'not_found'}Not
          found{:else if verdict.state === 'failed'}Failed{:else}Error{/if}
        · {verdict.detail}
      </p>
    {/if}

    {#if localVerdict}
      <p class="pf-label">Local checks · {localVerdict.algorithm}</p>
      <p class="pf-mono">
        commitment {checkLabel(localVerdict.checks.commitmentMatches)} · deck {checkLabel(
          localVerdict.checks.deckHashMatches,
        )} · board {checkLabel(localVerdict.checks.communityCardsMatch)} · deal {checkLabel(
          localVerdict.checks.boardDealMatches,
        )}
      </p>
      {#if localVerdict.communityPositions}
        <p class="pf-label">Board positions · expected</p>
        <p class="pf-mono">
          {localVerdict.communityPositions.join(',')} · {localVerdict.expectedBoardPositions?.join(
            ',',
          ) ?? '—'}
        </p>
      {/if}
      {#if serverVerified !== null}
        <p class="pf-note">Server cross-check: {serverVerified ? 'verified' : 'not verified'}.</p>
      {/if}
    {/if}
  </div>
{/if}

<style>
  /* Small muted footer, bottom-centre of the felt. */
  .pf-footer {
    position: fixed;
    bottom: calc(104px + env(safe-area-inset-bottom));
    left: 10px;
    z-index: 20;
    background: transparent;
    border: none;
    padding: 2px 6px;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.6px;
    text-transform: uppercase;
    color: rgba(212, 175, 55, 0.45);
    cursor: pointer;
    pointer-events: auto;
    white-space: nowrap;
    /* Shows the short hash: keep it left-to-right in RTL too. */
    direction: ltr;
  }
  .pf-footer:hover {
    color: rgba(212, 175, 55, 0.9);
  }

  /* The action bar (Table.svelte) is a centred 480px bar pinned to bottom-0
     with z-30 and roughly 90px tall, in BOTH layouts. Sit above it so the
     footer is never covered. */

  .pf-backdrop {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
  }

  .pf-modal {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 81;
    width: 90%;
    max-width: 380px;
    max-height: 86vh;
    overflow-y: auto;
    border-radius: 16px;
    padding: 16px;
    background: linear-gradient(180deg, rgba(15, 26, 46, 0.99), rgba(10, 14, 26, 0.99));
    border: 1.5px solid rgba(212, 175, 55, 0.45);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  }

  .pf-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .pf-title {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #f4c95d;
  }
  .pf-close {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .pf-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.45);
    margin-bottom: 3px;
  }
  .pf-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    color: #ffffff;
    word-break: break-all;
    margin-bottom: 10px;
    /* Hashes, seeds and nonces are machine values: never mirrored. */
    direction: ltr;
    text-align: left;
  }
  .pf-note {
    font-size: 10px;
    line-height: 1.45;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 10px;
  }

  .pf-row {
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }
  .pf-input {
    flex: 1 1 auto;
    min-width: 0;
    direction: ltr;
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: #ffffff;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
  }
  .pf-input::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  .pf-btn {
    width: 100%;
    padding: 8px 10px;
    margin-bottom: 10px;
    border-radius: 10px;
    border: 1px solid rgba(212, 175, 55, 0.5);
    background: rgba(212, 175, 55, 0.12);
    color: #f4c95d;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .pf-btn--sm {
    width: auto;
    margin-bottom: 0;
    flex: 0 0 auto;
    padding: 8px 12px;
  }
  .pf-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .pf-verdict {
    font-size: 10px;
    line-height: 1.45;
    margin-bottom: 10px;
    color: rgba(255, 255, 255, 0.75);
  }
  .pf-verdict--ok {
    color: #4ade80;
  }
  .pf-verdict--pending {
    color: #f4c95d;
  }
  .pf-verdict--failed,
  .pf-verdict--error {
    color: #f87171;
  }
  .pf-verdict--not_found {
    color: rgba(255, 255, 255, 0.6);
  }
</style>

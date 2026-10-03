<script lang="ts">
  import { adminPromptOpen, confirmAdmin, cancelAdmin } from '../stores/admin';
  import Icon from './Icon.svelte';

  let secret = '';
  let busy = false;
  let error = '';
  let shake = false;

  $: if ($adminPromptOpen) {
    secret = '';
    error = '';
    busy = false;
    shake = false;
  }

  async function tryLogin() {
    if (!secret || busy) return;
    busy = true;
    error = '';
    try {
      const res = await fetch('/api/admin/stats', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
      });
      if (res.ok) {
        localStorage.setItem('admin_secret', secret);
        confirmAdmin();
      } else {
        // Admin surfaces stay English-only (P2_I18N_DESIGN.md, decisions #4).
        error = 'Wrong secret';
        shake = true;
        setTimeout(() => (shake = false), 500);
        secret = '';
      }
    } catch (e: any) {
      error = e.message || 'network error';
    } finally {
      busy = false;
    }
  }

  function close() {
    if (busy) return;
    cancelAdmin();
  }
</script>

{#if $adminPromptOpen}
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center px-4"
    style="background: rgba(5,8,15,0.92); backdrop-filter: blur(8px);"
    on:click={close}
    role="presentation"
  >
    <div
      class="w-full max-w-sm rounded-3xl p-6 relative"
      class:shake
      style="..."
      on:click={(e) => e.stopPropagation()}
      on:keydown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Admin access"
      tabindex="-1"
    >
      <div class="flex justify-center mb-4">
        <div
          class="w-16 h-16 rounded-2xl flex items-center justify-center"
          style="
            background: linear-gradient(180deg, rgba(212,175,55,0.15), rgba(168,122,21,0.08));
            border: 1.5px solid rgba(212,175,55,0.4);
          "
        >
          <Icon name="lock" size={28} color="#d4af37" />
        </div>
      </div>

      <h2 class="text-center text-lg font-extrabold text-white mb-1">Admin Access</h2>
      <p class="text-center text-tiny text-white/50 mb-5">Enter your admin secret key</p>

      <input
        type="password"
        bind:value={secret}
        on:keydown={(e) => e.key === 'Enter' && tryLogin()}
        placeholder="Admin secret"
        autocomplete="off"
        disabled={busy}
        class="w-full rounded-xl px-4 py-3 text-sm text-white outline-none font-mono tracking-wider mb-3 disabled:opacity-50"
        style="
          background: rgba(0,0,0,0.5);
          border: 1.5px solid {error ? 'rgba(239,68,68,0.5)' : 'rgba(212,175,55,0.3)'};
        "
      />

      {#if error}
        <p class="text-tiny text-red-300 text-center mb-3 font-bold">{error}</p>
      {/if}

      <div class="flex gap-2">
        <button
          on:click={close}
          disabled={busy}
          class="flex-1 rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-wider disabled:opacity-40"
          style="
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.7);
          "
        >
          Cancel
        </button>
        <button
          on:click={tryLogin}
          disabled={busy || !secret}
          class="flex-1 rounded-xl py-2.5 text-[12px] font-extrabold uppercase tracking-wider disabled:opacity-40"
          style="
            background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
            color: #0a0800;
            box-shadow: 0 2px 0 #7a560a, inset 0 1px 0 rgba(255,235,170,0.4);
          "
        >
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .shake {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }
  @keyframes shake {
    10%,
    90% {
      transform: translateX(-2px);
    }
    20%,
    80% {
      transform: translateX(4px);
    }
    30%,
    50%,
    70% {
      transform: translateX(-6px);
    }
    40%,
    60% {
      transform: translateX(6px);
    }
  }
</style>

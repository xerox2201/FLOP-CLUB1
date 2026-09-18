<script lang="ts">
  import { auth } from '../stores/auth';

  let busy = false;

  async function enter() {
    busy = true;
    try {
      await auth.init();
    } catch (e) {
      console.error(e);
    }
    busy = false;
  }
</script>

<div class="relative min-h-screen w-full overflow-hidden">
  <!-- ============ BACKGROUND IMAGE ============ -->
  <img
    src="/login-bg.png"
    alt=""
    class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
    draggable="false"
  />

  <!-- ============ DARK OVERLAY ============ -->
  <div
    class="absolute inset-0"
    style="
      background:
        radial-gradient(ellipse at 50% 30%, rgba(7,14,27,0.4) 0%, rgba(7,14,27,0.85) 50%, rgba(5,8,15,0.98) 100%);
    "
  ></div>

  <!-- ============ GOLD GLOW TOP ============ -->
  <div
    class="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-40 pointer-events-none"
    style="background: radial-gradient(circle, rgba(212,175,55,0.35), transparent 60%);"
  ></div>

  <!-- ============ CONTENT ============ -->
  <div class="relative z-10 flex flex-col items-center justify-between min-h-screen px-6 py-10">
    <!-- TOP: Logo -->
    <div class="flex flex-col items-center w-full mt-6">
           <!-- Spade mark -->
      <div class="relative mb-6">
        <div
          class="absolute inset-0 blur-3xl opacity-70 pointer-events-none"
          style="background: radial-gradient(circle, #3b82f6, transparent 70%);"
        ></div>
        <img
          src="/logo.png.png"
          alt="Flop Club"
          class="relative w-32 h-32 object-contain select-none"
          style="filter: drop-shadow(0 8px 28px rgba(59,130,246,0.6));"
          draggable="false"
        />
      </div>

      <h1
        class="text-4xl font-extrabold tracking-[0.25em] text-center"
        style="
          background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 4px 24px rgba(212,175,55,0.4);
        "
      >
        FLOP CLUB
      </h1>

      <div class="flex items-center gap-3 mt-3">
        <div class="h-px w-12" style="background: linear-gradient(to right, transparent, #d4af37);"></div>
        <p class="text-[10px] font-extrabold tracking-[0.4em] text-gold/80 uppercase">
          Play · Compete · Win
        </p>
        <div class="h-px w-12" style="background: linear-gradient(to left, transparent, #d4af37);"></div>
      </div>
    </div>

    <!-- MIDDLE: Tagline -->
    <div class="flex flex-col items-center w-full max-w-sm text-center">
      <p class="text-[13px] text-white/60 leading-relaxed">
        Real players. Real action.<br />The ultimate poker experience.
      </p>
    </div>

    <!-- BOTTOM: Login button -->
    <div class="w-full max-w-sm flex flex-col items-center">
      <button
        on:click={enter}
        disabled={busy}
        class="btn btn-gold w-full flex items-center justify-center gap-2.5 disabled:opacity-50"
        style="padding: 16px 24px; font-size: 15px;"
      >
        {#if busy}
          <div
            class="w-5 h-5 border-2 border-black/40 border-t-black rounded-full animate-spin"
          ></div>
          <span>Signing in…</span>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
          </svg>
          <span>Enter with Telegram</span>
        {/if}
      </button>

      <p class="text-[10px] text-white/35 mt-4 text-center leading-relaxed max-w-xs">
        By entering, you agree to our<br />
        <span class="text-gold/70 font-bold">Terms of Service</span> &amp;
        <span class="text-gold/70 font-bold">Fair Play Policy</span>
      </p>
    </div>
  </div>
</div>
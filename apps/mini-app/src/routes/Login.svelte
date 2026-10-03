<script lang="ts">
  import { auth } from '../stores/auth';
  import { t } from '../i18n';

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

<div class="relative min-h-screen w-full overflow-hidden" style="background: #05080f;">
  <!-- ============ BACKGROUND IMAGE ============ -->
  <img
    src="/login-bg.jpg"
    alt=""
    class="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
    draggable="false"
  />

  <!-- ============ CINEMATIC VIGNETTE ============ -->
  <div
    class="absolute inset-0 pointer-events-none"
    style="
      background:
        radial-gradient(ellipse at 50% 45%, transparent 0%, rgba(5,8,15,0.35) 55%, rgba(5,8,15,0.9) 100%),
        linear-gradient(180deg, rgba(5,8,15,0.6) 0%, transparent 30%, transparent 60%, rgba(5,8,15,0.85) 100%);
    "
  ></div>

  <!-- ============ GOLD GLOW TOP ============ -->
  <div
    class="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[600px] opacity-30 pointer-events-none"
    style="background: radial-gradient(circle, rgba(212,175,55,0.5), transparent 60%);"
  ></div>

  <!-- ============ CONTENT ============ -->
  <div class="relative z-10 flex flex-col items-center justify-between min-h-screen px-6 py-10">
    <!-- TOP: Logo + Title -->
    <div class="flex flex-col items-center w-full mt-2">
      <!-- Logo -->
      <img
        src="/logo-flop-club.png"
        alt="Flop Club"
        class="w-20 h-20 object-contain mb-3"
        style="filter: drop-shadow(0 8px 32px rgba(212,175,55,0.6));"
        draggable="false"
      />

      <h1
        class="text-4xl font-extrabold tracking-[0.25em] text-center"
        style="
          background: linear-gradient(180deg, #f4e5a8 0%, #d4af37 45%, #a87a15 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 24px rgba(212,175,55,0.5));
        "
      >
        FLOP CLUB
      </h1>

      <div class="flex items-center gap-3 mt-3">
        <div
          class="h-px w-12"
          style="background: linear-gradient(to right, transparent, #d4af37);"
        ></div>
        <p class="text-mini font-extrabold tracking-[0.4em] text-gold/90 uppercase">
          {$t('brand.tagline')}
        </p>
        <div
          class="h-px w-12"
          style="background: linear-gradient(to left, transparent, #d4af37);"
        ></div>
      </div>
    </div>

    <!-- MIDDLE: Cinematic slogan -->
    <div class="flex flex-col items-center w-full max-w-md text-center">
      <!-- MAKE OR BREAK — eyebrow -->
      <div class="flex items-center gap-3 mb-4">
        <div
          class="h-px w-8"
          style="background: linear-gradient(to right, transparent, rgba(212,175,55,0.7));"
        ></div>
        <p
          class="text-tiny font-extrabold tracking-[0.55em] uppercase"
          style="
            color: #d4af37;
            text-shadow:
              0 0 12px rgba(212,175,55,0.7),
              0 0 24px rgba(212,175,55,0.4),
              0 2px 6px rgba(0,0,0,1);
          "
        >
          {$t('login.eyebrow')}
        </p>
        <div
          class="h-px w-8"
          style="background: linear-gradient(to left, transparent, rgba(212,175,55,0.7));"
        ></div>
      </div>

      <!-- HERO LINE — big cinematic -->
      <h2
        class="font-extrabold leading-[1.05] mb-4"
        style="
          font-size: clamp(28px, 8vw, 40px);
          letter-spacing: -0.02em;
          background: linear-gradient(180deg, #ffffff 0%, #f4e5a8 40%, #d4af37 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 4px 20px rgba(0,0,0,1)) drop-shadow(0 2px 4px rgba(0,0,0,1));
        "
      >
        {$t('login.heroLine1')}<br />{$t('login.heroLine2')}
      </h2>

      <!-- SUB — tagline -->
      <p
        class="text-[12px] font-semibold leading-relaxed tracking-wide"
        style="
          color: rgba(255,255,255,0.95);
          text-shadow:
            0 0 2px rgba(0,0,0,1),
            0 0 6px rgba(0,0,0,1),
            0 2px 8px rgba(0,0,0,1),
            0 4px 16px rgba(0,0,0,1),
            0 0 32px rgba(0,0,0,0.9);
        "
      >
        {$t('login.tagline1')}<br />{$t('login.tagline2')}
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
          <span>{$t('login.signingIn')}</span>
        {:else}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"
            />
          </svg>
          <span>{$t('login.enterBtn')}</span>
        {/if}
      </button>

      <p
        class="text-mini text-white/60 mt-4 text-center leading-relaxed max-w-xs"
        style="text-shadow: 0 1px 6px rgba(0,0,0,1);"
      >
        {$t('login.termsLead')}<br />
        <span class="text-gold/90 font-bold">{$t('login.termsTos')}</span> &amp;
        <span class="text-gold/90 font-bold">{$t('login.termsFair')}</span>
      </p>
    </div>
  </div>
</div>

<script lang="ts">
  /**
   * Table surface (rail + felt) — ONE component for both layouts.
   *
   * The table top is a designed image asset, exactly like the mobile layout
   * always was. The desktop layout previously drew two CSS divs (a thin ring
   * plus a gradient) which is why it never looked like a real table.
   * A gradient fallback sits behind the image so the table is never a hole.
   */
  export let variant: 'desktop' | 'mobile' = 'desktop';
  export let isFinal = false;
  export let tournament = false;

  $: src = variant === 'desktop' ? '/table-top-desktop.webp' : '/table-top-mobile.webp';
  $: baseShadow =
    variant === 'desktop'
      ? 'drop-shadow(0 26px 60px rgba(0,0,0,0.92))'
      : 'drop-shadow(0 16px 40px rgba(0,0,0,0.9))';
  $: glow = isFinal ? ' drop-shadow(0 0 34px rgba(212,175,55,0.42))' : '';
</script>

<div class="surface" dir="ltr" aria-hidden="true">
  <div class="surface-fallback {tournament ? 'is-tournament' : 'is-cash'}"></div>
  <img {src} alt="" class="surface-img" draggable="false" style="filter: {baseShadow}{glow};" />
</div>

<style>
  .surface {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  /* Fallback felt, only visible if the image fails to load. */
  .surface-fallback {
    position: absolute;
    inset: 0;
    border-radius: 50%;
  }
  .surface-fallback.is-cash {
    background: radial-gradient(ellipse at 50% 38%, #2f5586 0%, #1b3355 55%, #0b1424 100%);
    box-shadow: inset 0 0 90px rgba(0, 0, 0, 0.75);
  }
  .surface-fallback.is-tournament {
    background: radial-gradient(ellipse at 50% 38%, #4a2f6b 0%, #2b1c47 55%, #120b22 100%);
    box-shadow: inset 0 0 90px rgba(0, 0, 0, 0.75);
  }

  .surface-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    user-select: none;
    pointer-events: none;
  }
</style>

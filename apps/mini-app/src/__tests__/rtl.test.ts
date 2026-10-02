import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { dir, loadLanguage } from '../i18n';
import { get } from 'svelte/store';
import Icon from '../components/Icon.svelte';
import PlayingCard from '../components/PlayingCard.svelte';
import PokerChip from '../components/PokerChip.svelte';

beforeEach(async () => {
  localStorage.clear();
  await loadLanguage('en');
});

describe('rtl document', () => {
  it('flips <html> with the language and back', async () => {
    expect(document.documentElement.dir).toBe('ltr');
    await loadLanguage('fa');
    expect(get(dir)).toBe('rtl');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('fa');
    await loadLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('leaves Latin languages untouched', async () => {
    for (const l of ['tr', 'ru', 'zh'] as const) {
      await loadLanguage(l);
      expect(document.documentElement.dir, l).toBe('ltr');
    }
  });
});

describe('ltr islands', () => {
  it('keeps cards left-to-right inside an rtl document', async () => {
    await loadLanguage('fa');
    const { container } = render(PlayingCard, { rank: 'A', suit: '♠' });
    const card = container.querySelector('.card-outer');
    expect(document.documentElement.dir).toBe('rtl');
    expect(card).toHaveAttribute('dir', 'ltr');
  });

  it('keeps chip stacks left-to-right inside an rtl document', async () => {
    await loadLanguage('fa');
    const { container } = render(PokerChip, { amount: 250 });
    expect(container.querySelector('.chip-root')).toHaveAttribute('dir', 'ltr');
  });
});

describe('icon mirroring', () => {
  it('mirrors direction-aware icons only in rtl', async () => {
    const ltr = render(Icon, { name: 'arrow-left', size: 16 });
    expect(ltr.container.querySelector('img')?.getAttribute('style')).not.toContain('scaleX(-1)');
    ltr.unmount();

    await loadLanguage('fa');
    const rtl = render(Icon, { name: 'arrow-left', size: 16 });
    expect(rtl.container.querySelector('img')?.getAttribute('style')).toContain('scaleX(-1)');
    rtl.unmount();
  });

  it('never mirrors non-directional icons', async () => {
    await loadLanguage('fa');
    const { container } = render(Icon, { name: 'gem', size: 16 });
    expect(container.querySelector('img')?.getAttribute('style')).not.toContain('scaleX(-1)');
  });

  it('can opt out with mirror={false}', async () => {
    await loadLanguage('fa');
    const { container } = render(Icon, { name: 'arrow-right', size: 16, mirror: false });
    expect(container.querySelector('img')?.getAttribute('style')).not.toContain('scaleX(-1)');
  });

  it('renders the requested glyph in both directions', async () => {
    await loadLanguage('fa');
    render(Icon, { name: 'arrow-left', size: 16 });
    expect(screen.getAllByAltText('arrow-left').length).toBeGreaterThan(0);
  });
});

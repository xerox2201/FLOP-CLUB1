import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PlayingCard from '../PlayingCard.svelte';

describe('PlayingCard', () => {
  it('renders rank and suit', () => {
    render(PlayingCard, { rank: 'A', suit: '♠' });
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('♠')).toBeInTheDocument();
  });

  it('applies red color for hearts', () => {
    const { container } = render(PlayingCard, { rank: 'K', suit: '♥' });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('text-red-600');
  });

  it('applies red color for diamonds', () => {
    const { container } = render(PlayingCard, { rank: 'Q', suit: '♦' });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('text-red-600');
  });

  it('applies black color for spades', () => {
    const { container } = render(PlayingCard, { rank: 'J', suit: '♠' });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('text-black');
  });

  it('applies black color for clubs', () => {
    const { container } = render(PlayingCard, { rank: '10', suit: '♣' });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('text-black');
  });

  it('renders different sizes', () => {
    const { container } = render(PlayingCard, { rank: 'A', suit: '♠', size: 'lg' });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('w-14');
  });
});

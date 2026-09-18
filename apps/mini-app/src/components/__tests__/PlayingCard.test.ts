import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import PlayingCard from '../PlayingCard.svelte';

describe('PlayingCard', () => {
  it('renders rank and suit', () => {
    render(PlayingCard, { rank: 'A', suit: '♠' });
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('♠')).toBeTruthy();
  });

  it('renders different sizes', () => {
    const { container } = render(PlayingCard, { rank: 'A', suit: '♠', size: 'lg' });
    const card = container.firstChild as HTMLElement;
    expect(card).toBeTruthy();
  });
});
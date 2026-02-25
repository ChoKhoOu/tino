import React from 'react';
import { describe, it, expect, jest } from 'bun:test';
import { render } from 'ink-testing-library';
import { CommandPalette } from '../CommandPalette.js';
import type { CommandPaletteItem } from '../CommandPalette.js';

const mockItems: CommandPaletteItem[] = [
  { id: 'm1', category: 'Market', title: 'View Bitcoin Price', command: 'btc price' },
  { id: 'm2', category: 'Market', title: 'View Ethereum Price', command: 'eth price' },
  { id: 'b1', category: 'Backtest', title: 'Run Backtest', command: 'run backtest' },
  { id: 's1', category: 'Settings', title: 'Toggle Verbose', command: '/verbose' },
];

const mockSetQuery = jest.fn();
const mockOnSelect = jest.fn();

describe('CommandPalette', () => {
  it('should render nothing when isOpen is false', () => {
    const { lastFrame } = render(
      <CommandPalette
        isOpen={false}
        query=""
        setQuery={mockSetQuery}
        selectedIndex={0}
        items={mockItems}
        onSelect={mockOnSelect}
      />,
    );
    expect(lastFrame()).toBe('');
  });

  it('should render items when open', () => {
    const { lastFrame } = render(
      <CommandPalette
        isOpen={true}
        query=""
        setQuery={mockSetQuery}
        selectedIndex={0}
        items={mockItems}
        onSelect={mockOnSelect}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('View Bitcoin Price');
    expect(output).toContain('View Ethereum Price');
    expect(output).toContain('Run Backtest');
    expect(output).toContain('Toggle Verbose');
  });

  it('should show category labels', () => {
    const { lastFrame } = render(
      <CommandPalette
        isOpen={true}
        query=""
        setQuery={mockSetQuery}
        selectedIndex={0}
        items={mockItems}
        onSelect={mockOnSelect}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Market');
    expect(output).toContain('Backtest');
    expect(output).toContain('Settings');
  });

  it('should show "No results found" when items is empty', () => {
    const { lastFrame } = render(
      <CommandPalette
        isOpen={true}
        query="zzz"
        setQuery={mockSetQuery}
        selectedIndex={0}
        items={[]}
        onSelect={mockOnSelect}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('No results found');
  });

  it('should limit visible items to 10', () => {
    const manyItems: CommandPaletteItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`,
      category: 'Test',
      title: `Command ${i}`,
      command: `cmd-${i}`,
    }));

    const { lastFrame } = render(
      <CommandPalette
        isOpen={true}
        query=""
        setQuery={mockSetQuery}
        selectedIndex={0}
        items={manyItems}
        onSelect={mockOnSelect}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Command 0');
    expect(output).toContain('Command 9');
    expect(output).not.toContain('Command 10');
  });

  it('should scroll to show selected item when beyond visible range', () => {
    const manyItems: CommandPaletteItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `item-${i}`,
      category: 'Test',
      title: `Command ${i}`,
      command: `cmd-${i}`,
    }));

    const { lastFrame } = render(
      <CommandPalette
        isOpen={true}
        query=""
        setQuery={mockSetQuery}
        selectedIndex={12}
        items={manyItems}
        onSelect={mockOnSelect}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('Command 12');
    expect(output).not.toContain('Command 0');
  });

  it('should show subtitle when present', () => {
    const itemsWithSubtitle: CommandPaletteItem[] = [
      { id: 'sub1', category: 'System', title: '/help', subtitle: 'Show available commands', command: '/help' },
    ];

    const { lastFrame } = render(
      <CommandPalette
        isOpen={true}
        query=""
        setQuery={mockSetQuery}
        selectedIndex={0}
        items={itemsWithSubtitle}
        onSelect={mockOnSelect}
      />,
    );
    const output = lastFrame()!;
    expect(output).toContain('/help');
    expect(output).toContain('Show available commands');
  });
});

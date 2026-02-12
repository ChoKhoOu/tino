import { describe, test, expect, beforeEach } from 'bun:test';
import type { ToolContext } from '@/domain/index.js';
import plugin, { resetTodos } from './todo.tool.js';

const ctx: ToolContext = {
  signal: new AbortController().signal,
  onProgress: () => {},
  config: {},
};

beforeEach(() => {
  resetTodos();
});

describe('todo tool', () => {
  test('has correct id, domain, and riskLevel', () => {
    expect(plugin.id).toBe('todo_write');
    expect(plugin.domain).toBe('agent');
    expect(plugin.riskLevel).toBe('safe');
  });

  test('creates todo items and returns full list', async () => {
    const result = await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'First task', status: 'pending', priority: 'high' },
          { id: 't2', content: 'Second task', status: 'pending', priority: 'medium' },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.todos).toHaveLength(2);
    expect(parsed.todos[0]).toEqual({
      id: 't1',
      content: 'First task',
      status: 'pending',
      priority: 'high',
    });
    expect(parsed.todos[1]).toEqual({
      id: 't2',
      content: 'Second task',
      status: 'pending',
      priority: 'medium',
    });
  });

  test('updates todo status', async () => {
    await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Task one', status: 'pending', priority: 'high' },
        ],
      },
      ctx,
    );

    const result = await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Task one', status: 'in_progress', priority: 'high' },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.todos).toHaveLength(1);
    expect(parsed.todos[0].status).toBe('in_progress');
  });

  test('updates todo priority', async () => {
    await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Task one', status: 'pending', priority: 'low' },
        ],
      },
      ctx,
    );

    const result = await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Task one', status: 'pending', priority: 'high' },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.todos[0].priority).toBe('high');
  });

  test('handles empty list', async () => {
    const result = await plugin.execute({ todos: [] }, ctx);
    const parsed = JSON.parse(result);
    expect(parsed.todos).toEqual([]);
  });

  test('handles duplicate IDs by overwriting', async () => {
    await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Original', status: 'pending', priority: 'low' },
          { id: 't1', content: 'Overwritten', status: 'completed', priority: 'high' },
        ],
      },
      ctx,
    );

    const result = await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Overwritten', status: 'completed', priority: 'high' },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.todos).toHaveLength(1);
    expect(parsed.todos[0].content).toBe('Overwritten');
    expect(parsed.todos[0].status).toBe('completed');
  });

  test('full lifecycle: pending -> in_progress -> completed', async () => {
    // Create
    await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Build feature', status: 'pending', priority: 'high' },
          { id: 't2', content: 'Write tests', status: 'pending', priority: 'medium' },
        ],
      },
      ctx,
    );

    // Start first task
    await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Build feature', status: 'in_progress', priority: 'high' },
          { id: 't2', content: 'Write tests', status: 'pending', priority: 'medium' },
        ],
      },
      ctx,
    );

    // Complete first, start second
    const result = await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'Build feature', status: 'completed', priority: 'high' },
          { id: 't2', content: 'Write tests', status: 'in_progress', priority: 'medium' },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.todos).toHaveLength(2);
    expect(parsed.todos[0].status).toBe('completed');
    expect(parsed.todos[1].status).toBe('in_progress');
  });

  test('replaces entire list on each call', async () => {
    // First call with 3 items
    await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'A', status: 'pending', priority: 'high' },
          { id: 't2', content: 'B', status: 'pending', priority: 'medium' },
          { id: 't3', content: 'C', status: 'pending', priority: 'low' },
        ],
      },
      ctx,
    );

    // Second call with only 2 items — t3 should be gone
    const result = await plugin.execute(
      {
        todos: [
          { id: 't1', content: 'A', status: 'completed', priority: 'high' },
          { id: 't2', content: 'B', status: 'in_progress', priority: 'medium' },
        ],
      },
      ctx,
    );

    const parsed = JSON.parse(result);
    expect(parsed.todos).toHaveLength(2);
    expect(parsed.todos.find((t: { id: string }) => t.id === 't3')).toBeUndefined();
  });
});

import { z } from 'zod';
import { definePlugin } from '@/domain/index.js';

const todoItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  priority: z.enum(['high', 'medium', 'low']),
});

const schema = z.object({
  todos: z.array(todoItemSchema).describe('The complete todo list to replace current state'),
});

type TodoItem = z.infer<typeof todoItemSchema>;

let todos: TodoItem[] = [];

export function resetTodos(): void {
  todos = [];
}

export default definePlugin({
  id: 'todo_write',
  domain: 'agent',
  riskLevel: 'safe',
  description:
    'Manage a session-level task list. Receives the FULL todo list each call, replacing previous state. Use to track multi-step work progress.',
  schema,
  execute: async (raw) => {
    const { todos: incoming } = schema.parse(raw);
    todos = incoming;
    return JSON.stringify({ todos });
  },
});

import type { TokenUsage } from '@/domain/events.js';

export interface SessionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string; // ISO 8601
}

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
}

export interface Session {
  id: string;
  title: string;
  messages: SessionMessage[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  tokenUsage?: TokenUsage;
  todos?: TodoItem[];
}

export interface SessionMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

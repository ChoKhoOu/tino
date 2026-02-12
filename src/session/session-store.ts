import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Session, SessionMessage, SessionMetadata } from './session.js';

const DEFAULT_DIR = join(homedir(), '.tino', 'sessions');

export class SessionStore {
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? DEFAULT_DIR;
  }

  async save(session: Session): Promise<void> {
    try {
      this.ensureDir();
      const filePath = this.pathFor(session.id);
      await Bun.write(filePath, JSON.stringify(session, null, 2));
    } catch (err) {
      console.error('[SessionStore] save error:', err);
    }
  }

  async load(id: string): Promise<Session | null> {
    try {
      const filePath = this.pathFor(id);
      const file = Bun.file(filePath);
      if (!(await file.exists())) return null;
      const text = await file.text();
      return JSON.parse(text) as Session;
    } catch (err) {
      console.error('[SessionStore] load error:', err);
      return null;
    }
  }

  async list(): Promise<SessionMetadata[]> {
    try {
      if (!existsSync(this.baseDir)) return [];
      const files = readdirSync(this.baseDir).filter((f) => f.endsWith('.json'));
      const results: SessionMetadata[] = [];

      for (const file of files) {
        try {
          const filePath = join(this.baseDir, file);
          const text = await Bun.file(filePath).text();
          const session = JSON.parse(text) as Session;
          results.push({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages.length,
          });
        } catch {
          continue;
        }
      }

      return results;
    } catch (err) {
      console.error('[SessionStore] list error:', err);
      return [];
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const filePath = this.pathFor(id);
      if (!existsSync(filePath)) return false;
      unlinkSync(filePath);
      return true;
    } catch (err) {
      console.error('[SessionStore] delete error:', err);
      return false;
    }
  }

  async fork(id: string): Promise<string | null> {
    try {
      const session = await this.load(id);
      if (!session) return null;
      const now = new Date().toISOString();
      const newId = `ses_${crypto.randomUUID().slice(0, 8)}`;
      const forked: Session = {
        id: newId,
        title: `${session.title} (fork)`,
        messages: JSON.parse(JSON.stringify(session.messages)),
        createdAt: now,
        updatedAt: now,
        tokenUsage: session.tokenUsage,
        todos: session.todos ? JSON.parse(JSON.stringify(session.todos)) : undefined,
      };
      await this.save(forked);
      return newId;
    } catch (err) {
      console.error('[SessionStore] fork error:', err);
      return null;
    }
  }

  async rename(id: string, title: string): Promise<boolean> {
    try {
      const session = await this.load(id);
      if (!session) return false;
      session.title = title;
      session.updatedAt = new Date().toISOString();
      await this.save(session);
      return true;
    } catch (err) {
      console.error('[SessionStore] rename error:', err);
      return false;
    }
  }

  async appendMessage(id: string, message: SessionMessage): Promise<void> {
    try {
      const session = await this.load(id);
      if (!session) return;
      session.messages.push(message);
      session.updatedAt = new Date().toISOString();
      await this.save(session);
    } catch (err) {
      console.error('[SessionStore] appendMessage error:', err);
    }
  }

  private pathFor(id: string): string {
    return join(this.baseDir, `${id}.json`);
  }

  private ensureDir(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }
}

import { useState, useCallback } from 'react';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';

import { useKeyboardBinding } from '@/keyboard/use-keyboard.js';

const DEFAULT_EDITOR = 'vi';

export interface UseExternalEditorOptions {
  getCurrentText: () => string;
  onTextUpdate: (newText: string) => void;
}

export function detectEditor(): string {
  const editor = process.env.EDITOR;
  if (editor && editor.length > 0) return editor;

  const visual = process.env.VISUAL;
  if (visual && visual.length > 0) return visual;

  return DEFAULT_EDITOR;
}

export async function createTempFile(content: string): Promise<string> {
  const filename = `tino-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.txt`;
  const tempPath = join(tmpdir(), filename);
  await Bun.write(tempPath, content);
  return tempPath;
}

export async function readTempFile(filePath: string): Promise<string> {
  try {
    if (!existsSync(filePath)) return '';
    const content = await Bun.file(filePath).text();
    return content.replace(/\n$/, '');
  } catch {
    return '';
  }
}

export function cleanupTempFile(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // Never throw on cleanup
  }
}

async function launchEditor(editor: string, filePath: string): Promise<number> {
  const parts = editor.split(/\s+/);
  const cmd = parts[0]!;
  const args = [...parts.slice(1), filePath];

  const proc = Bun.spawn([cmd, ...args], {
    cwd: process.cwd(),
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env },
  });

  return proc.exited;
}

export function useExternalEditor(options: UseExternalEditorOptions) {
  const { getCurrentText, onTextUpdate } = options;
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const openEditor = useCallback(async () => {
    if (isEditorOpen) return;

    const editor = detectEditor();
    let tempPath: string | undefined;

    try {
      setIsEditorOpen(true);
      tempPath = await createTempFile(getCurrentText());
      const exitCode = await launchEditor(editor, tempPath);

      if (exitCode === 0) {
        const newContent = await readTempFile(tempPath);
        onTextUpdate(newContent);
      }
    } catch {
      // Editor launch failure — silently ignore
    } finally {
      if (tempPath) cleanupTempFile(tempPath);
      setIsEditorOpen(false);
    }
  }, [isEditorOpen, getCurrentText, onTextUpdate]);

  useKeyboardBinding('normal', 'ctrl+g', useCallback(() => {
    openEditor();
    return true;
  }, [openEditor]));

  return { openEditor, isEditorOpen };
}

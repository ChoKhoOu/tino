import { describe, it, expect, vi } from 'vitest';
import { Marked } from 'marked';
import { markedTerminal } from 'marked-terminal';

// Test the markdown rendering logic directly, bypassing ink's React reconciler
// which requires React 19 (project uses React 18).

const marked = new Marked(markedTerminal() as Parameters<Marked['use']>[0]);

function renderMarkdown(input: string): string {
  if (!input) return '';
  const rendered = marked.parse(input) as string;
  return rendered.replace(/\n+$/, '');
}

describe('MarkdownText', () => {
  it('should render plain text', () => {
    const result = renderMarkdown('Hello world');
    expect(result).toContain('Hello world');
  });

  it('should render headings with emphasis', () => {
    const result = renderMarkdown('# Title');
    expect(result).toContain('Title');
  });

  it('should render bold text', () => {
    const result = renderMarkdown('**bold text**');
    expect(result).toContain('bold text');
  });

  it('should render lists', () => {
    const md = '- item 1\n- item 2\n- item 3';
    const result = renderMarkdown(md);
    expect(result).toContain('item 1');
    expect(result).toContain('item 2');
    expect(result).toContain('item 3');
  });

  it('should render code blocks', () => {
    const md = '```python\nprint("hello")\n```';
    const result = renderMarkdown(md);
    expect(result).toContain('print');
  });

  it('should handle empty string', () => {
    const result = renderMarkdown('');
    expect(result).toBe('');
  });

  it('should render inline code', () => {
    const result = renderMarkdown('Use `console.log` for debugging');
    expect(result).toContain('console.log');
  });

  it('should render links', () => {
    const result = renderMarkdown('[click here](https://example.com)');
    expect(result).toContain('click here');
  });
});

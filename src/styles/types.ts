/**
 * Source of a style definition.
 * - builtin: Shipped with Tino
 * - user: User-level styles (~/.tino/styles/)
 * - project: Project-level styles (.tino/styles/)
 */
export type StyleSource = 'builtin' | 'user' | 'project';

/**
 * Output style definition that modifies the agent's system prompt.
 * Custom styles use markdown files with YAML frontmatter (body = systemPromptModifier).
 */
export interface OutputStyle {
  /** Unique style name (e.g., "concise", "explanatory") */
  name: string;
  /** Human-readable description of the style */
  description: string;
  /** Text appended to the system prompt when this style is active */
  systemPromptModifier: string;
  /** Where this style was discovered from */
  source: StyleSource;
}

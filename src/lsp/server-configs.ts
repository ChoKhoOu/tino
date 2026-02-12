import { extname } from 'path';

export interface LspServerConfig {
  languageId: string;
  command: string;
  args: string[];
  rootPatterns: string[];
  fileExtensions: string[];
}

export const TYPESCRIPT_SERVER_CONFIG: LspServerConfig = {
  languageId: 'typescript',
  command: 'typescript-language-server',
  args: ['--stdio'],
  rootPatterns: ['package.json', 'tsconfig.json', 'jsconfig.json'],
  fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
};

export const PYTHON_SERVER_CONFIG: LspServerConfig = {
  languageId: 'python',
  command: 'pyright-langserver',
  args: ['--stdio'],
  rootPatterns: ['pyproject.toml', 'requirements.txt', 'setup.py'],
  fileExtensions: ['.py'],
};

export const DEFAULT_LSP_SERVER_CONFIGS: LspServerConfig[] = [
  TYPESCRIPT_SERVER_CONFIG,
  PYTHON_SERVER_CONFIG,
];

const EXTENSION_TO_LANGUAGE = new Map<string, string>([
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.js', 'typescript'],
  ['.jsx', 'typescript'],
  ['.mjs', 'typescript'],
  ['.cjs', 'typescript'],
  ['.py', 'python'],
  ['.rs', 'rust'],
  ['.go', 'go'],
]);

export function getServerConfig(languageId: string, configs = DEFAULT_LSP_SERVER_CONFIGS): LspServerConfig | null {
  return configs.find((config) => config.languageId === languageId) ?? null;
}

export function detectLanguageId(filePath: string): string | null {
  const extension = extname(filePath).toLowerCase();
  return EXTENSION_TO_LANGUAGE.get(extension) ?? null;
}

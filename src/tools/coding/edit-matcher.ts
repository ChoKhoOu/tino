export interface MatchResult {
  index: number;
  length: number;
  level: 'exact' | 'whitespace' | 'indent';
}

export function findMatches(content: string, oldString: string): MatchResult[] {
  const exactMatches = findExactMatches(content, oldString);
  if (exactMatches.length > 0) return exactMatches;

  const wsMatches = findWhitespaceNormalizedMatches(content, oldString);
  if (wsMatches.length > 0) return wsMatches;

  return findIndentFlexibleMatches(content, oldString);
}

function findExactMatches(content: string, oldString: string): MatchResult[] {
  const results: MatchResult[] = [];
  let pos = 0;
  while (true) {
    const idx = content.indexOf(oldString, pos);
    if (idx === -1) break;
    results.push({ index: idx, length: oldString.length, level: 'exact' });
    pos = idx + 1;
  }
  return results;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function findWhitespaceNormalizedMatches(content: string, oldString: string): MatchResult[] {
  const normContent = normalizeWhitespace(content);
  const normOld = normalizeWhitespace(oldString);

  if (normOld === oldString && normContent === content) return [];

  const contentLines = content.replace(/\r\n/g, '\n').split('\n');
  const normContentLines = contentLines.map((l) => l.trimEnd());
  const normOldLines = normOld.split('\n');

  const results: MatchResult[] = [];

  for (let i = 0; i <= normContentLines.length - normOldLines.length; i++) {
    const candidate = normContentLines.slice(i, i + normOldLines.length).join('\n');
    if (candidate === normOld) {
      const startIdx = contentLines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      const matchedText = contentLines.slice(i, i + normOldLines.length).join('\n');
      results.push({ index: startIdx, length: matchedText.length, level: 'whitespace' });
    }
  }

  if (results.length > 0) return results;

  return findCharBasedWsMatches(content, normContent, normOld);
}

function findCharBasedWsMatches(
  content: string,
  normContent: string,
  normOld: string,
): MatchResult[] {
  const results: MatchResult[] = [];
  const charMap = buildCharMap(content, normContent);
  let pos = 0;
  while (true) {
    const idx = normContent.indexOf(normOld, pos);
    if (idx === -1) break;
    const origStart = charMap[idx];
    const origEnd = charMap[idx + normOld.length - 1] + 1;
    results.push({ index: origStart, length: origEnd - origStart, level: 'whitespace' });
    pos = idx + 1;
  }
  return results;
}

function buildCharMap(original: string, normalized: string): number[] {
  const map: number[] = new Array(normalized.length);
  let oi = 0;
  let ni = 0;
  const orig = original.replace(/\r\n/g, '\n');

  while (ni < normalized.length && oi < orig.length) {
    if (normalized[ni] === orig[oi]) {
      map[ni] = oi;
      ni++;
      oi++;
    } else {
      oi++;
    }
  }
  return map;
}

function stripIndent(line: string): { indent: string; rest: string } {
  const match = line.match(/^([\t ]*)(.*)/);
  return { indent: match![1], rest: match![2] };
}

function findIndentFlexibleMatches(content: string, oldString: string): MatchResult[] {
  const oldLines = oldString.replace(/\r\n/g, '\n').split('\n');
  if (oldLines.length === 0) return [];

  const contentLines = content.replace(/\r\n/g, '\n').split('\n');
  const oldStripped = oldLines.map((l) => stripIndent(l));

  const results: MatchResult[] = [];

  for (let i = 0; i <= contentLines.length - oldLines.length; i++) {
    if (matchesFlexibly(contentLines, i, oldStripped)) {
      const startIdx = contentLines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      const matchedText = contentLines.slice(i, i + oldLines.length).join('\n');
      results.push({ index: startIdx, length: matchedText.length, level: 'indent' });
    }
  }

  return results;
}

function matchesFlexibly(
  contentLines: string[],
  startLine: number,
  oldStripped: { indent: string; rest: string }[],
): boolean {
  for (let j = 0; j < oldStripped.length; j++) {
    const contentStripped = stripIndent(contentLines[startLine + j]);
    if (contentStripped.rest.trimEnd() !== oldStripped[j].rest.trimEnd()) {
      return false;
    }
  }
  return true;
}

export function applyReplacement(
  content: string,
  match: MatchResult,
  newString: string,
): string {
  return content.substring(0, match.index) + newString + content.substring(match.index + match.length);
}

export function applyAllReplacements(content: string, oldString: string, newString: string): { result: string; count: number } {
  let result = content;
  let count = 0;
  while (result.includes(oldString)) {
    result = result.replace(oldString, newString);
    count++;
  }
  if (count > 0) return { result, count };

  const matches = findMatches(result, oldString);
  if (matches.length === 0) return { result, count: 0 };

  for (let i = matches.length - 1; i >= 0; i--) {
    result = applyReplacement(result, matches[i], newString);
    count++;
  }
  return { result, count };
}

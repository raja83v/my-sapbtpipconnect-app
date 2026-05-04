/**
 * Shared JSON cleaning utility for AI agent responses.
 *
 * AI models (especially Gemini) often return JSON with issues:
 * - Markdown code blocks wrapping
 * - Leading prose before the JSON
 * - Trailing content after the JSON
 * - Unescaped quotes in string values (especially Groovy code)
 * - Literal newlines inside strings
 * - Trailing commas, // comments
 * - Control characters
 *
 * This cleaner handles all of these cases.
 */

/**
 * Clean raw AI text to extract valid JSON.
 * This is a battle-tested 10-step cleaning pipeline.
 */
export function cleanAIJson(rawText: string): string {
  let json = rawText.trim();

  // 1: Extract from markdown code blocks
  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    json = codeBlockMatch[1].trim();
  }

  // 2: Find the JSON start if there's leading prose
  if (!json.startsWith('{') && !json.startsWith('[')) {
    const jsonStart = json.search(/[{[]/);
    if (jsonStart !== -1) {
      json = json.substring(jsonStart);
    }
  }

  // 3: Find the balanced end of the root JSON object/array
  {
    let depth = 0;
    let inString = false;
    let escapeNext = false;
    let jsonEndIndex = -1;

    for (let i = 0; i < json.length; i++) {
      const ch = json[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === '\\' && inString) { escapeNext = true; continue; }
      if (ch === '"' && !escapeNext) { inString = !inString; continue; }
      if (!inString) {
        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') {
          depth--;
          if (depth === 0) { jsonEndIndex = i; break; }
        }
      }
    }

    if (jsonEndIndex !== -1 && jsonEndIndex < json.length - 1) {
      json = json.substring(0, jsonEndIndex + 1);
    }
  }

  // 4: Fix broken URLs that span multiple lines
  json = json.replace(/"(https?:)\s*\n\s*(\/\/[^"]+)"/g, '"$1$2"');

  // 5: Replace literal newlines inside string values
  json = json.replace(/"([^"]*?)"/g, (_match, content: string) => {
    const cleaned = content
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
    return `"${cleaned}"`;
  });

  // 6: Remove control characters
  json = json.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 7: Fix trailing commas and multiple commas
  json = json.replace(/,(\s*[}\]])/g, '$1');
  json = json.replace(/,(\s*,)+/g, ',');

  // 8: Remove // comments outside strings
  const lines = json.split('\n');
  const cleanedLines = lines.map((line) => {
    let inStr = false;
    let esc = false;
    for (let i = 0; i < line.length - 1; i++) {
      const c = line[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (!inStr && c === '/' && line[i + 1] === '/') {
        return line.substring(0, i).trimEnd();
      }
    }
    return line;
  });
  json = cleanedLines.join('\n');

  // 9: Fix Groovy code patterns inside scriptContent that break JSON
  json = json.replace(
    /(contains|containsKey|containsValue|get|put|equals|startsWith|endsWith|matches|split|indexOf|replace|replaceFirst|append|concat|find|findAll|collect|join|format|substring|charAt|valueOf|compareTo)\s*\(\s*"([^"\\]*)"\s*\)/g,
    (_m, method: string, arg: string) => `${method}(\\"${arg}\\")`
  );
  json = json.replace(
    /(getProperty|setProperty|getHeader|setHeader|getBody|setBody)\s*\(\s*"([^"\\]*)"\s*\)/g,
    (_m, method: string, arg: string) => `${method}(\\"${arg}\\")`
  );
  json = json.replace(
    /(println|log\.info|log\.debug|log\.error|log\.warn)\s+"([^"\\]*)"/g,
    (_m, method: string, arg: string) => `${method} \\"${arg}\\"`
  );
  json = json.replace(/==\s*"([^"\\]*)"/g, '== \\"$1\\"');
  json = json.replace(/!=\s*"([^"\\]*)"/g, '!= \\"$1\\"');

  // 9b: General catch-all — escape unescaped quotes in any method("arg") pattern
  // This catches method calls not listed above (safe: only matches unescaped quotes after '(')
  json = json.replace(
    /(\w+)\s*\(\s*"([^"\\]{1,100})"\s*\)/g,
    (_m, method: string, arg: string) => `${method}(\\"${arg}\\")`
  );

  // 10: Fix scriptContent with .append('\"') patterns
  json = json.replace(/"scriptContent"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (_match, content: string) => {
    if (content.includes('Script content removed') || content.length < 50) return _match;
    const fixed = content
      .replace(/\\'\\\\*\\"/g, '\\\\"')
      .replace(/\\\\{3,}/g, '\\\\')
      .replace(/replaceAll\s*\(\s*'\\\\/g, 'replaceAll("\\\\')
      .replace(/'\s*,\s*'\\\\/g, '", "\\\\')
      .replace(/\\\\'\s*\)/g, '")')
      .replace(/\(\s*'([^'\\]*)'\s*\)/g, '("$1")');
    return `"scriptContent": "${fixed}"`;
  });

  // 11: Final safety net — escape any remaining unescaped quotes inside JSON
  // string values (e.g. Groovy literals like `props.get("RETRY_COUNT")` that
  // the regexes above missed because too many similar patterns share a line).
  // The state machine is parse-state aware so it cannot break already-valid
  // structural quotes.
  try {
    const candidate = fixUnescapedQuotesStateMachine(json);
    // Only adopt it if it parses; otherwise the original output goes through
    // to the agent-level repair pipeline.
    JSON.parse(candidate);
    json = candidate;
  } catch {
    // leave json as-is; downstream repair will handle it
  }

  return json;
}

/**
 * Walk JSON char-by-char and escape unescaped double quotes inside string values.
 * Uses lookahead to determine if a quote is structural (followed by : , } ]) or embedded.
 *
 * Key improvement: tracks whether we're in a key or value position.
 * In JSON, keys are followed by ':', but values are NEVER followed by ':'.
 * So '"' followed by ':' inside a value must be an embedded quote, not end-of-string.
 * This correctly handles Groovy patterns like contains(":") inside scriptContent.
 */
export function fixUnescapedQuotesStateMachine(json: string): string {
  const result: string[] = [];
  let inString = false;
  let escapeNext = false;
  // Stack tracks context: 'object' or 'array' at each nesting level
  const contextStack: ('object' | 'array')[] = [];
  // Whether the next string opened is in key position (only true in objects after { or ,)
  let expectKey = false;
  // Whether the currently-open string is a key
  let currentStringIsKey = false;

  for (let i = 0; i < json.length; i++) {
    const ch = json[i];

    if (escapeNext) {
      result.push(ch);
      escapeNext = false;
      continue;
    }

    if (ch === '\\' && inString) {
      result.push(ch);
      escapeNext = true;
      continue;
    }

    if (ch === '"') {
      if (!inString) {
        inString = true;
        currentStringIsKey = expectKey;
        result.push(ch);
      } else {
        // Is this the end of the string or an embedded quote?
        const nextNonWs = json.substring(i + 1).match(/^\s*(.)/);
        const nextChar = nextNonWs ? nextNonWs[1] : '';

        // In key position: ':' IS structural (key is followed by ':')
        // In value position: ':' is NOT structural (values are followed by ',' or '}' or ']')
        const isStructural = currentStringIsKey
          ? [',', ':', '}', ']', ''].includes(nextChar)
          : [',', '}', ']', ''].includes(nextChar);

        if (isStructural) {
          inString = false;
          result.push(ch);
          // After a key string closes with ':', next string is a value
          if (nextChar === ':') expectKey = false;
        } else {
          result.push('\\', '"');
        }
      }
    } else {
      if (!inString) {
        if (ch === '{') {
          contextStack.push('object');
          expectKey = true;
        } else if (ch === '[') {
          contextStack.push('array');
          expectKey = false;
        } else if (ch === '}' || ch === ']') {
          contextStack.pop();
          expectKey = false;
        } else if (ch === ',') {
          const ctx = contextStack[contextStack.length - 1];
          expectKey = ctx === 'object'; // In objects after ',', next is a key
        } else if (ch === ':') {
          expectKey = false; // After ':', next is a value
        }
      }
      result.push(ch);
    }
  }

  return result.join('');
}

/**
 * Try to fix JSON at a specific error position.
 * Returns modified JSON if a fix was applied, or the original if no fix possible.
 */
export function tryFixAtPosition(json: string, pos: number): string {
  if (pos <= 0 || pos >= json.length) return json;

  const ch = json[pos];
  const prev = json[pos - 1];

  // Case 1: Unescaped quote inside a string → escape it
  if (prev === '"' || ch === '"') {
    if (ch !== ':' && ch !== ',' && ch !== '}' && ch !== ']') {
      if (prev === '"') {
        return json.slice(0, pos - 1) + '\\"' + json.slice(pos);
      }
    }
  }

  // Case 2: Extra comma
  if (ch === ',' && (prev === ',' || prev === '{' || prev === '[')) {
    return json.slice(0, pos) + json.slice(pos + 1);
  }

  // Case 3: Missing comma between values (e.g. "value1" "key2")
  if (ch === '"' && prev === '"') {
    return json.slice(0, pos) + ',' + json.slice(pos);
  }

  // Case 4: Stray character — try removing it
  if (!/[{}[\]",:0-9a-zA-Z_\-.\s\\]/.test(ch)) {
    return json.slice(0, pos) + json.slice(pos + 1);
  }

  return json;
}

/**
 * Minimal extractor: strip markdown fences, leading/trailing prose, and
 * trim to the balanced root object/array. Performs NO regex transforms on
 * string contents — preserves the model's original escaping.
 */
export function extractRootJson(rawText: string): string {
  let json = rawText.trim();

  const codeBlockMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) json = codeBlockMatch[1].trim();

  if (!json.startsWith('{') && !json.startsWith('[')) {
    const start = json.search(/[{[]/);
    if (start !== -1) json = json.substring(start);
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let endIdx = -1;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\' && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
  }
  if (endIdx !== -1) json = json.substring(0, endIdx + 1);
  return json;
}

/**
 * Robust deterministic parse cascade for AI JSON output.
 *
 * Order (each step short-circuits on success):
 *   1. Extract root + parse                          (preserves valid output)
 *   2. State-machine quote fixer + parse             (deterministic recovery)
 *   3. cleanAIJson full pipeline + parse             (legacy aggressive cleaner)
 *   4. cleanAIJson + state-machine fixer + parse     (last resort)
 *
 * Throws an Error with `attempts` array containing each step's failure for diagnostics.
 */
export function parseAIJson<T = unknown>(rawText: string): T {
  const attempts: { step: string; error: string }[] = [];
  const root = extractRootJson(rawText);

  const tries: Array<{ step: string; produce: () => string }> = [
    { step: 'raw-extract', produce: () => root },
    { step: 'state-machine', produce: () => fixUnescapedQuotesStateMachine(root) },
    { step: 'clean-pipeline', produce: () => cleanAIJson(rawText) },
    { step: 'clean+state-machine', produce: () => fixUnescapedQuotesStateMachine(cleanAIJson(rawText)) },
  ];

  for (const t of tries) {
    let candidate = '';
    try {
      candidate = t.produce();
      return JSON.parse(candidate) as T;
    } catch (err) {
      attempts.push({ step: t.step, error: (err as Error).message });
    }
  }

  const detail = attempts.map((a) => `  - ${a.step}: ${a.error}`).join('\n');
  const preview = root.slice(0, 800);
  const err = new Error(
    `parseAIJson failed after ${attempts.length} strategies:\n${detail}\n---\nPreview:\n${preview}`,
  );
  (err as Error & { attempts: typeof attempts }).attempts = attempts;
  throw err;
}

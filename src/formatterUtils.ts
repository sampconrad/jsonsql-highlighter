import { format } from 'sql-formatter';

/**
 * Replaces template variables (e.g. {var}#1 or <var>) with placeholders so that sql-formatter can parse the query.
 */
export function preprocessSQL(sql: string): { processedSQL: string; placeholders: string[] } {
  const placeholders: string[] = [];
  let processed = sql;

  /**
   * Helper to swap any pattern with a placeholder token storing original text.
   */
  const swapWithPlaceholder = (pattern: RegExp) => {
    processed = processed.replace(pattern, (match) => {
      const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
      placeholders.push(match);
      return placeholder;
    });
  };

  // 1. Preserve single-quoted string literals (including escaped quotes)
  //    Example: 'Bob''s car'  or  'some "quoted" text'
  //    Regex:   '(?:''|[^'])*'
  swapWithPlaceholder(/'(?:''|[^'])*'/g);

  // 2. Preserve template variables like {var} or <var>
  [ /\{[^}]+\}(?:#\d+)?/g, /<[^>]+>(?:#\d+)?/g ].forEach(swapWithPlaceholder);

  return { processedSQL: processed, placeholders };
}

/**
 * Restores template variables back into the formatted SQL replacing placeholder tokens.
 */
export function postprocessSQL(formattedSQL: string, placeholders: string[]): string {
  let result = formattedSQL;
  placeholders.forEach((original, index) => {
    const patterns = [new RegExp(`__PLACEHOLDER_${index}__`, 'g'), new RegExp(`__TEMPLATE_VAR_${index}__`, 'g')];
    patterns.forEach((ph) => {
      result = result.replace(ph, original);
    });
  });
  return result;
}

/**
 * Attempts to format SQL while preserving template variables.
 */
export function safeFormat(sql: string): string {
  try {
    const { processedSQL, placeholders } = preprocessSQL(sql);
    const formatted = format(processedSQL, {
      language: 'sqlite',
      tabWidth: 2,
      useTabs: false,
      keywordCase: 'upper',
      functionCase: 'upper',
      dataTypeCase: 'upper',
    });
    return postprocessSQL(formatted, placeholders);
  } catch {
    return sql; // fallback to original
  }
}

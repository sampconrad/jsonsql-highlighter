import { format } from 'sql-formatter';

/**
 * Replaces template variables (e.g. {var}#1 or <var>) with placeholders so that sql-formatter can parse the query.
 */
export function preprocessSQL(sql: string): { processedSQL: string; placeholders: string[] } {
  const placeholders: string[] = [];
  const patterns = [/\{[^}]+\}(?:#\d+)?/g, /<[^>]+>(?:#\d+)?/g];
  let processed = sql;

  patterns.forEach((pattern) => {
    processed = processed.replace(pattern, (match) => {
      const placeholder = `__TEMPLATE_VAR_${placeholders.length}__`;
      placeholders.push(match);
      return placeholder;
    });
  });

  return { processedSQL: processed, placeholders };
}

/**
 * Restores template variables back into the formatted SQL replacing placeholder tokens.
 */
export function postprocessSQL(formattedSQL: string, placeholders: string[]): string {
  let result = formattedSQL;
  placeholders.forEach((original, index) => {
    const placeholder = new RegExp(`__TEMPLATE_VAR_${index}__`, 'g');
    result = result.replace(placeholder, original);
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
      language: 'sql',
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

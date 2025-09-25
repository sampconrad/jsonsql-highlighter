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

  // 2. Preserve double-quoted string literals
  swapWithPlaceholder(/"(?:[^"\\]|\\.)*"/g);

  // 3. Preserve template variables like {var} or <var>
  // Handle various template variable patterns
  [
    /\{[^}]+\}(?:#\d+)?/g,           // {var}#1
    /<[^>]+>(?:#\d+)?/g,             // <var>#1
    /\{[^}]+\}/g,                    // {var}
    /<[^>]+>/g,                      // <var>
    /\{[^}]+\}#\d+/g,                // {var}#123
    /<[^>]+>#\d+/g                   // <var>#123
  ].forEach(swapWithPlaceholder);

  // 4. Preserve SQLite-specific syntax that might cause issues
  //    - Backtick identifiers
  swapWithPlaceholder(/`[^`]+`/g);
  
  //    - Square bracket identifiers
  swapWithPlaceholder(/\[[^\]]+\]/g);

  // 5. Handle newlines and whitespace issues that break SQL parsing
  //    First, replace literal \n with actual newlines
  processed = processed.replace(/\\n/g, '\n');
  
  // 6. Handle problematic newlines in string concatenations
  //    Replace newlines that appear in string concatenation contexts
  processed = processed.replace(/'([^']*)\n([^']*)'/g, "'$1 $2'");
  processed = processed.replace(/"([^"]*)\n([^"]*)"/g, '"$1 $2"');
  
  // 6b. Handle newlines in the middle of concatenation chains
  //    This handles cases like: 'text' \n || 'more text'
  processed = processed.replace(/'([^']*)'\s*\n\s*\|\|/g, "'$1' ||");
  processed = processed.replace(/"([^"]*)"\s*\n\s*\|\|/g, '"$1" ||');
  
  // 7. Normalize whitespace - replace multiple consecutive spaces/tabs with single space
  processed = processed.replace(/[ \t]+/g, ' ');
  
  // 8. Clean up any remaining problematic whitespace around operators
  processed = processed.replace(/\s*\|\|\s*/g, ' || ');
  processed = processed.replace(/\s*\+\s*/g, ' + ');
  
  // 9. Handle complex nested CASE statements that can break the parser
  //    Add spaces around complex expressions to help the parser
  processed = processed.replace(/CASE\s+WHEN\s+\(/g, 'CASE WHEN (');
  processed = processed.replace(/\)\s+<=/g, ') <=');
  processed = processed.replace(/\)\s+THEN/g, ') THEN');
  processed = processed.replace(/\)\s+ELSE/g, ') ELSE');
  processed = processed.replace(/\)\s+END/g, ') END');
  
  // 10. Handle function calls with complex parameters
  processed = processed.replace(/substr\s*\(\s*\(/g, 'substr((');
  processed = processed.replace(/length\s*\(\s*\(/g, 'length((');

  return { processedSQL: processed, placeholders };
}

/**
 * Restores template variables back into the formatted SQL replacing placeholder tokens.
 */
export function postprocessSQL(formattedSQL: string, placeholders: string[]): string {
  let result = formattedSQL;
  
  // Restore placeholders in reverse order to avoid conflicts
  for (let i = placeholders.length - 1; i >= 0; i--) {
    const original = placeholders[i];
    const placeholder = `__PLACEHOLDER_${i}__`;
    
    // Replace the placeholder with the original text
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), original);
  }
  
  return result;
}

/**
 * Manual formatting fallback for when the SQL formatter fails completely.
 * This provides basic formatting without complex parsing.
 */
function manualFormat(sql: string): string {
  let formatted = sql.trim();
  
  // Basic keyword formatting
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'ON', 'GROUP BY', 'ORDER BY',
    'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION',
    'IF', 'EXISTS', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'AS', 'DISTINCT'
  ];
  
  // Add line breaks after major keywords
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, keyword.toUpperCase());
  });
  
  // Add line breaks after SELECT, FROM, WHERE, etc.
  formatted = formatted.replace(/\bSELECT\b/gi, '\nSELECT');
  formatted = formatted.replace(/\bFROM\b/gi, '\nFROM');
  formatted = formatted.replace(/\bWHERE\b/gi, '\nWHERE');
  formatted = formatted.replace(/\bGROUP BY\b/gi, '\nGROUP BY');
  formatted = formatted.replace(/\bORDER BY\b/gi, '\nORDER BY');
  formatted = formatted.replace(/\bHAVING\b/gi, '\nHAVING');
  formatted = formatted.replace(/\bLIMIT\b/gi, '\nLIMIT');
  
  // Add line breaks after commas in SELECT clauses
  formatted = formatted.replace(/,\s*/g, ',\n  ');
  
  // Add indentation
  const lines = formatted.split('\n');
  let indentLevel = 0;
  const indentedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    
    // Decrease indent for closing keywords
    if (trimmed.match(/^\b(END|ELSE|THEN)\b/i)) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    const indented = '  '.repeat(indentLevel) + trimmed;
    
    // Increase indent for opening keywords
    if (trimmed.match(/^\b(CASE|WHEN|IF|SELECT|FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT)\b/i)) {
      indentLevel++;
    }
    
    return indented;
  });
  
  return indentedLines.join('\n').trim();
}

/**
 * Attempts to format SQL while preserving template variables.
 */
export function safeFormat(sql: string): string {
  try {
    // Clean up the SQL first
    let cleanedSQL = sql.trim();
    
    const { processedSQL, placeholders } = preprocessSQL(cleanedSQL);
    
    // Try different formatter configurations
    const formatterOptions = [
      {
        language: 'sqlite' as const,
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'upper' as const,
        functionCase: 'upper' as const,
        dataTypeCase: 'upper' as const,
      },
      {
        language: 'sql' as const,
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'upper' as const,
        functionCase: 'upper' as const,
        dataTypeCase: 'upper' as const,
      },
      {
        language: 'sqlite' as const,
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'preserve' as const,
        functionCase: 'preserve' as const,
        dataTypeCase: 'preserve' as const,
      }
    ];
    
    let formatted: string;
    let lastError: Error | null = null;
    
    // Try each configuration until one works
    for (const options of formatterOptions) {
      try {
        formatted = format(processedSQL, options);
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown formatting error');
        continue;
      }
    }
    
    if (!formatted!) {
      throw lastError || new Error('All formatter configurations failed');
    }
    
    const result = postprocessSQL(formatted, placeholders);
    
    return result;
    
  } catch (error) {
    console.error('SQL formatting error:', error);
    
    // Try a fallback approach - basic formatting without complex features
    try {
      const basicFormatted = format(sql, {
        language: 'sqlite',
        tabWidth: 2,
        useTabs: false,
        keywordCase: 'preserve',
        functionCase: 'preserve',
        dataTypeCase: 'preserve',
      });
      return basicFormatted;
    } catch (fallbackError) {
      console.error('Fallback formatting also failed:', fallbackError);
      
      // Try an even more basic approach - just clean up the SQL manually
      try {
        return manualFormat(sql);
      } catch (manualError) {
        console.error('Manual formatting also failed:', manualError);
        // Return original SQL with a comment indicating formatting failed
        return `-- SQL formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}\n${sql}`;
      }
    }
  }
}

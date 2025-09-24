import * as vscode from 'vscode';

/**
 * First determines whether a given document should be processed for SQL detection.
 */
export function shouldProcessFile(document: vscode.TextDocument): boolean {
  return (
    document.languageId === 'json' &&
    document.fileName.endsWith('.json') &&
    !document.fileName.includes('package.json') &&
    !document.fileName.includes('package-lock.json') &&
    !document.fileName.includes('tsconfig.json') &&
    !document.fileName.includes('.vscode') &&
    !document.fileName.includes('node_modules')
  );
}

/**
 * Then checks whether the provided JSON string contains embedded SQL.
 */
export function hasSqlContent(content: string): boolean {
  const sqlKeywords = [
    'SELECT',
    'FROM',
    'WHERE',
    'INSERT',
    'UPDATE',
    'DELETE',
    'CREATE',
    'DROP',
    'ALTER',
    'JOIN',
    'INNER JOIN',
    'LEFT JOIN',
    'RIGHT JOIN',
    'OUTER JOIN',
    'GROUP BY',
    'ORDER BY',
    'HAVING',
    'UNION',
    'DISTINCT',
    'COUNT',
    'SUM',
    'AVG',
    'MAX',
    'MIN',
    'CASE',
    'WHEN',
    'UPPER',
    'LOWER',
    'GLOB',
    'LIKE',
    'IN',
    'BETWEEN',
    'SUBSTR',
    'IFNULL',
    'COALESCE',
    'CAST',
    'CONVERT',
    'IS NULL',
    'IS NOT NULL',
    'AND',
    'OR',
    'NOT',
    'EXISTS',
  ];

  const quotedStringPattern = /"([^"\\]*(?:\\.[^"\\]*)*)"(?=\s*[},\]])/g; // matches JSON strings
  const quotedStrings = content.match(quotedStringPattern);
  if (!quotedStrings) {
    return false;
  }

  let totalSqlKeywords = 0;
  for (const quotedString of quotedStrings) {
    const stringContent = quotedString.slice(1, -1); // strip quotes

    // skip obviously non-SQL strings.
    if (stringContent.length < 10 || /description|metadata|purpose|type/i.test(stringContent)) {
      continue;
    }

    const sqlPattern = new RegExp(
      `\\b(${sqlKeywords.map((k) => k.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|')})\\b`,
      'g'
    );

    const matches = stringContent.match(sqlPattern);
    if (matches) {
      totalSqlKeywords += matches.length;
    }
  }

  return totalSqlKeywords >= 3;
}

/**
 * Inspects the provided document and switches its language mode to `sql-in-json` if embedded SQL is detected.
 */
export function processDocument(document: vscode.TextDocument): void {
  if (!shouldProcessFile(document)) return;

  const content = document.getText();
  if (hasSqlContent(content)) {
    vscode.languages.setTextDocumentLanguage(document, 'sql-in-json');
  }
}

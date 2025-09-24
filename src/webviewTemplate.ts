import * as vscode from 'vscode';

/**
 * Returns the full HTML for the SQL formatter webview panel.
 * NOTE: This was migrated verbatim from extension.ts – do not modify content without reason.
 */
export function getWebviewContent(sqlContent: string, iconUri: vscode.Uri): string {
  return `
  <!DOCTYPE html>
    <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>SQL Highlighter For JSON - Editor</title>
          <style>
              html, body {
                  height: 100%;
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
              }
              
              body {
                  font-family: var(--vscode-font-family);
                  font-size: var(--vscode-font-size);
                  color: var(--vscode-foreground);
                  background-color: var(--vscode-editor-background);
                  display: flex;
                  flex-direction: column;
              }
              
              .container {
                  display: flex;
                  flex-direction: column;
                  height: 100vh;
                  max-height: 100vh;
                  overflow: hidden;
              }
              
              .header {
                  flex-shrink: 0;
                  padding: 20px 20px 10px 20px;
              }
              
              .header h2 {
                  margin: 0 0 10px 0;
                  color: var(--vscode-foreground);
                  display: flex;
                  align-items: center;
                  gap: 12px;
                  font-size: 1.5em;
                  font-weight: 600;
              }
              
              .header-icon {
                  width: 24px;
                  height: 24px;
                  flex-shrink: 0;
              }
              
              .header p {
                  margin: 0;
                  color: var(--vscode-descriptionForeground);
                  font-size: 14px;
              }
              
              .editor-container {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  padding: 0 20px;
                  min-height: 0;
                  overflow: hidden;
              }
              
              .editor-label {
                  flex-shrink: 0;
                  margin-bottom: 8px;
                  font-weight: 600;
                  color: var(--vscode-foreground);
              }
              
              #sqlEditor {
                  flex: 1;
                  width: 100%;
                  border: 1px solid var(--vscode-input-border);
                  border-radius: 4px;
                  box-sizing: border-box;
                  min-height: 0;
                  overflow: hidden;
              }
              
              .footer {
                  flex-shrink: 0;
                  padding: 20px;
              }
              
              .button-container {
                  display: flex;
                  gap: 12px;
                  justify-content: flex-end;
              }
              
              .btn {
                  padding: 8px 16px;
                  border: none;
                  border-radius: 4px;
                  font-size: 14px;
                  font-weight: 600;
                  cursor: pointer;
                  transition: background-color 0.2s;
              }
              
              .btn-primary {
                  background-color: var(--vscode-button-background);
                  color: var(--vscode-button-foreground);
              }
              
              .btn-primary:hover {
                  background-color: var(--vscode-button-hoverBackground);
              }
              
              .btn-secondary {
                  background-color: var(--vscode-button-secondaryBackground);
                  color: var(--vscode-button-secondaryForeground);
              }
              
              .btn-secondary:hover {
                  background-color: var(--vscode-button-secondaryHoverBackground);
              }
              
              .info-text {
                  padding: 8px 12px;
                  background-color: var(--vscode-textBlockQuote-background);
                  border-left: 4px solid var(--vscode-textBlockQuote-border);
                  color: var(--vscode-foreground);
                  font-size: 13px;
                  border-radius: 4px;
                  margin-bottom: 12px;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h2>
                      <img src="${iconUri}" alt="SQL Highlighter For JSON Icon" class="header-icon" />
                      SQL Highlighter For JSON - Editor
                  </h2>
                  <p>Edit your SQL query below. The formatted version will be saved as a single-line string.</p>
              </div>
              
              <div class="editor-container">
                  <div class="editor-label">SQL Query:</div>
                  <div id="sqlEditor"></div>
              </div>
              
              <div class="footer">
                  <div class="info-text">
                      <strong>Note:</strong> When saving, the SQL will be converted to a single-line string suitable for JSON. 
                      All unnecessary whitespace and line breaks will be removed.
                      If it fails to format, the original SQL will be restored.
                  </div>
                  
                  <div class="button-container">
                      <button class="btn btn-secondary" onclick="cancel()">Cancel</button>
                      <button class="btn btn-primary" onclick="save()">Save</button>
                  </div>
              </div>
          </div>

          <script src="https://unpkg.com/monaco-editor@0.44.0/min/vs/loader.js"></script>
          <script>
              const vscode = acquireVsCodeApi();
              let editor;
              
              require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.44.0/min/vs' } });
              
              require(['vs/editor/editor.main'], function () {
                  // register SQL language with autocomplete
                  monaco.languages.register({ id: 'sql' });
                  
                  // SQL keywords and functions for autocomplete
                  const sqlKeywords = [
                      'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
                      'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'OUTER JOIN', 'FULL OUTER JOIN',
                      'GROUP BY', 'ORDER BY', 'HAVING', 'UNION', 'UNION ALL', 'DISTINCT', 'COUNT', 'SUM',
                      'PRAGMA', 'WITHOUT', 'ROWID', 'REPLACE', 'INSERT OR REPLACE', 'UPSERT', 'ON CONFLICT',
                      'AVG', 'MAX', 'MIN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'AS', 'ON', 'IN',
                      'NOT IN', 'BETWEEN', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL', 'AND', 'OR',
                      'NOT', 'EXISTS', 'NOT EXISTS', 'INTO', 'VALUES', 'SET', 'TABLE', 'INDEX', 'VIEW',
                      'PROCEDURE', 'FUNCTION', 'TRIGGER', 'DATABASE', 'SCHEMA', 'CONSTRAINT', 'PRIMARY KEY',
                      'FOREIGN KEY', 'UNIQUE', 'CHECK', 'DEFAULT', 'NULL', 'NOT NULL', 'AUTO_INCREMENT',
                      'IDENTITY', 'SEQUENCE', 'TRANSACTION', 'COMMIT', 'ROLLBACK', 'BEGIN', 'END'
                  ];
                  
                  const sqlFunctions = [
                      'UPPER', 'LOWER', 'LENGTH', 'SUBSTR', 'SUBSTRING', 'TRIM', 'LTRIM', 'RTRIM',
                      'REPLACE', 'CONCAT', 'CAST', 'CONVERT', 'ISNULL', 'IFNULL', 'COALESCE', 'NULLIF',
                      'ROUND', 'FLOOR', 'CEIL', 'ABS', 'RANDOM', 'RAND', 'CURRENT_DATE', 'CURRENT_TIME',
                      'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME',
                  ];
                  
                  monaco.languages.registerCompletionItemProvider('sql', {
                      provideCompletionItems: function(model, position) {
                          const suggestions = [];
                          
                          sqlKeywords.forEach(keyword => {
                              suggestions.push({
                                  label: keyword,
                                  kind: monaco.languages.CompletionItemKind.Keyword,
                                  insertText: keyword,
                                  detail: 'SQL Keyword'
                              });
                          });
                          
                          sqlFunctions.forEach(func => {
                              suggestions.push({
                                  label: func,
                                  kind: monaco.languages.CompletionItemKind.Function,
                                  insertText: func + '()',
                                  insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                  detail: 'SQL Function'
                              });
                          });
                          
                          return { suggestions: suggestions };
                      }
                  });
                  
                  editor = monaco.editor.create(document.getElementById('sqlEditor'), {
                      value: \`${sqlContent.replace(/`/g, '\\`')}\`,
                      language: 'sql',
                      theme: 'vs-dark',
                      automaticLayout: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      fontSize: 14,
                      lineNumbers: 'on',
                      roundedSelection: false,
                      scrollbar: {
                          vertical: 'auto',
                          horizontal: 'auto',
                          verticalScrollbarSize: 12,
                          horizontalScrollbarSize: 12
                      },
                      folding: true,
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'line',
                      selectOnLineNumbers: true,
                      glyphMargin: false,
                      contextmenu: true,
                      mouseWheelZoom: true,
                      multiCursorModifier: 'ctrlCmd',
                      formatOnPaste: true,
                      formatOnType: true,
                      padding: {
                          top: 8,
                          bottom: 8
                      },
                      suggest: {
                          showKeywords: true,
                          showFunctions: true,
                          showSnippets: true
                      },
                      quickSuggestions: {
                          other: true,
                          comments: false,
                          strings: false
                      }
                  });
                  
                  const isDark = document.body.style.backgroundColor.includes('rgb(30, 30, 30)') || 
                                document.body.style.backgroundColor.includes('#1e1e1e') ||
                                window.matchMedia('(prefers-color-scheme: dark)').matches;
                  
                  if (isDark) {
                      monaco.editor.setTheme('vs-dark');
                  } else {
                      monaco.editor.setTheme('vs');
                  }
                  
                  window.addEventListener('resize', function() {
                      if (editor) {
                          editor.layout();
                      }
                  });
              });
              
              function save() {
                  if (editor) {
                      const sqlContent = editor.getValue();
                      vscode.postMessage({
                          command: 'save',
                          sql: sqlContent
                      });
                  }
              }
              
              function cancel() {
                  vscode.postMessage({
                      command: 'cancel'
                  });
              }
          </script>
      </body>
    </html>`;
}

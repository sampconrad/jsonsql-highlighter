import { format } from 'sql-formatter';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('SQL Highlighter extension is now active!');
    
    function processDocument(document: vscode.TextDocument) {
        if (shouldProcessFile(document)) {
            const content = document.getText();
            
            if (hasSqlContent(content)) {
                vscode.languages.setTextDocumentLanguage(document, 'sql-in-json');
            }
        }
    }
    
    // checking if content of the JSON contains SQL
    function hasSqlContent(content: string): boolean {
        const sqlKeywords = [
            'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER',
            'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'OUTER JOIN', 'GROUP BY', 'ORDER BY',
            'HAVING', 'UNION', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'CASE', 'WHEN',
            'UPPER', 'LOWER', 'GLOB', 'LIKE', 'IN', 'BETWEEN', 'SUBSTR', 'IFNULL', 'COALESCE',
            'CAST', 'CONVERT', 'IS NULL', 'IS NOT NULL', 'AND', 'OR', 'NOT', 'EXISTS'
        ];

        // looking for strings that contain SQL-like patterns (SELECT, FROM, WHERE.)
        const quotedStringPattern = /"([^"]*)"(?=\s*[,}\]])/g;
        const quotedStrings = content.match(quotedStringPattern);
        
        if (!quotedStrings) {
            return false;
        }
        
        // checking each quoted string for SQL keywords
        let totalSqlKeywords = 0;
        for (const quotedString of quotedStrings) {
            const stringContent = quotedString.slice(1, -1); // remove surrounding quotes
            
            // skipping popular strings that are clearly not SQL
            if (stringContent.length < 10 || 
                stringContent.includes('description') || 
                stringContent.includes('metadata') ||
                stringContent.includes('purpose') ||
                stringContent.includes('type')) {
                continue;
            }
            
            // looking for SQL keywords as whole words (case-sensitive, uppercase only)
            const sqlPattern = new RegExp(
                `\\b(${sqlKeywords.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
                'g'
            );
            
            const matches = stringContent.match(sqlPattern);
            if (matches) {
                totalSqlKeywords += matches.length;
            }
        }
        
        return totalSqlKeywords >= 3;
    }
    
    function shouldProcessFile(document: vscode.TextDocument): boolean {
        return document.languageId === 'json' && 
               document.fileName.endsWith('.json') &&
               !document.fileName.includes('package.json') &&
               !document.fileName.includes('package-lock.json') &&
               !document.fileName.includes('tsconfig.json') &&
               !document.fileName.includes('.vscode') &&
               !document.fileName.includes('node_modules');
    }
    
    vscode.workspace.textDocuments.forEach(processDocument);

    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument(processDocument);

    // handle when documents change content
    const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument((event) => {
        const document = event.document;
        if (shouldProcessFile(document) || document.languageId === 'sql-in-json') {
            const content = document.getText();
            
            if (hasSqlContent(content) && document.languageId === 'json') {
                vscode.languages.setTextDocumentLanguage(document, 'sql-in-json');
            } else if (!hasSqlContent(content) && document.languageId === 'sql-in-json') {
                // if it was previously SQL but no longer has SQL content, switch back to JSON
                vscode.languages.setTextDocumentLanguage(document, 'json');
            }
        }
    });

    const formatSQLCommand = vscode.commands.registerCommand('jsonsql-highlighter.formatSQL', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText.trim()) {
            vscode.window.showErrorMessage('No text selected.');
            return;
        }

        createSQLFormatterWebview(context, selectedText, editor, selection);
    });

    context.subscriptions.push(onDidOpenTextDocument, onDidChangeTextDocument, formatSQLCommand);
}

function createSQLFormatterWebview(context: vscode.ExtensionContext, selectedText: string, editor: vscode.TextEditor, selection: vscode.Selection) {
    // format the selected SQL text
    let formattedSQL: string;
    try {
        // pre-process the SQL to handle template variables
        const { processedSQL, placeholders } = preprocessSQL(selectedText);
        
        formattedSQL = format(processedSQL, {
            language: 'sql',
            tabWidth: 2,
            useTabs: false,
            keywordCase: 'upper',
            functionCase: 'upper',
            dataTypeCase: 'upper'
        });
        
        // post-process to restore template variables
        formattedSQL = postprocessSQL(formattedSQL, placeholders);
        
    } catch (error) {
        // if formatting fails, use the original text
        formattedSQL = selectedText;
        vscode.window.showWarningMessage('Could not format SQL, using original text.');
    }

    const panel = vscode.window.createWebviewPanel(
        'sqlFormatter',
        'SQL Highlighter for JSON - Formatter',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            retainContextWhenHidden: true
        }
    );

    const iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
    panel.iconPath = iconPath;

    const iconUri = panel.webview.asWebviewUri(iconPath);
    panel.webview.html = getWebviewContent(formattedSQL, iconUri);

    panel.webview.onDidReceiveMessage(
        async (message) => {
            switch (message.command) {
                case 'save':
                    // replace the selected text with the modified SQL
                    const modifiedSQL = message.sql;
                    // remove unnecessary spaces and line breaks for JSON string
                    const cleanedSQL = modifiedSQL.replace(/\s+/g, ' ').trim();
                    
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, cleanedSQL);
                    });
                    
                    panel.dispose();
                    vscode.window.showInformationMessage('SQL updated successfully!');
                    break;
                case 'cancel':
                    panel.dispose();
                    break;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getWebviewContent(sqlContent: string, iconUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SQL Highlighter for JSON - Formatter</title>
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
                <img src="${iconUri}" alt="SQL Highlighter Icon" class="header-icon" />
                SQL Highlighter for JSON - Formatter
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
                'CURRENT_TIMESTAMP', 'NOW', 'DATE', 'TIME', 'DATETIME', 'YEAR', 'MONTH', 'DAY',
                'HOUR', 'MINUTE', 'SECOND', 'EXTRACT', 'DATEADD', 'DATEDIFF', 'GETDATE', 'SYSDATE'
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

function preprocessSQL(sql: string): { processedSQL: string; placeholders: string[] } {
    // replace template variables with placeholder tokens that SQL formatter can handle
    // pattern: {variableName}#number or {variableName}
    const templateVariablePattern = /\{[^}]+\}(?:#\d+)?/g;
    const placeholders: string[] = [];
    
    const processedSQL = sql.replace(templateVariablePattern, (match) => {
        const placeholder = `__TEMPLATE_VAR_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
    });

    const angleBracketPattern = /<[^>]+>(?:#\d+)?/g;
    const processedSQL2 = processedSQL.replace(angleBracketPattern, (match) => {
        const placeholder = `__TEMPLATE_VAR_${placeholders.length}__`;
        placeholders.push(match);
        return placeholder;
    });
    
    return { processedSQL: processedSQL2, placeholders };
}

function postprocessSQL(formattedSQL: string, placeholders: string[]): string {
    // replace placeholder tokens back with original template variables
    let result = formattedSQL;
    placeholders.forEach((originalVar, index) => {
        const placeholder = `__TEMPLATE_VAR_${index}__`;
        result = result.replace(new RegExp(placeholder, 'g'), originalVar);
    });
    
    return result;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function deactivate() {
    console.log('SQL Highlighter extension is now deactivated');
}
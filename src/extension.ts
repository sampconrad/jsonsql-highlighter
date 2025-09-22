import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('SQL Highlighter extension is now active!');
    
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
    
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((document) => {
        if (shouldProcessFile(document)) {
            const content = document.getText();
            
            if (hasSqlContent(content)) {
                vscode.languages.setTextDocumentLanguage(document, 'sql-in-json');
            }
        }
    });

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

    context.subscriptions.push(onDidOpenTextDocument, onDidChangeTextDocument);
}

export function deactivate() {
    console.log('SQL Highlighter extension is now deactivated');
}
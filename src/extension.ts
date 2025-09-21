import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('SQL Highlighter extension is now active!');
    
    const onDidOpenTextDocument = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'json' && document.fileName.endsWith('.json')) {
            const content = document.getText();
            
            if (content.includes('SELECT') || content.includes('FROM') || content.includes('WHERE') || 
                content.includes('Upper') || content.includes('GLOB') || content.includes('substr') || 
                content.includes('IfNull') || content.includes('JOIN') || content.includes('GROUP BY')) {
                vscode.languages.setTextDocumentLanguage(document, 'sql-in-json');
            }
        }
    });

    context.subscriptions.push(onDidOpenTextDocument);
}

export function deactivate() {
    console.log('SQL Highlighter extension is now deactivated');
}
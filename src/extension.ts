import * as vscode from 'vscode';
import { safeFormat } from './formatterUtils';
import { SqlCodeLensProvider } from './sqlCodeLensProvider';
import { hasSqlContent, processDocument, shouldProcessFile } from './sqlDetector';
import { getWebviewContent } from './webviewTemplate';

export function activate(context: vscode.ExtensionContext) {
  console.log('SQL Highlighter For JSON extension is now active!');

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

  const formatSQLCommand = vscode.commands.registerCommand(
    'jsonsql-highlighter.formatSQL',
    async () => {
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
    }
  );

  const codeLensProvider = new SqlCodeLensProvider();
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    [{ language: 'json' }, { language: 'sql-in-json' }],
    codeLensProvider
  );

  // command executed when user clicks "Open in SQL Editor" lens
  const openSqlEditorCmd = vscode.commands.registerCommand(
    'jsonsql-highlighter.openSqlEditor',
    async (uri: vscode.Uri, range: vscode.Range) => {
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, {
        preview: false,
        viewColumn: vscode.ViewColumn.Active,
      });

      editor.selection = new vscode.Selection(range.start, range.end);
      await vscode.commands.executeCommand('jsonsql-highlighter.formatSQL');
    }
  );

  context.subscriptions.push(
    onDidOpenTextDocument,
    onDidChangeTextDocument,
    formatSQLCommand,
    codeLensDisposable,
    openSqlEditorCmd
  );
}

function createSQLFormatterWebview(
  context: vscode.ExtensionContext,
  selectedText: string,
  editor: vscode.TextEditor,
  selection: vscode.Selection
) {
  // format the selected SQL text
  let formattedSQL: string;
  try {
    formattedSQL = safeFormat(selectedText);
  } catch (error) {
    // if formatting fails, use the original text
    formattedSQL = selectedText;
    vscode.window.showWarningMessage('Could not format SQL, using original text.');
  }

  const panel = vscode.window.createWebviewPanel(
    'sqlFormatter',
    'SQL Highlighter For JSON - Editor',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  const iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
  panel.iconPath = iconPath;

  const iconUri = panel.webview.asWebviewUri(iconPath);
  panel.webview.html = getWebviewContent(formattedSQL, iconUri);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'save': {
          const modifiedSQL = message.sql;
          const cleanedSQL = modifiedSQL.replace(/\s+/g, ' ').trim();

          // If the user made no edits (content is identical to the pre-formatted text),
          // keep the original selection untouched to avoid unnecessary changes.
          const originalClean = formattedSQL.replace(/\s+/g, ' ').trim();
          const finalSQL = cleanedSQL === originalClean ? selectedText : cleanedSQL;

          await editor.edit((editBuilder) => {
            editBuilder.replace(selection, finalSQL);
          });

          panel.dispose();
          vscode.window.showInformationMessage('SQL updated successfully!');
          break;
        }
        case 'cancel':
          panel.dispose();
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}

export function deactivate() {
  console.log('SQL Highlighter For JSON extension is now deactivated');
}

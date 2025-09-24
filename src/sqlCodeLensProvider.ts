import * as vscode from 'vscode';

/**
 * Provides CodeLens links ("Open in SQL Editor") for potential SQL queries inside JSON strings.
 * Detection is heuristic: if a quoted JSON string contains common SQL keywords it is considered a query.
 */
export class SqlCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  constructor() {
    // Refresh lenses when JSON documents change.
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.languageId === 'json' || e.document.languageId === 'sql-in-json') {
        this._onDidChangeCodeLenses.fire();
      }
    });
  }

  provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    if (document.languageId !== 'json' && document.languageId !== 'sql-in-json') {
      return codeLenses;
    }

    const text = document.getText();
    const lines = text.split(/\r?\n/);
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
      const line = lines[lineNumber];
      const matches = this.findSqlInLine(line);
      for (const match of matches) {
        // Range excludes surrounding quotes so editor opens clean SQL.
        const range = new vscode.Range(
          new vscode.Position(lineNumber, match.start + 1), // after opening quote
          new vscode.Position(lineNumber, match.end) // end is closing quote index, which is exclusive in Range
        );

        const command: vscode.Command = {
          title: '$(edit) Open in SQL Editor',
          command: 'jsonsql-highlighter.openSqlEditor',
          arguments: [document.uri, range],
        };

        codeLenses.push(new vscode.CodeLens(range, command));
      }
    }

    return codeLenses;
  }

  resolveCodeLens(codeLens: vscode.CodeLens): vscode.CodeLens {
    return codeLens;
  }

  // ---------------- helpers ----------------

  private findSqlInLine(line: string): { start: number; end: number }[] {
    const results: { start: number; end: number }[] = [];
    if (!line.includes('"')) return results;

    // Consider first quoted value after a colon (JSON key : "value") allowing spaces.
    const match = /:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/.exec(line);
    if (!match) return results;

    const quotePos = line.indexOf('"', match.index); // actual opening quote char
    const start = quotePos;
    const end = quotePos + match[1].length + 1; // +1 for closing quote
    const content = match[1];
    if (this.isSqlString(content)) {
      results.push({ start, end });
    }
    return results;
  }

  /** Very simple heuristic: string contains at least one SQL keyword */
  private isSqlString(content: string): boolean {
    // One-pass regex for common SQL tokens. Covers full queries and partial predicates.
    const sqlTokenRe = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|JOIN|GROUP\s+BY|ORDER\s+BY|PRAGMA|WHERE|AND|OR|LIKE|GLOB|IN|IS\s+NULL|NOT\s+NULL)\b/i;
    if (sqlTokenRe.test(content)) return true;

    // Detect simple comparison predicates such as "TABLE.COL = ?" or "FLAG=1".
    const comparisonRe = /\b[A-Z0-9_]+(?:\.[A-Z0-9_]+)+\s*(=|<>|!=|>|<|>=|<=)\s*(\?|'.*?'|\d+)/i;
    return comparisonRe.test(content);
  }
}

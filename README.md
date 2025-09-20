# SQLite Highlighter for JSON

A VS Code extension that provides SQLite syntax highlighting for SQL queries embedded in JSON files.

## Perfect For

- Configuration files containing SQL queries
- Database migration scripts in JSON format
- Any JSON file where SQLite queries are stored as string values

## Visual Highlighting

The extension provides distinct visual cues for different elements:

- **SQL Keywords**: `SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, etc. - Your theme's keyword color
- **SQL Functions**: `COUNT`, `SUM`, `UPPER`, `LOWER`, `REPLACE`, etc. - Your theme's function color
- **SQL Operators**: `AND`, `OR`, `NOT`, `LIKE`, `GLOB`, etc. - Your theme's operator color
- **Single-quoted Strings**: `'DescricaoAplicacao'`, `'0'`, `'?'` - Comment color for easy identification
- **Temporary Variables**: `<IDM>`, `<IDM>` - Purple highlighting to show they're placeholders
- **Comparison Operators**: `=`, `<>`, `<=`, `>=` - Your theme's operator color

## Installation

1. Install the VSIX package in VS Code
2. Open any JSON file with SQLite queries
3. Enjoy enhanced syntax highlighting!

## Development

To build the extension:

```bash
npm install
npm run compile && vsce package
```

To watch for changes during development:

```bash
npm run watch
```

## License

MIT License
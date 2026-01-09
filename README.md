# Angular i18n MCP Server

This MCP server provides tools to manage Angular internationalization (i18n) using XLIFF 2.0 format. It integrates with `ng-extract-i18n-merge` to automate the extraction and merging of translation strings.

## Features

- **Extract i18n**: Runs the Angular CLI command to extract strings and merge them into target locale files.
- **List New Translations**: Identifies units that are newly added and haven't been translated yet (marked with `state="initial"`).
- **List All Translations**: Provides a paginated list of all translation units.
- **Update Translation**: Updates the translation text for a specific unit and sets its state to `translated`.

## Prerequisites

- Node.js installed.
- An Angular project configured with `ng-extract-i18n-merge`.
  ```bash
  ng add ng-extract-i18n-merge
  ```
- Angular configuration (`angular.json`) should define the target locales and use the `xlf2` format.

## Installation

1. Clone or copy this server into your project or a dedicated directory.
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage with Gemini-CLI

The easiest way to use this server is via `npx`. Add the following to your configuration:

```json
{
  "mcpServers": {
    "angular-i18n": {
      "command": "npx",
      "args": ["-y", "angular-i18n-mcp"],
      "env": {}
    }
  }
}
```

Or, if you have it installed locally/globally:

```json
{
  "mcpServers": {
    "angular-i18n": {
      "command": "angular-i18n-mcp",
      "args": [],
      "env": {}
    }
  }
}
```

## Tools

### `extract_i18n`
Extracts strings from the source code and merges them into the `.xlf` files in `src/locale`.

### `list_new_translations`
- **Arguments**:
  - `locale`: The target language code (e.g., `de`).
  - `page` (optional): Page number for pagination.
  - `pageSize` (optional): Number of units per page.

### `list_all_translations`
- **Arguments**:
  - `locale`: The target language code.
  - `page` (optional): Page number.
  - `pageSize` (optional): Number of units per page.

### `update_translation`
- **Arguments**:
  - `id`: The unique ID of the translation unit.
  - `locale`: The target language code.
  - `translation`: The new translated text.

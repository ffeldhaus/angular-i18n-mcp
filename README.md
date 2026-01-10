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

## Configuration

This MCP server requires configuration in `.gemini/settings.json`. You can place this file in either:
- Your user home directory: `~/.gemini/settings.json`
- The project root directory: `./.gemini/settings.json`

Add the following to your configuration:

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

It is recommended to add `src/locale` to your `.geminiignore` file to avoid Gemini to read large translation files or attempt updates itself.

It is strongly recommended to use [I18N metadata for translation](https://angular.io/guide/i18n#i18n-metadata-for-translation) to provide additional context for translators. This will allow Gemini to provide better suggestions and translations.

## Tools

### `extract_i18n`
- Extracts strings from the source code and merges them into the `.xlf` files in `src/locale`.

### `list_new_translations`
- Lists newly added translation units that haven't been translated yet (marked with `state="initial"`).
- **Arguments**:
  - `locale`: The target language code (e.g., `de`).
  - `page` (optional): Page number for pagination.
  - `pageSize` (optional): Number of units per page.

### `list_all_translations`
- Lists all translation units in a locale file.
- **Arguments**:
  - `locale`: The target language code.
  - `page` (optional): Page number.
  - `pageSize` (optional): Number of units per page.

### `update_translation`
- Updates the translation text for a specific unit and sets its state to `translated`.
- **Arguments**:
  - `id`: The unique ID of the translation unit.
  - `locale`: The target language code.
  - `translation`: The new translated text.

## TODO

- document best practices adding src/locale to gitignore and using description in i18n tags
- add biome
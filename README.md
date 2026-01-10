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

- default page size to 50
- bulk update translations with max 50
- unit listing should not be a table but compact format maybe YAML or XML
- document best practices adding src/locale to gitignore and using description in i18n tags
- xml issue
The issue was that XML tags were incorrectly escaped inside the translation file (src/locale/messages.en.xlf).

  In Angular's XLIFF format, placeholders (like {{ year }}) and HTML wrappers (like <strong>) are represented by special tags:
   - <ph> (placeholder)
   - <pc> (placeholder container)

  When I updated the translations, these tags were written as escaped text (e.g., &lt;ph ... /&gt;) instead of actual XML tags. When you ran the build, the
  Angular compiler couldn't parse these as valid placeholders, leading to the error:
  ERROR Error: Unable to parse ICU expression...

  I fixed this by running a script to "unescape" those specific tags within the <target> elements, restoring them to valid XML so the compiler could recognize
  them correctly.
✦ The build was successful, confirming that the XML issues are resolved. I'll now commit the fixes to the translation file.

- add biome
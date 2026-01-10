#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const LOCALE_DIR = process.env.LOCALE_DIR || "src/locale";

export async function getXlfPath(locale) {
  if (!locale) {
    return path.join(LOCALE_DIR, "messages.xlf");
  }
  return path.join(LOCALE_DIR, `messages.${locale}.xlf`);
}

export async function parseXlf(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  return new DOMParser().parseFromString(content, "application/xml");
}

export async function saveXlf(filePath, doc) {
  const serializer = new XMLSerializer();
  const xmlString = serializer.serializeToString(doc);
  await fs.writeFile(filePath, xmlString, "utf-8");
}

export async function listTranslations(name, args) {
  const locale = args.locale;
  const page = args.page || 0;
  const pageSize = args.pageSize || 50;
  const filePath = await getXlfPath(locale);
  const doc = await parseXlf(filePath);
  const units = [
    ...Array.from(doc.getElementsByTagName("unit")),
    ...Array.from(doc.getElementsByTagName("trans-unit")),
  ];

  const filteredUnits =
    name === "list_new_translations"
      ? units.filter((unit) => {
          const segment = unit.getElementsByTagName("segment")[0];
          const target = unit.getElementsByTagName("target")[0];

          // XLIFF 2.0: state is usually on segment
          if (segment && segment.getAttribute("state") === "initial") return true;
          // XLIFF 1.2: state is usually on target
          if (target && target.getAttribute("state") === "initial") return true;

          return false;
        })
      : units;

  const totalCount = filteredUnits.length;
  const start = page * pageSize;
  const pagedUnits = filteredUnits.slice(start, start + pageSize);
  const serializer = new XMLSerializer();

  return {
    totalCount,
    page,
    pageSize,
    nextPage: start + pageSize < totalCount ? page + 1 : null,
    units: pagedUnits.map((u) => serializer.serializeToString(u)),
  };
}

function applyTranslationUpdate(doc, units, id, translation) {
  const unit = units.find((u) => u.getAttribute("id") === id);
  if (!unit) {
    return false;
  }

  let segment = unit.getElementsByTagName("segment")[0];
  if (!segment) {
    segment = unit;
  }

  let target = segment.getElementsByTagName("target")[0];
  if (!target) {
    target = doc.createElement("target");
    segment.appendChild(target);
  }

  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }

  const fragment = new DOMParser().parseFromString(`<t>${translation}</t>`, "application/xml");
  const root = fragment.documentElement;
  while (root.firstChild) {
    const importedNode = doc.importNode(root.firstChild, true);
    target.appendChild(importedNode);
    root.removeChild(root.firstChild);
  }
  if (segment && segment.tagName === "segment") {
    segment.setAttribute("state", "translated");
  } else {
    target.setAttribute("state", "translated");
  }
  return true;
}

export async function updateTranslation(args) {
  const { id, locale, translation } = args;
  const filePath = await getXlfPath(locale);
  const doc = await parseXlf(filePath);
  const units = [
    ...Array.from(doc.getElementsByTagName("unit")),
    ...Array.from(doc.getElementsByTagName("trans-unit")),
  ];

  if (applyTranslationUpdate(doc, units, id, translation)) {
    await saveXlf(filePath, doc);
    return `Updated translation for unit ${id}`;
  } else {
    throw new Error(`Unit with id "${id}" not found.`);
  }
}

export async function bulkUpdateTranslations(args) {
  const { locale, updates } = args;
  if (!Array.isArray(updates)) {
    throw new Error("Updates must be an array.");
  }
  if (updates.length > 50) {
    throw new Error("Maximum 50 updates allowed per tool call.");
  }
  const filePath = await getXlfPath(locale);
  const doc = await parseXlf(filePath);
  const units = [
    ...Array.from(doc.getElementsByTagName("unit")),
    ...Array.from(doc.getElementsByTagName("trans-unit")),
  ];

  const results = {
    updated: [],
    notFound: [],
  };

  for (const update of updates) {
    if (applyTranslationUpdate(doc, units, update.id, update.translation)) {
      results.updated.push(update.id);
    } else {
      results.notFound.push(update.id);
    }
  }

  await saveXlf(filePath, doc);
  return results;
}

export async function getI18nSettings() {
  const angularJsonPath = path.join(process.cwd(), "angular.json");
  const content = await fs.readFile(angularJsonPath, "utf-8");
  const angularJson = JSON.parse(content);
  const projectNames = Object.keys(angularJson.projects);
  const projectName = projectNames[0]; // Default to first project
  if (!projectName) {
    throw new Error("No projects found in angular.json");
  }
  return angularJson.projects[projectName].i18n || {};
}

const server = new Server(
  {
    name: "angular-i18n-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "extract_i18n",
        description: "Extract i18n strings and merge into target files using Angular CLI",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_new_translations",
        description: "List new (untranslated) units with state='initial'",
        inputSchema: {
          type: "object",
          properties: {
            locale: { type: "string", description: "Target locale (e.g., 'de')" },
            page: { type: "number", default: 0 },
            pageSize: { type: "number", default: 50 },
          },
          required: ["locale"],
        },
      },
      {
        name: "list_all_translations",
        description: "List all units in the translation file",
        inputSchema: {
          type: "object",
          properties: {
            locale: { type: "string", description: "Target locale (e.g., 'de')" },
            page: { type: "number", default: 0 },
            pageSize: { type: "number", default: 50 },
          },
          required: ["locale"],
        },
      },
      {
        name: "update_translation",
        description: "Update the translation for a specific unit",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The unit ID" },
            locale: { type: "string", description: "Target locale" },
            translation: { type: "string", description: "The translated text" },
          },
          required: ["id", "locale", "translation"],
        },
      },
      {
        name: "bulk_update_translations",
        description: "Update multiple translations in a single file (max 50)",
        inputSchema: {
          type: "object",
          properties: {
            locale: { type: "string", description: "Target locale" },
            updates: {
              type: "array",
              description: "Array of translation updates",
              items: {
                type: "object",
                properties: {
                  id: { type: "string", description: "The unit ID" },
                  translation: { type: "string", description: "The translated text" },
                },
                required: ["id", "translation"],
              },
            },
          },
          required: ["locale", "updates"],
        },
      },
      {
        name: "get_i18n_settings",
        description: "Get i18n settings from angular.json",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

export async function extractI18n() {
  const ngPath = path.join(process.cwd(), "node_modules", "@angular", "cli", "bin", "ng.js");
  const isNgInCwd = await fs
    .stat(ngPath)
    .then(() => true)
    .catch(() => false);
  const command = isNgInCwd ? `node ${ngPath}` : "npx ng";

  let format = "xlf2";
  try {
    const angularJsonPath = path.join(process.cwd(), "angular.json");
    const content = await fs.readFile(angularJsonPath, "utf-8");
    const angularJson = JSON.parse(content);
    const projectName = Object.keys(angularJson.projects)[0];
    if (projectName) {
      const options = angularJson.projects[projectName]?.architect?.["extract-i18n"]?.options;
      if (options?.format) {
        format = options.format;
      }
    }
  } catch (_error) {
    // Fallback to xlf2
  }

  execSync(`${command} extract-i18n --output-path ${LOCALE_DIR} --format=${format}`, {
    stdio: "pipe",
    env: { ...process.env, NODE_PATH: path.join(process.cwd(), "node_modules") },
  });
  return "Extraction and merge completed successfully.";
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "extract_i18n": {
        const text = await extractI18n();
        return { content: [{ type: "text", text }] };
      }

      case "list_all_translations":
      case "list_new_translations": {
        const result = await listTranslations(name, args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "get_i18n_settings": {
        const settings = await getI18nSettings();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(settings, null, 2),
            },
          ],
        };
      }

      case "update_translation": {
        const text = await updateTranslation(args);
        return { content: [{ type: "text", text }] };
      }

      case "bulk_update_translations": {
        const result = await bulkUpdateTranslations(args);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error.message }],
    };
  }
});

function isMain() {
  const argv1 = process.argv[1];
  if (!argv1) return false;

  const normalizedArgv1 = argv1.replace(/\\/g, "/");
  const normalizedFilename = import.meta.filename.replace(/\\/g, "/");

  return (
    normalizedArgv1 === normalizedFilename ||
    normalizedArgv1.endsWith("index.mjs") ||
    normalizedArgv1.endsWith("angular-i18n-mcp")
  );
}

if (isMain()) {
  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Angular i18n MCP server running on stdio");
  }

  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}

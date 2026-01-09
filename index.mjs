#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";
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
  const pageSize = args.pageSize || 10;
  const filePath = await getXlfPath(locale);
  const doc = await parseXlf(filePath);
  const units = Array.from(doc.getElementsByTagName("unit"));

  const filteredUnits = name === "list_new_translations"
    ? units.filter(unit => {
      const target = unit.getElementsByTagName("target")[0];
      return target && target.getAttribute("state") === "initial";
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
    units: pagedUnits.map(u => serializer.serializeToString(u)),
  };
}

export async function updateTranslation(args) {
  const { id, locale, translation } = args;
  const filePath = await getXlfPath(locale);
  const doc = await parseXlf(filePath);
  const units = Array.from(doc.getElementsByTagName("unit"));
  const unit = units.find(u => u.getAttribute("id") === id);

  if (!unit) {
    throw new Error(`Unit with id "${id}" not found.`);
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

  target.textContent = translation;
  target.setAttribute("state", "translated");

  await saveXlf(filePath, doc);
  return `Updated translation for unit ${id}`;
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
            pageSize: { type: "number", default: 10 },
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
            pageSize: { type: "number", default: 10 },
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
    ],
  };
});

export async function extractI18n() {
  const ngPath = path.join(process.cwd(), "node_modules", "@angular", "cli", "bin", "ng.js");
  const isNgInCwd = await fs.stat(ngPath).then(() => true).catch(() => false);
  const command = isNgInCwd ? `node ${ngPath}` : "npx ng";

  execSync(`${command} extract-i18n --output-path ${LOCALE_DIR} --format=xlf2`, {
    stdio: "pipe",
    env: { ...process.env, NODE_PATH: path.join(process.cwd(), "node_modules") }
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

      case "list_new_translations":
      case "list_all_translations": {
        const result = await listTranslations(name, args);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      case "update_translation": {
        const text = await updateTranslation(args);
        return { content: [{ type: "text", text }] };
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

  const normalizedArgv1 = argv1.replace(/\\/g, '/');
  const normalizedFilename = import.meta.filename.replace(/\\/g, '/');

  return normalizedArgv1 === normalizedFilename ||
    normalizedArgv1.endsWith('index.mjs') ||
    normalizedArgv1.endsWith('angular-i18n-mcp');
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
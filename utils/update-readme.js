#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// @ts-check

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import zodToJsonSchema from 'zod-to-json-schema'

import batchSequenceTools from '../lib/tools/batch-sequence.js';
import commonTools from '../lib/tools/common.js';
import consoleTools from '../lib/tools/console.js';
import dialogsTools from '../lib/tools/dialogs.js';
import filesTools from '../lib/tools/files.js';
import installTools from '../lib/tools/install.js';
import keyboardTools from '../lib/tools/keyboard.js';
import navigateTools from '../lib/tools/navigate.js';
import networkTools from '../lib/tools/network.js';
import pdfTools from '../lib/tools/pdf.js';
import snapshotTools from '../lib/tools/snapshot.js';
import tabsTools from '../lib/tools/tabs.js';
import screenshotTools from '../lib/tools/screenshot.js';
import testTools from '../lib/tools/testing.js';
import visionTools from '../lib/tools/vision.js';
import waitTools from '../lib/tools/wait.js';
import { execSync } from 'node:child_process';

const categories = {
  'Interactions': [
    ...snapshotTools,
    ...keyboardTools(true),
    ...waitTools(true),
    ...filesTools(true),
    ...dialogsTools(true),
  ],
  'Navigation': [
    ...navigateTools(true),
  ],
  'Resources': [
    ...screenshotTools,
    ...pdfTools,
    ...networkTools,
    ...consoleTools,
  ],
  'Utilities': [
    ...installTools,
    ...commonTools(true),
    ...batchSequenceTools,
  ],
  'Tabs': [
    ...tabsTools(true),
  ],
  'Testing': [
    ...testTools,
  ],
  'Vision mode': [
    ...visionTools,
    ...keyboardTools(),
    ...waitTools(false),
    ...filesTools(false),
    ...dialogsTools(false),
  ],
};

// NOTE: Can be removed when we drop Node.js 18 support and changed to import.meta.filename.
const __filename = url.fileURLToPath(import.meta.url);

/**
 * @param {import('../src/tools/tool.js').ToolSchema<any>} tool 
 * @returns {string[]}
 */
function formatToolForReadme(tool) {
  const lines = /** @type {string[]} */ ([]);
  lines.push(`<!-- NOTE: This has been generated via ${path.basename(__filename)} -->`);
  lines.push(``);
  lines.push(`- **${tool.name}**`);
  lines.push(`  - Title: ${tool.title}`);
  lines.push(`  - Description: ${tool.description}`);

  const inputSchema = /** @type {any} */ (zodToJsonSchema(tool.inputSchema || {}));
  const requiredParams = inputSchema.required || [];
  if (inputSchema.properties && Object.keys(inputSchema.properties).length) {
    lines.push(`  - Parameters:`);
    Object.entries(inputSchema.properties).forEach(([name, param]) => {
      const optional = !requiredParams.includes(name);
      const meta = /** @type {string[]} */ ([]);
      if (param.type)
        meta.push(param.type);
      if (optional)
        meta.push('optional');
      lines.push(`    - \`${name}\` ${meta.length ? `(${meta.join(', ')})` : ''}: ${param.description}`);
    });
  } else {
    lines.push(`  - Parameters: None`);
  }
  lines.push(`  - Read-only: **${tool.type === 'readOnly'}**`);
  lines.push('');
  return lines;
}

/**
 * @param {string} content
 * @param {string} startMarker
 * @param {string} endMarker
 * @param {string[]} generatedLines
 * @returns {Promise<string>}
 */
async function updateSection(content, startMarker, endMarker, generatedLines) {
  const startMarkerIndex = content.indexOf(startMarker);
  const endMarkerIndex = content.indexOf(endMarker);
  if (startMarkerIndex === -1 || endMarkerIndex === -1)
    throw new Error('Markers for generated section not found in README');

  return [
    content.slice(0, startMarkerIndex + startMarker.length),
    '',
    generatedLines.join('\n'),
    '',
    content.slice(endMarkerIndex),
  ].join('\n');
}

/**
 * @param {string} content
 * @returns {Promise<string>}
 */
async function updateTools(content) {
  console.log('Loading tool information from compiled modules...');

  const totalTools = Object.values(categories).flat().length;
  console.log(`Found ${totalTools} tools`);

  const generatedLines = /** @type {string[]} */ ([]);
  for (const [category, categoryTools] of Object.entries(categories)) {
    generatedLines.push(`<details>\n<summary><b>${category}</b></summary>`);
    generatedLines.push('');
    for (const tool of categoryTools)
      generatedLines.push(...formatToolForReadme(tool.schema));
    generatedLines.push(`</details>`);
    generatedLines.push('');
  }

  const startMarker = `<!--- Tools generated by ${path.basename(__filename)} -->`;
  const endMarker = `<!--- End of tools generated section -->`;
  return updateSection(content, startMarker, endMarker, generatedLines);
}

/**
 * @param {string} content
 * @returns {Promise<string>}
 */
async function updateOptions(content) {
  console.log('Listing options...');
  const output = execSync('node cli.js --help');
  const lines = output.toString().split('\n');
  const firstLine = lines.findIndex(line => line.includes('--version'));
  lines.splice(0, firstLine + 1);
  const lastLine = lines.findIndex(line => line.includes('--help'));
  lines.splice(lastLine);
  const startMarker = `<!--- Options generated by ${path.basename(__filename)} -->`;
  const endMarker = `<!--- End of options generated section -->`;
  return updateSection(content, startMarker, endMarker, [
    '```',
    '> npx @playwright/mcp@latest --help',
    ...lines,
    '```',
  ]);
}

async function updateReadme() {
  const readmePath = path.join(path.dirname(__filename), '..', 'README.md');
  const readmeContent = await fs.promises.readFile(readmePath, 'utf-8');
  const withTools = await updateTools(readmeContent);
  const withOptions = await updateOptions(withTools);
  await fs.promises.writeFile(readmePath, withOptions, 'utf-8');
  console.log('README updated successfully');
}

updateReadme().catch(err => {
  console.error('Error updating README:', err);
  process.exit(1);
});

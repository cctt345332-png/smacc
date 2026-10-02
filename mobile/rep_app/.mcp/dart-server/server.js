#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync, spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../../..');

function run(cmd, args = []) {
  const result = execSync(`${cmd} ${args.join(' ')}`, {
    cwd: projectRoot,
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
    timeout: 120_000,
  });
  return result;
}

function runQuiet(cmd, args = []) {
  try {
    return run(cmd, args);
  } catch (e) {
    return e?.stdout + '\n' + e?.stderr || e.message;
  }
}

const server = new Server(
  {
    name: 'dart-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'dart_analyze',
      description: 'Run static analysis on the Dart/Flutter project',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'dart_fix',
      description: 'Apply automated fixes to the project (dart fix --apply)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'dart_format',
      description: 'Check or fix formatting of Dart files',
      inputSchema: {
        type: 'object',
        properties: {
          check: {
            type: 'boolean',
            description: 'If true, only check without applying fixes',
          },
          paths: {
            type: 'string',
            description: 'Optional paths to format (space-separated), defaults to lib/',
          },
        },
      },
    },
    {
      name: 'dart_test',
      description: 'Run Dart/Flutter tests',
      inputSchema: {
        type: 'object',
        properties: {
          paths: {
            type: 'string',
            description: 'Optional path(s) to test files or directories (space-separated)',
          },
          flavor: {
            type: 'string',
            enum: ['dart', 'flutter'],
            description: 'Whether to use dart test or flutter test',
          },
        },
      },
    },
    {
      name: 'dart_pub_get',
      description: 'Run pub get to resolve dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          flavor: {
            type: 'string',
            enum: ['dart', 'flutter'],
            description: 'Whether to use dart pub get or flutter pub get',
          },
        },
      },
    },
    {
      name: 'dart_build_runner',
      description: 'Run build_runner for code generation (freezed, json_serializable, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          build: {
            type: 'boolean',
            description: 'If true, run build (one-time). If false, run watch.',
            default: true,
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'dart_analyze':
        result = runQuiet('dart', ['analyze', 'lib/']);
        break;
      case 'dart_fix':
        result = run('dart', ['fix', '--apply', 'lib/']);
        result = run('dart', ['format', 'lib/']);
        result = 'Applied all automatic fixes and formatted code.';
        break;
      case 'dart_format':
        if (args?.check) {
          result = runQuiet('dart', ['format', '--set-exit-if-changed', ...(args.paths ? args.paths.split(' ') : ['lib/'])]);
        } else {
          result = run('dart', ['format', ...(args.paths ? args.paths.split(' ') : ['lib/'])]);
        }
        break;
      case 'dart_test': {
        const flavor = args?.flavor || 'flutter';
        const testPaths = args?.paths ? args.paths.split(' ') : [];
        result = run(flavor, ['test', ...testPaths]);
        break;
      }
      case 'dart_pub_get': {
        const flavor = args?.flavor || 'flutter';
        result = run(flavor, ['pub', 'get']);
        break;
      }
      case 'dart_build_runner':
        if (args?.build === false) {
          result = run('dart', ['run', 'build_runner', 'watch', '--delete-conflicting-outputs']);
        } else {
          result = run('dart', ['run', 'build_runner', 'build', '--delete-conflicting-outputs']);
        }
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: String(result) }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

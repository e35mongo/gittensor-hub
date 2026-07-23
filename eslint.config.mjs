import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'next-env.d.ts',
  ]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'react/no-unescaped-entities': 'off',
      // React Compiler rules ship enabled in eslint-config-next 16, but this
      // app does not use the React Compiler. Keep the pre-upgrade lint baseline.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/static-components': 'off',
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: {
          attributes: false,
        },
      }],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['src/app/**/*.tsx', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'better-sqlite3',
            message: 'SQLite is server-only. Keep database access in API routes or server library modules.',
          },
          {
            name: '@/lib/db',
            message: 'Database access is server-only. Use an API route or server data boundary instead.',
          },
          {
            name: '@/lib/repos-server',
            message: 'Repo registry server helpers import server-only dependencies. Use client-safe repo data or an API route.',
          },
          {
            name: '@/lib/poller',
            message: 'The poller is server-only and must not be imported by UI code.',
          },
          {
            name: '@/lib/refresh',
            message: 'Refresh jobs are server-only. Trigger them through API/server code instead of UI modules.',
          },
          {
            name: '@/lib/github',
            message: 'GitHub PAT helpers are server-only. UI code should call API routes.',
          },
          {
            name: '@/lib/auth',
            message: 'Session/auth persistence is server-only. UI code should use client-safe session hooks or API routes.',
          },
        ],
        patterns: [
          {
            group: ['@/lib/*-server', '@/lib/server/**'],
            message: 'Server-only library modules cannot be imported by UI code. Use an API route or client-safe module instead.',
          },
        ],
      }],
    },
  },
  {
    files: ['*.config.js', 'ecosystem.config.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);

export default eslintConfig;

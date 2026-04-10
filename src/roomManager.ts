/**
 * roomManager.ts
 *
 * Manages team rooms (Frontend, Backend, SRE, Data, QA, General + user-defined).
 * Provides auto-assignment of agents to rooms based on task keyword matching.
 */

import {
  ROOM_COLOR_BACKEND,
  ROOM_COLOR_DATA,
  ROOM_COLOR_FRONTEND,
  ROOM_COLOR_GENERAL,
  ROOM_COLOR_QA,
  ROOM_COLOR_SRE,
} from './constants.js';
import type { TeamRoom } from './types.js';

// ── Built-in rooms ───────────────────────────────────────────────────────────

export const BUILT_IN_ROOMS: TeamRoom[] = [
  {
    id: 'frontend',
    name: 'Frontend',
    color: ROOM_COLOR_FRONTEND,
    icon: '🖥',
    description: 'UI/UX, React, CSS, components',
    isBuiltIn: true,
  },
  {
    id: 'backend',
    name: 'Backend',
    color: ROOM_COLOR_BACKEND,
    icon: '⚙',
    description: 'APIs, servers, services, business logic',
    isBuiltIn: true,
  },
  {
    id: 'data',
    name: 'Data',
    color: ROOM_COLOR_DATA,
    icon: '🗄',
    description: 'Databases, migrations, analytics, ML',
    isBuiltIn: true,
  },
  {
    id: 'sre',
    name: 'SRE / DevOps',
    color: ROOM_COLOR_SRE,
    icon: '🔧',
    description: 'Infra, CI/CD, Docker, Kubernetes',
    isBuiltIn: true,
  },
  {
    id: 'qa',
    name: 'QA',
    color: ROOM_COLOR_QA,
    icon: '✅',
    description: 'Tests, specs, quality, automation',
    isBuiltIn: true,
  },
  {
    id: 'general',
    name: 'General',
    color: ROOM_COLOR_GENERAL,
    icon: '🏠',
    description: 'Unassigned / general purpose',
    isBuiltIn: true,
  },
];

// ── Keyword → room mapping ────────────────────────────────────────────────────

const ROOM_KEYWORDS: { roomId: string; keywords: string[] }[] = [
  {
    roomId: 'frontend',
    keywords: [
      'react',
      'vue',
      'angular',
      'svelte',
      'typescript',
      'tsx',
      'jsx',
      'css',
      'scss',
      'tailwind',
      'html',
      'dom',
      'component',
      'ui',
      'ux',
      'button',
      'form',
      'modal',
      'layout',
      'style',
      'animation',
      'design',
      'next.js',
      'nextjs',
      'vite',
      'webpack',
      'storybook',
      'figma',
    ],
  },
  {
    roomId: 'backend',
    keywords: [
      'api',
      'server',
      'express',
      'fastapi',
      'django',
      'flask',
      'nest',
      'rest',
      'graphql',
      'grpc',
      'endpoint',
      'route',
      'controller',
      'middleware',
      'auth',
      'jwt',
      'oauth',
      'backend',
      'service',
      'microservice',
      'node',
      'python',
      'go',
      'rust',
      'java',
      'spring',
      'dotnet',
      '.net',
    ],
  },
  {
    roomId: 'data',
    keywords: [
      'database',
      'postgres',
      'postgresql',
      'mysql',
      'mongodb',
      'redis',
      'sql',
      'nosql',
      'migration',
      'schema',
      'model',
      'query',
      'index',
      'prisma',
      'typeorm',
      'sequelize',
      'drizzle',
      'analytics',
      'etl',
      'spark',
      'pandas',
      'numpy',
      'jupyter',
      'ml',
      'machine learning',
      'dataset',
      'training',
      'tensorflow',
      'pytorch',
      'embedding',
    ],
  },
  {
    roomId: 'sre',
    keywords: [
      'docker',
      'kubernetes',
      'k8s',
      'helm',
      'terraform',
      'ansible',
      'ci',
      'cd',
      'pipeline',
      'github actions',
      'jenkins',
      'deploy',
      'infra',
      'infrastructure',
      'monitoring',
      'logging',
      'prometheus',
      'grafana',
      'alerting',
      'nginx',
      'load balancer',
      'ssl',
      'tls',
      'aws',
      'azure',
      'gcp',
      'cloud',
      'serverless',
      'lambda',
      'devops',
    ],
  },
  {
    roomId: 'qa',
    keywords: [
      'test',
      'tests',
      'spec',
      'specs',
      'jest',
      'vitest',
      'pytest',
      'unittest',
      'mocha',
      'cypress',
      'playwright',
      'selenium',
      'e2e',
      'integration test',
      'unit test',
      'coverage',
      'lint',
      'bug',
      'fix',
      'regression',
      'quality',
      'qa',
      'assertion',
    ],
  },
];

/**
 * Infer which team room an agent belongs to based on free-text (task description,
 * terminal name, first message text, etc.).
 * Returns 'general' when no strong signal is found.
 */
export function inferRoomFromText(text: string): string {
  if (!text) return 'general';
  const lower = text.toLowerCase();

  const scores = new Map<string, number>();

  // Check built-in room keywords
  for (const { roomId, keywords } of ROOM_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) scores.set(roomId, score);
  }

  // Check custom room keywords — these take priority over built-ins by getting a bonus
  for (const [roomId, keywords] of customRoomKeywords) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) {
      // Add 0.5 bonus so custom rooms win ties over built-ins
      scores.set(roomId, (scores.get(roomId) ?? 0) + score + 0.5);
    }
  }

  if (scores.size === 0) return 'general';

  // Return the room with the highest keyword match score
  let best = 'general';
  let bestScore = 0;
  for (const [roomId, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = roomId;
    }
  }
  return best;
}

/**
 * Merge built-in rooms with user-defined custom rooms.
 * Custom rooms with the same id as a built-in are ignored.
 */
export function mergeRooms(customRooms: TeamRoom[]): TeamRoom[] {
  const builtInIds = new Set(BUILT_IN_ROOMS.map((r) => r.id));
  const userRooms = customRooms.filter((r) => !builtInIds.has(r.id));
  return [...BUILT_IN_ROOMS, ...userRooms];
}

// ── Custom room keywords ──────────────────────────────────────────────────────

/** Custom room keyword mappings managed at runtime by the extension */
const customRoomKeywords = new Map<string, string[]>(); // roomId → keywords

/**
 * Register keywords for a custom room so `inferRoomFromText` can auto-assign agents to it.
 * Pass an empty array or call with no keywords to remove the mapping.
 */
export function setCustomRoomKeywords(roomId: string, keywords: string[]): void {
  if (keywords.length === 0) {
    customRoomKeywords.delete(roomId);
  } else {
    customRoomKeywords.set(
      roomId,
      keywords.map((k) => k.toLowerCase()),
    );
  }
}

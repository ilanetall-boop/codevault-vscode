/**
 * Constants for CodeVault extension.
 */

export const EXTENSION_ID = 'codevault';
export const EXTENSION_NAME = 'CodeVault';

export const DEFAULT_BACKEND_URL = 'http://localhost:8420';
export const API_PREFIX = '/api/v1';

export const ENDPOINTS = {
    HEALTH: '/health',
    MEMORIES: `${API_PREFIX}/memories`,
    SEARCH: `${API_PREFIX}/search`,
    AGENTS: `${API_PREFIX}/agents`,
};

export const THROTTLE = {
    FILE_CAPTURE_MS: 30000,      // 30 seconds between captures for same file
    GIT_CAPTURE_MS: 60000,       // 1 minute between git captures
    MAX_CAPTURES_PER_HOUR: 50,   // Maximum auto-captures per hour
};

export const MEMORY_COLORS = {
    semantic: '#4CAF50',    // Green
    episodic: '#2196F3',    // Blue
    procedural: '#FF9800',  // Orange
};

export const IMPORTANT_FILES = [
    'README.md',
    'README.rst',
    'package.json',
    'pyproject.toml',
    'requirements.txt',
    'Cargo.toml',
    'go.mod',
    'tsconfig.json',
    '.eslintrc.json',
    '.eslintrc.js',
    '.prettierrc',
    'docker-compose.yml',
    'Dockerfile',
    '.env.example',
    'CONTRIBUTING.md',
    'ARCHITECTURE.md',
];

export const IGNORED_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'out',
    '__pycache__',
    '.pytest_cache',
    '.venv',
    'venv',
    '.next',
    '.nuxt',
    'coverage',
    '*.min.js',
    '*.min.css',
    '*.map',
    '*.lock',
];

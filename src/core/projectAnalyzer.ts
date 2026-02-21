/**
 * Analyzes the current workspace to extract project knowledge.
 */

import * as path from 'path';
import * as fs from 'fs';
import { ProjectKnowledge } from './types';
import { Logger } from '../utils/logger';
import { IGNORED_PATTERNS } from '../utils/constants';
import { detectWorkspacePath } from '../utils/config';

export class ProjectAnalyzer {
    private workspaceRoot: string | undefined;

    constructor() {
        this.workspaceRoot = detectWorkspacePath() || undefined;
    }

    /**
     * Analyze the entire workspace and extract knowledge.
     */
    async analyzeWorkspace(): Promise<ProjectKnowledge> {
        if (!this.workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        Logger.info('Analyzing workspace:', this.workspaceRoot);

        const knowledge: ProjectKnowledge = {
            name: path.basename(this.workspaceRoot),
            rootPath: this.workspaceRoot,
            stack: {
                languages: [],
                frameworks: [],
                tools: [],
                infra: [],
            },
            architecture: {
                structure: {},
                patterns: [],
                entryPoints: [],
            },
            conventions: {
                linting: {},
                formatting: {},
                naming: 'unknown',
            },
            decisions: [],
            todos: [],
            analyzedAt: new Date(),
        };

        // Detect stack
        await this.detectStack(knowledge);

        // Analyze architecture
        await this.analyzeArchitecture(knowledge);

        // Extract conventions
        await this.extractConventions(knowledge);

        // Find TODOs
        await this.findTodos(knowledge);

        Logger.info('Workspace analysis complete:', knowledge.name);
        return knowledge;
    }

    /**
     * Detect the technology stack.
     */
    private async detectStack(knowledge: ProjectKnowledge): Promise<void> {
        const root = this.workspaceRoot!;

        // Check for Node.js / JavaScript
        const packageJsonPath = path.join(root, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            knowledge.stack.languages.push('JavaScript/TypeScript');
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                // Detect frameworks
                if (deps['react']) {knowledge.stack.frameworks.push('React');}
                if (deps['vue']) {knowledge.stack.frameworks.push('Vue');}
                if (deps['@angular/core']) {knowledge.stack.frameworks.push('Angular');}
                if (deps['next']) {knowledge.stack.frameworks.push('Next.js');}
                if (deps['nuxt']) {knowledge.stack.frameworks.push('Nuxt');}
                if (deps['express']) {knowledge.stack.frameworks.push('Express');}
                if (deps['fastify']) {knowledge.stack.frameworks.push('Fastify');}
                if (deps['nest']) {knowledge.stack.frameworks.push('NestJS');}
                if (deps['electron']) {knowledge.stack.frameworks.push('Electron');}

                // Detect tools
                if (deps['typescript']) {knowledge.stack.tools.push('TypeScript');}
                if (deps['webpack']) {knowledge.stack.tools.push('Webpack');}
                if (deps['vite']) {knowledge.stack.tools.push('Vite');}
                if (deps['jest']) {knowledge.stack.tools.push('Jest');}
                if (deps['mocha']) {knowledge.stack.tools.push('Mocha');}
                if (deps['eslint']) {knowledge.stack.tools.push('ESLint');}
                if (deps['prettier']) {knowledge.stack.tools.push('Prettier');}
            } catch (e) {
                Logger.warn('Failed to parse package.json:', e);
            }
        }

        // Check for Python
        const pyprojectPath = path.join(root, 'pyproject.toml');
        const requirementsPath = path.join(root, 'requirements.txt');
        if (fs.existsSync(pyprojectPath) || fs.existsSync(requirementsPath)) {
            knowledge.stack.languages.push('Python');

            if (fs.existsSync(pyprojectPath)) {
                try {
                    const content = fs.readFileSync(pyprojectPath, 'utf-8');
                    if (content.includes('fastapi')) {knowledge.stack.frameworks.push('FastAPI');}
                    if (content.includes('django')) {knowledge.stack.frameworks.push('Django');}
                    if (content.includes('flask')) {knowledge.stack.frameworks.push('Flask');}
                    if (content.includes('sqlalchemy')) {knowledge.stack.frameworks.push('SQLAlchemy');}
                    if (content.includes('pytest')) {knowledge.stack.tools.push('pytest');}
                    if (content.includes('ruff')) {knowledge.stack.tools.push('Ruff');}
                    if (content.includes('mypy')) {knowledge.stack.tools.push('mypy');}
                } catch (e) {
                    Logger.warn('Failed to parse pyproject.toml:', e);
                }
            }

            if (fs.existsSync(requirementsPath)) {
                try {
                    const content = fs.readFileSync(requirementsPath, 'utf-8').toLowerCase();
                    if (content.includes('fastapi')) {knowledge.stack.frameworks.push('FastAPI');}
                    if (content.includes('django')) {knowledge.stack.frameworks.push('Django');}
                    if (content.includes('flask')) {knowledge.stack.frameworks.push('Flask');}
                } catch (e) {
                    Logger.warn('Failed to parse requirements.txt:', e);
                }
            }
        }

        // Check for Go
        if (fs.existsSync(path.join(root, 'go.mod'))) {
            knowledge.stack.languages.push('Go');
        }

        // Check for Rust
        if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
            knowledge.stack.languages.push('Rust');
        }

        // Check for Java
        if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) {
            knowledge.stack.languages.push('Java');
        }

        // Check for infrastructure
        if (fs.existsSync(path.join(root, 'Dockerfile'))) {
            knowledge.stack.infra.push('Docker');
        }
        if (fs.existsSync(path.join(root, 'docker-compose.yml')) || fs.existsSync(path.join(root, 'docker-compose.yaml'))) {
            knowledge.stack.infra.push('Docker Compose');
        }
        if (fs.existsSync(path.join(root, 'kubernetes')) || fs.existsSync(path.join(root, 'k8s'))) {
            knowledge.stack.infra.push('Kubernetes');
        }
        if (fs.existsSync(path.join(root, 'terraform'))) {
            knowledge.stack.infra.push('Terraform');
        }
        if (fs.existsSync(path.join(root, '.github/workflows'))) {
            knowledge.stack.infra.push('GitHub Actions');
        }

        // Deduplicate
        knowledge.stack.frameworks = [...new Set(knowledge.stack.frameworks)];
        knowledge.stack.tools = [...new Set(knowledge.stack.tools)];
    }

    /**
     * Analyze the project architecture with 2-level deep scanning.
     */
    private async analyzeArchitecture(knowledge: ProjectKnowledge): Promise<void> {
        const root = this.workspaceRoot!;
        const topDirs = this.listDirs(root);

        // Well-known directory roles (level 1)
        const knownRoles: Record<string, string> = {
            'src': 'Source code',
            'lib': 'Libraries',
            'app': 'Application code',
            'api': 'API endpoints',
            'pages': 'Page components/routes',
            'components': 'UI components',
            'hooks': 'React hooks',
            'utils': 'Utilities',
            'helpers': 'Helper functions',
            'services': 'Business logic services',
            'models': 'Data models',
            'schemas': 'Data schemas',
            'controllers': 'Route controllers',
            'middleware': 'Middleware',
            'routes': 'Route definitions',
            'views': 'View templates',
            'templates': 'Templates',
            'static': 'Static assets',
            'public': 'Public assets',
            'assets': 'Assets',
            'styles': 'Stylesheets',
            'tests': 'Test files',
            'test': 'Test files',
            '__tests__': 'Test files',
            'spec': 'Test specifications',
            'docs': 'Documentation',
            'scripts': 'Build/utility scripts',
            'config': 'Configuration',
            'migrations': 'Database migrations',
            'fixtures': 'Test fixtures',
            'mocks': 'Mock data/services',
            'benchmarks': 'Performance benchmarks',
            'examples': 'Usage examples',
        };

        for (const dir of topDirs) {
            const known = knownRoles[dir.toLowerCase()];
            if (known) {
                knowledge.architecture.structure[dir] = known;
            }
        }

        // Level 2: Scan subdirectories of main source folders
        // Find the "main package" directory — a top-level dir that shares the project name
        // or is a Python package (has __init__.py), or is src/
        const mainDirs = topDirs.filter(d => {
            const dirPath = path.join(root, d);
            const lower = d.toLowerCase();
            // Is it the project name dir? (e.g., agentvault/ in AgentVault)
            if (lower === knowledge.name.toLowerCase().replace(/[-_\s]/g, '')) { return true; }
            // Is it a Python package?
            if (fs.existsSync(path.join(dirPath, '__init__.py'))) { return true; }
            // Is it src/ or lib/?
            if (lower === 'src' || lower === 'lib' || lower === 'app') { return true; }
            return false;
        });

        for (const mainDir of mainDirs) {
            const mainDirPath = path.join(root, mainDir);
            const subDirs = this.listDirs(mainDirPath);

            for (const sub of subDirs) {
                const subPath = path.join(mainDirPath, sub);
                const role = this.inferDirRole(subPath, sub);
                const key = `${mainDir}/${sub}`;
                knowledge.architecture.structure[key] = role;
            }
        }

        // Detect patterns (using all keys including nested)
        const allKeys = Object.keys(knowledge.architecture.structure).map(k => k.toLowerCase());
        const allValues = Object.values(knowledge.architecture.structure).map(v => v.toLowerCase());

        if (allKeys.some(k => k.includes('controller')) && allKeys.some(k => k.includes('model'))) {
            knowledge.architecture.patterns.push('MVC');
        }
        if (allKeys.some(k => k.includes('service')) || allValues.some(v => v.includes('service'))) {
            knowledge.architecture.patterns.push('Service Layer');
        }
        if (topDirs.some(d => d === 'packages') || topDirs.some(d => d === 'apps')) {
            knowledge.architecture.patterns.push('Monorepo');
        }
        if (knowledge.stack.frameworks.includes('React') && allKeys.some(k => k.includes('component'))) {
            knowledge.architecture.patterns.push('Component-based');
        }
        if (allKeys.some(k => k.includes('api') && k.includes('route'))) {
            knowledge.architecture.patterns.push('REST API');
        }
        if (allKeys.some(k => k.includes('sdk') || k.includes('client'))) {
            knowledge.architecture.patterns.push('SDK/Client Library');
        }

        // Find entry points
        const entryPoints = [
            'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
            'src/app.ts', 'src/app.js', 'index.ts', 'index.js',
            'main.py', 'app.py', 'src/main.py', 'src/app.py',
            'cmd/main.go', 'main.go',
        ];

        for (const entry of entryPoints) {
            if (fs.existsSync(path.join(root, entry))) {
                knowledge.architecture.entryPoints.push(entry);
            }
        }
    }

    /**
     * List non-ignored subdirectories of a path.
     */
    private listDirs(dirPath: string): string[] {
        try {
            return fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(d => d.isDirectory() && !IGNORED_PATTERNS.some(p => d.name.includes(p)))
                .map(d => d.name);
        } catch {
            return [];
        }
    }

    /**
     * Infer the role of a directory based on its name and contents.
     */
    private inferDirRole(dirPath: string, dirName: string): string {
        // Check well-known sub-directory names first
        const nameRoles: Record<string, string> = {
            'core': 'Core engine',
            'api': 'API layer',
            'storage': 'Storage/persistence',
            'processing': 'Data processing',
            'sdk': 'SDK/client library',
            'cli': 'Command-line interface',
            'ui': 'User interface',
            'web': 'Web interface',
            'auth': 'Authentication',
            'config': 'Configuration',
            'utils': 'Utilities',
            'helpers': 'Helper functions',
            'models': 'Data models',
            'schemas': 'Data schemas',
            'routes': 'Route handlers',
            'middleware': 'Middleware',
            'services': 'Business logic',
            'handlers': 'Request handlers',
            'plugins': 'Plugin system',
            'extensions': 'Extensions',
            'multi_agent': 'Multi-agent support',
            'commands': 'Command handlers',
            'capture': 'Data capture',
            'context': 'Context management',
        };

        const knownRole = nameRoles[dirName.toLowerCase()];

        // List files in the directory to refine the description
        let files: string[] = [];
        try {
            files = fs.readdirSync(dirPath)
                .filter(f => !f.startsWith('.') && !f.startsWith('__pycache__'));
        } catch {
            return knownRole || dirName;
        }

        const pyFiles = files.filter(f => f.endsWith('.py') && f !== '__init__.py');
        const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));
        const codeFiles = [...pyFiles, ...tsFiles];

        // Build description from file names
        if (codeFiles.length > 0) {
            const moduleNames = codeFiles
                .map(f => f.replace(/\.(py|ts|js|tsx|jsx)$/, ''))
                .filter(n => n !== 'index' && n !== '__init__')
                .slice(0, 6);

            if (knownRole && moduleNames.length > 0) {
                return `${knownRole} (${moduleNames.join(', ')})`;
            }
            if (moduleNames.length > 0) {
                return moduleNames.join(', ');
            }
        }

        return knownRole || dirName;
    }

    /**
     * Extract coding conventions.
     */
    private async extractConventions(knowledge: ProjectKnowledge): Promise<void> {
        const root = this.workspaceRoot!;

        // === LINTING ===

        // ESLint (JS/TS)
        const eslintFiles = ['.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc', 'eslint.config.js', 'eslint.config.mjs'];
        for (const file of eslintFiles) {
            const filePath = path.join(root, file);
            if (fs.existsSync(filePath)) {
                try {
                    if (file.endsWith('.json')) {
                        knowledge.conventions.linting = { ...knowledge.conventions.linting, eslint: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
                    } else {
                        knowledge.conventions.linting = { ...knowledge.conventions.linting, eslint: { configFile: file } };
                    }
                } catch (e) {
                    knowledge.conventions.linting = { ...knowledge.conventions.linting, eslint: { configFile: file } };
                }
                break;
            }
        }

        // Ruff (Python) — standalone ruff.toml
        const ruffTomlPath = path.join(root, 'ruff.toml');
        if (fs.existsSync(ruffTomlPath)) {
            knowledge.conventions.linting = { ...knowledge.conventions.linting, ruff: { configFile: 'ruff.toml' } };
        }

        // Ruff in pyproject.toml — [tool.ruff]
        const pyprojectPath = path.join(root, 'pyproject.toml');
        if (fs.existsSync(pyprojectPath)) {
            try {
                const content = fs.readFileSync(pyprojectPath, 'utf-8');
                if (content.includes('[tool.ruff]')) {
                    knowledge.conventions.linting = { ...knowledge.conventions.linting, ruff: { configFile: 'pyproject.toml [tool.ruff]' } };
                }
                if (content.includes('[tool.mypy]')) {
                    knowledge.conventions.linting = { ...knowledge.conventions.linting, mypy: { configFile: 'pyproject.toml [tool.mypy]' } };
                }
                if (content.includes('[tool.pylint]')) {
                    knowledge.conventions.linting = { ...knowledge.conventions.linting, pylint: { configFile: 'pyproject.toml [tool.pylint]' } };
                }
            } catch (e) {
                Logger.warn('Failed to read pyproject.toml for conventions:', e);
            }
        }

        // Biome (JS/TS)
        if (fs.existsSync(path.join(root, 'biome.json')) || fs.existsSync(path.join(root, 'biome.jsonc'))) {
            const biomeFile = fs.existsSync(path.join(root, 'biome.json')) ? 'biome.json' : 'biome.jsonc';
            knowledge.conventions.linting = { ...knowledge.conventions.linting, biome: { configFile: biomeFile } };
        }

        // === FORMATTING ===

        // Prettier
        const prettierFiles = ['.prettierrc', '.prettierrc.json', 'prettier.config.js', 'prettier.config.mjs'];
        for (const file of prettierFiles) {
            const filePath = path.join(root, file);
            if (fs.existsSync(filePath)) {
                try {
                    if (file.endsWith('.json') || file === '.prettierrc') {
                        knowledge.conventions.formatting = { ...knowledge.conventions.formatting, prettier: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
                    } else {
                        knowledge.conventions.formatting = { ...knowledge.conventions.formatting, prettier: { configFile: file } };
                    }
                } catch (e) {
                    knowledge.conventions.formatting = { ...knowledge.conventions.formatting, prettier: { configFile: file } };
                }
                break;
            }
        }

        // Black (Python)
        if (fs.existsSync(pyprojectPath)) {
            try {
                const content = fs.readFileSync(pyprojectPath, 'utf-8');
                if (content.includes('[tool.black]')) {
                    knowledge.conventions.formatting = { ...knowledge.conventions.formatting, black: { configFile: 'pyproject.toml [tool.black]' } };
                }
                // Ruff format is configured via [tool.ruff.format]
                if (content.includes('[tool.ruff.format]')) {
                    knowledge.conventions.formatting = { ...knowledge.conventions.formatting, 'ruff-format': { configFile: 'pyproject.toml [tool.ruff.format]' } };
                }
            } catch {
                // already warned above
            }
        }

        // EditorConfig
        if (fs.existsSync(path.join(root, '.editorconfig'))) {
            knowledge.conventions.formatting = { ...knowledge.conventions.formatting, editorconfig: { configFile: '.editorconfig' } };
        }

        // === NAMING CONVENTION ===
        // Sample files from multiple source directories (not just src/)
        const sampleDirs: string[] = [];
        const srcDir = path.join(root, 'src');
        if (fs.existsSync(srcDir)) { sampleDirs.push(srcDir); }
        // Also check project-name directories (e.g., agentvault/)
        const projectDir = path.join(root, knowledge.name.toLowerCase().replace(/[-_\s]/g, ''));
        if (fs.existsSync(projectDir) && projectDir !== srcDir) { sampleDirs.push(projectDir); }
        // Check for Python package dirs (have __init__.py at top level)
        try {
            const topEntries = fs.readdirSync(root, { withFileTypes: true });
            for (const entry of topEntries) {
                if (entry.isDirectory() && !IGNORED_PATTERNS.some(p => entry.name.includes(p))) {
                    const initPy = path.join(root, entry.name, '__init__.py');
                    const entryPath = path.join(root, entry.name);
                    if (fs.existsSync(initPy) && !sampleDirs.includes(entryPath)) {
                        sampleDirs.push(entryPath);
                    }
                }
            }
        } catch { /* ignore */ }

        let allFiles: string[] = [];
        for (const dir of sampleDirs) {
            try {
                const dirFiles = fs.readdirSync(dir).filter(f => !f.startsWith('.') && !f.startsWith('__'));
                allFiles = allFiles.concat(dirFiles);
            } catch { /* ignore */ }
        }

        if (allFiles.length > 0) {
            const camelCase = allFiles.filter(f => /^[a-z][a-zA-Z0-9]*\.[a-z]+$/.test(f)).length;
            const snakeCase = allFiles.filter(f => /^[a-z][a-z0-9_]*\.[a-z]+$/.test(f)).length;
            const kebabCase = allFiles.filter(f => /^[a-z][a-z0-9-]*\.[a-z]+$/.test(f)).length;
            const pascalCase = allFiles.filter(f => /^[A-Z][a-zA-Z0-9]*\.[a-z]+$/.test(f)).length;

            const max = Math.max(camelCase, snakeCase, kebabCase, pascalCase);
            if (max > 0) {
                if (max === pascalCase) { knowledge.conventions.naming = 'PascalCase'; }
                else if (max === camelCase && camelCase > snakeCase) { knowledge.conventions.naming = 'camelCase'; }
                else if (max === kebabCase && kebabCase > snakeCase) { knowledge.conventions.naming = 'kebab-case'; }
                else if (max === snakeCase) { knowledge.conventions.naming = 'snake_case'; }
            }
        }
    }

    /**
     * Find TODO/FIXME comments in the codebase.
     */
    private async findTodos(knowledge: ProjectKnowledge, maxFiles: number = 50): Promise<void> {
        if (!this.workspaceRoot) {return;}

        const todoPattern = /\b(TODO|FIXME|HACK|XXX|BUG)[\s:]+(.+)/gi;
        let filesChecked = 0;

        const walkDir = (dir: string): void => {
            if (filesChecked >= maxFiles) {return;}

            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (filesChecked >= maxFiles) {return;}
                    if (IGNORED_PATTERNS.some(p => entry.name.includes(p))) {continue;}

                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        walkDir(fullPath);
                    } else if (entry.isFile() && /\.(ts|js|py|go|rs|java|tsx|jsx)$/.test(entry.name)) {
                        filesChecked++;
                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            const lines = content.split('\n');
                            for (let i = 0; i < lines.length; i++) {
                                const match = todoPattern.exec(lines[i]);
                                if (match) {
                                    knowledge.todos.push({
                                        file: path.relative(this.workspaceRoot!, fullPath),
                                        line: i + 1,
                                        text: match[2].trim(),
                                    });
                                }
                            }
                        } catch {
                            // Ignore files that can't be read
                        }
                    }
                }
            } catch {
                // Ignore directories that can't be read
            }
        };

        walkDir(this.workspaceRoot);
        knowledge.todos = knowledge.todos.slice(0, 20); // Limit to 20 TODOs
    }

    /**
     * Read an important file and return its content.
     */
    async readImportantFile(filename: string): Promise<string | null> {
        if (!this.workspaceRoot) {return null;}

        const filePath = path.join(this.workspaceRoot, filename);
        if (fs.existsSync(filePath)) {
            try {
                return fs.readFileSync(filePath, 'utf-8');
            } catch {
                return null;
            }
        }
        return null;
    }

    /**
     * Get the project name.
     */
    getProjectName(): string {
        if (!this.workspaceRoot) {return 'unknown';}
        return path.basename(this.workspaceRoot);
    }

    /**
     * Get the workspace root path.
     */
    getWorkspaceRoot(): string | undefined {
        return this.workspaceRoot;
    }
}

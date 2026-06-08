import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { GomiWorkspaceSnapshot } from '../common/gomiTypes';

const execFileAsync = promisify(execFile);

const ignoredDirectories = new Set([
  '.git',
  '.vite',
  '.vitest',
  'artifacts',
  'dist',
  'node_modules',
  'out'
]);

const priorityFiles = new Set([
  'README.md',
  'package.json',
  'product.json',
  'requirements.txt',
  'pyproject.toml',
  'Dockerfile',
  'docker-compose.yml',
  '.env.example'
]);

interface NodeWorkspaceReaderOptions {
  maxFiles?: number;
  openEditors?: string[];
}

export async function readNodeWorkspaceSnapshot(
  workspaceRoot: string,
  options: NodeWorkspaceReaderOptions = {}
): Promise<GomiWorkspaceSnapshot> {
  const maxFiles = options.maxFiles ?? 120;
  const rootName = path.basename(path.resolve(workspaceRoot));
  const files = await collectWorkspaceFiles(workspaceRoot, maxFiles);
  const importantFiles = sortImportantFiles(files);
  const gitSummary = await readGitSummary(workspaceRoot);
  const manifestSummary = await readManifestSummary(workspaceRoot);
  const contentSnippets = await readContentSnippets(workspaceRoot, importantFiles.slice(0, 16));

  return {
    rootName,
    files: [...importantFiles, ...files.filter((file) => !importantFiles.includes(file))].slice(0, maxFiles),
    openEditors: options.openEditors ?? importantFiles.slice(0, 4),
    gitSummary,
    terminalSummary: manifestSummary,
    contentSnippets
  };
}

async function collectWorkspaceFiles(root: string, maxFiles: number): Promise<string[]> {
  const results: string[] = [];

  async function walk(currentDirectory: string) {
    if (results.length >= maxFiles) {
      return;
    }

    let entries;

    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (results.length >= maxFiles) {
        return;
      }

      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        continue;
      }

      const absolutePath = path.join(currentDirectory, entry.name);
      const relativePath = normalizePath(path.relative(root, absolutePath));

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          await walk(absolutePath);
        }
        continue;
      }

      if (entry.isFile()) {
        results.push(relativePath);
      }
    }
  }

  await walk(root);
  return results;
}

function sortImportantFiles(files: string[]): string[] {
  return files
    .filter((file) => priorityFiles.has(path.basename(file)) || file.startsWith('src/vs/workbench/contrib/gomi/'))
    .slice(0, 24);
}

async function readContentSnippets(
  root: string,
  files: string[]
): Promise<GomiWorkspaceSnapshot['contentSnippets']> {
  const snippets: NonNullable<GomiWorkspaceSnapshot['contentSnippets']> = [];

  for (const file of files) {
    const absolutePath = path.join(root, file);

    try {
      const stat = await fs.stat(absolutePath);

      if (!stat.isFile() || stat.size > 120_000) {
        continue;
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      snippets.push({
        filePath: file,
        content: content.slice(0, 12_000),
        language: languageFromPath(file),
        source: 'workspace'
      });
    } catch {
      continue;
    }
  }

  return snippets;
}

async function readGitSummary(root: string): Promise<string> {
  try {
    const [{ stdout: branch }, { stdout: status }] = await Promise.all([
      execFileAsync('git', ['branch', '--show-current'], { cwd: root }),
      execFileAsync('git', ['status', '--short'], { cwd: root })
    ]);
    const branchName = branch.trim() || 'detached';
    const changedFiles = status
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length;

    return `Git branch ${branchName}, ${changedFiles} changed file${changedFiles === 1 ? '' : 's'}.`;
  } catch {
    return 'Git summary unavailable for this workspace.';
  }
}

async function readManifestSummary(root: string): Promise<string> {
  const packageJsonPath = path.join(root, 'package.json');
  const productJsonPath = path.join(root, 'product.json');
  const summaries: string[] = [];

  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    const scriptNames = Object.keys(packageJson.scripts ?? {}).slice(0, 6);
    summaries.push(
      `package.json ${packageJson.name ?? 'unnamed'} with scripts: ${scriptNames.join(', ') || 'none'}.`
    );
  } catch {
    summaries.push('package.json unavailable.');
  }

  try {
    const productJson = JSON.parse(await fs.readFile(productJsonPath, 'utf8')) as {
      nameLong?: string;
      applicationName?: string;
    };
    summaries.push(
      `product.json ${productJson.nameLong ?? 'unnamed'} (${productJson.applicationName ?? 'no app id'}).`
    );
  } catch {
    summaries.push('product.json unavailable.');
  }

  return summaries.join(' ');
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}

function languageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();

  if (!extension) {
    return 'text';
  }

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html'
  };

  return languageMap[extension] ?? extension;
}

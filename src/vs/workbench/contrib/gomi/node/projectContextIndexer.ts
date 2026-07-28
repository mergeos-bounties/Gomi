import { getGitStatusSummary, type GitStatusSummary } from './gitStatusIndexer';
import { formatGitContext } from './gitContextFormatter';
import type {
  GomiWorkspaceContentSnippet,
  GomiWorkspaceSnapshot
} from '../common/gomiTypes';
import type { GomiMemoryScope, GomiMemoryStore } from './memoryStore';
import type { GomiVectorMemoryStore } from './vectorMemoryStore';

export interface GomiProjectContextChunk {
  id: string;
  title: string;
  content: string;
  tags: string[];
  sourcePath?: string;
  sourceType: GomiWorkspaceContentSnippet['source'] | 'manifest' | 'file_tree';
  importance: number;
  metadata?: Record<string, unknown>;
}

export interface GomiProjectContextIndexResult {
  chunkCount: number;
  indexedPaths: string[];
}

export interface GomiProjectContextIndexer {
  indexWorkspace(
    workspace: GomiWorkspaceSnapshot,
    scope: GomiMemoryScope,
    stores: {
      memoryStore: GomiMemoryStore;
      vectorMemoryStore: GomiVectorMemoryStore;
    }
  ): Promise<GomiProjectContextIndexResult>;
}

export class DefaultGomiProjectContextIndexer implements GomiProjectContextIndexer {
  async indexWorkspace(
    workspace: GomiWorkspaceSnapshot,
    scope: GomiMemoryScope,
    stores: {
      memoryStore: GomiMemoryStore;
      vectorMemoryStore: GomiVectorMemoryStore;
    }
  ): Promise<GomiProjectContextIndexResult> {
    const chunks = createWorkspaceContextChunks(workspace);

    await Promise.all(
      chunks.map((chunk) =>
        Promise.all([
          stores.memoryStore.put(scope, {
            key: chunk.id,
            value: chunk.content,
            tags: chunk.tags,
            importance: chunk.importance,
            metadata: chunk.metadata
          }),
          stores.vectorMemoryStore.upsert(scope, {
            key: chunk.id,
            value: chunk.content,
            tags: chunk.tags,
            importance: chunk.importance,
            metadata: chunk.metadata
          })
        ])
      )
    );

    return {
      chunkCount: chunks.length,
      indexedPaths: Array.from(new Set(chunks.map((chunk) => chunk.sourcePath).filter(Boolean) as string[]))
    };
  }
}

export function buildGitContextChunks(
  workspace: GomiWorkspaceSnapshot
): GomiProjectContextChunk[] {
  const chunks: GomiProjectContextChunk[] = [];
  const git = getGitStatusSummary(workspace.rootPath);
  const formatted = formatGitContext(git);

  chunks.push({
    id: 'context:workspace:git-summary',
    title: 'Git summary',
    content: formatted.summaryText || workspace.gitSummary,
    tags: ['workspace', 'git', 'status'],
    sourceType: 'manifest',
    importance: 0.62
  });

  if (formatted.changesDetail) {
    chunks.push({
      id: 'context:workspace:git-changes',
      title: 'Git file changes',
      content: formatted.changesDetail,
      tags: ['workspace', 'git', 'changes'],
      sourceType: 'manifest',
      importance: 0.58,
      metadata: {
        changedFiles: git?.changedFiles,
        stagedFiles: git?.stagedFiles,
        untrackedFiles: git?.untrackedFiles
      }
    });
  }

  return chunks;
}

export function createWorkspaceContextChunks(
  workspace: GomiWorkspaceSnapshot
): GomiProjectContextChunk[] {
  const chunks: GomiProjectContextChunk[] = [
    {
      id: 'context:workspace:file-tree',
      title: 'Workspace file tree',
      content: workspace.files.slice(0, 180).join('\n'),
      tags: ['workspace', 'file-tree', workspace.rootName],
      sourceType: 'file_tree',
      importance: 0.72,
      metadata: {
        rootName: workspace.rootName,
        fileCount: workspace.files.length
      }
    },
    ...buildGitContextChunks(workspace),
    {
      id: 'context:workspace:runtime-summary',
      title: 'Runtime summary',
      content: workspace.terminalSummary,
      tags: ['workspace', 'runtime', 'package', 'scripts'],
      sourceType: 'manifest',
      importance: 0.66
    }
  ];

  for (const snippet of workspace.contentSnippets ?? []) {
    chunks.push(...chunkSnippet(snippet));
  }

  return chunks.filter((chunk) => chunk.content.trim().length > 0);
}

function chunkSnippet(snippet: GomiWorkspaceContentSnippet): GomiProjectContextChunk[] {
  const maxChunkLength = 1800;
  const normalizedContent = snippet.content.replace(/\r\n/g, '\n');
  const chunks: GomiProjectContextChunk[] = [];

  for (let offset = 0; offset < normalizedContent.length; offset += maxChunkLength) {
    const content = normalizedContent.slice(offset, offset + maxChunkLength);
    const chunkIndex = Math.floor(offset / maxChunkLength);

    chunks.push({
      id: `context:${snippet.source}:${snippet.filePath}:${chunkIndex}`,
      title: `${snippet.filePath} chunk ${chunkIndex + 1}`,
      content,
      tags: [
        'workspace-content',
        snippet.source,
        snippet.filePath,
        snippet.language ?? languageFromPath(snippet.filePath)
      ],
      sourcePath: snippet.filePath,
      sourceType: snippet.source,
      importance: snippet.source === 'selection' || snippet.source === 'open_editor' ? 0.92 : 0.78,
      metadata: {
        filePath: snippet.filePath,
        language: snippet.language ?? languageFromPath(snippet.filePath),
        chunkIndex,
        source: snippet.source
      }
    });
  }

  return chunks;
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
    py: 'python',
    php: 'php',
    cs: 'csharp',
    java: 'java',
    go: 'go',
    rs: 'rust',
    css: 'css',
    html: 'html'
  };

  return languageMap[extension] ?? extension;
}





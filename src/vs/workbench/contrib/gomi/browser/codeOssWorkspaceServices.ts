import type { GomiPatchProposal, GomiWorkspaceContentSnippet, GomiWorkspaceSnapshot } from '../common/gomiTypes';
import { applyParsedPatchFile, parseUnifiedDiff } from '../common/gomiUnifiedDiff';
import type { GomiBridgeMessage } from '../electron-sandbox/gomiBridge';
import type { GomiWorkspaceSnapshotReader } from '../node/workspaceReader';
import type { GomiPatchApplyResult } from '../node/workspacePatchApplier';

export interface GomiCodeOssUri {
  fsPath?: string;
  path?: string;
  scheme?: string;
  toString(skipEncoding?: boolean): string;
}

export interface GomiCodeOssWorkspaceFolder {
  name: string;
  uri: GomiCodeOssUri;
  toResource?: (relativePath: string) => GomiCodeOssUri;
}

export interface GomiCodeOssFileStat {
  name?: string;
  resource: GomiCodeOssUri;
  isDirectory?: boolean;
  isFile?: boolean;
  children?: GomiCodeOssFileStat[];
}

export interface GomiCodeOssWorkspaceServices {
  workspaceContextService: {
    getWorkspace(): {
      id?: string;
      name?: string;
      folders: GomiCodeOssWorkspaceFolder[];
    };
  };
  fileService: {
    resolve(resource: GomiCodeOssUri, options?: unknown): Promise<GomiCodeOssFileStat>;
    del?: (resource: GomiCodeOssUri, options?: unknown) => Promise<unknown>;
    delete?: (resource: GomiCodeOssUri, options?: unknown) => Promise<unknown>;
    createFolder?: (resource: GomiCodeOssUri) => Promise<unknown>;
    exists?: (resource: GomiCodeOssUri) => Promise<boolean>;
    readFile?: (resource: GomiCodeOssUri, options?: unknown) => Promise<{ value: { toString(): string } }>;
  };
  textFileService: {
    read?: (resource: GomiCodeOssUri, options?: unknown) => Promise<{ value: string }>;
    write?: (resource: GomiCodeOssUri, value: string, options?: unknown) => Promise<unknown>;
    create?: (
      operations: Array<{
        resource: GomiCodeOssUri;
        value?: string;
        options?: {
          overwrite?: boolean;
        };
      }>
    ) => Promise<unknown>;
  };
  editorService?: {
    activeEditor?: GomiCodeOssEditorInput;
    activeTextEditorControl?: GomiCodeOssTextEditorControl;
    visibleEditors?: readonly GomiCodeOssEditorInput[];
    editors?: readonly GomiCodeOssEditorInput[];
  };
  codeEditorService?: {
    getActiveCodeEditor?: () => GomiCodeOssTextEditorControl | null;
    getFocusedCodeEditor?: () => GomiCodeOssTextEditorControl | null;
  };
  markerService?: {
    read(filter?: unknown): GomiCodeOssMarker[];
  };
  basename?: (resource: GomiCodeOssUri) => string;
  dirname?: (resource: GomiCodeOssUri) => GomiCodeOssUri;
  joinPath?: (resource: GomiCodeOssUri, ...paths: string[]) => GomiCodeOssUri;
  relativePath?: (from: GomiCodeOssUri, to: GomiCodeOssUri) => string | undefined;
}

export interface GomiCodeOssWorkspaceOptions {
  maxFiles?: number;
  maxDepth?: number;
  maxSnippets?: number;
  maxSnippetLength?: number;
  maxDiagnostics?: number;
  maxSelectionLength?: number;
}

interface GomiCodeOssEditorInput {
  resource?: GomiCodeOssUri;
  original?: {
    resource?: GomiCodeOssUri;
  };
  modified?: {
    resource?: GomiCodeOssUri;
  };
  primary?: {
    resource?: GomiCodeOssUri;
  };
  name?: string;
}

interface GomiCodeOssTextEditorControl {
  getModel?: () => GomiCodeOssTextModel | null | undefined;
  getSelection?: () => GomiCodeOssRange | null | undefined;
  getSelections?: () => Array<GomiCodeOssRange | null | undefined> | null | undefined;
}

interface GomiCodeOssTextModel {
  uri?: GomiCodeOssUri;
  getValueInRange?: (range: GomiCodeOssRange) => string;
}

interface GomiCodeOssRange {
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
  isEmpty?: () => boolean;
}

interface GomiCodeOssMarker {
  resource: GomiCodeOssUri;
  severity?: number;
  message: string;
  source?: string;
  code?: string | {
    value: string;
  };
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
}

const DEFAULT_WORKSPACE_OPTIONS: Required<GomiCodeOssWorkspaceOptions> = {
  maxFiles: 220,
  maxDepth: 5,
  maxSnippets: 14,
  maxSnippetLength: 2600,
  maxDiagnostics: 12,
  maxSelectionLength: 2600
};

const IGNORED_PATH_SEGMENTS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  'coverage',
  '.gomi-ide'
]);

const IMPORTANT_FILE_PATTERNS = [
  /^readme(\..*)?$/i,
  /^package\.json$/i,
  /^pnpm-lock\.yaml$/i,
  /^yarn\.lock$/i,
  /^requirements\.txt$/i,
  /^pyproject\.toml$/i,
  /^composer\.json$/i,
  /^go\.mod$/i,
  /^cargo\.toml$/i,
  /^dockerfile$/i,
  /^docker-compose\.(ya?ml)$/i,
  /^\.env\.example$/i,
  /^tsconfig.*\.json$/i,
  /^vite\.config\./i
];

export function createCodeOssWorkspaceSnapshotReader(
  services: GomiCodeOssWorkspaceServices,
  options: GomiCodeOssWorkspaceOptions = {}
): GomiWorkspaceSnapshotReader {
  const resolvedOptions = {
    ...DEFAULT_WORKSPACE_OPTIONS,
    ...options
  };

  return async () => readCodeOssWorkspaceSnapshot(services, resolvedOptions);
}

export async function readCodeOssWorkspaceSnapshot(
  services: GomiCodeOssWorkspaceServices,
  options: Required<GomiCodeOssWorkspaceOptions> = DEFAULT_WORKSPACE_OPTIONS
): Promise<GomiWorkspaceSnapshot> {
  const workspace = services.workspaceContextService.getWorkspace();
  const folders = workspace.folders ?? [];
  const rootName = workspace.name ?? (folders.map((folder) => folder.name).join(', ') || 'Gomi Workspace');
  const files: string[] = [];

  for (const folder of folders) {
    await collectWorkspaceFiles(services, folder, folder.uri, '', files, options);
    if (files.length >= options.maxFiles) {
      break;
    }
  }

  const openEditorResources = collectOpenEditorResources(services);
  const openEditors = uniqueStrings(
    openEditorResources.map((resource) => toWorkspaceRelativePath(services, folders, resource)).filter(Boolean)
  );
  const selectionSnippets = collectSelectionSnippets(services, folders, options);
  const diagnosticSnippets = collectDiagnosticSnippets(services, folders, options);
  const snippetBudget = Math.max(0, options.maxSnippets - selectionSnippets.length - diagnosticSnippets.length);
  const snippetResources = pickSnippetResources(services, folders, files, openEditorResources, {
    ...options,
    maxSnippets: snippetBudget
  });
  const contentSnippets = await readWorkspaceContentSnippets(services, folders, snippetResources, options);
  const allContentSnippets = [
    ...selectionSnippets,
    ...diagnosticSnippets,
    ...contentSnippets
  ].slice(0, options.maxSnippets);

  return {
    rootName,
    files: files.slice(0, options.maxFiles),
    openEditors,
    gitSummary: `Native Code - OSS workspace: ${folders.length} folder(s). SCM diff service is not attached yet.`,
    terminalSummary: `Indexed through Code - OSS workspace, editor, marker, file, and text-file services. ${selectionSnippets.length} selection snippet(s), ${diagnosticSnippets.length} diagnostic snippet(s), ${contentSnippets.length} file snippet(s) loaded.`,
    contentSnippets: allContentSnippets
  };
}

export async function applyCodeOssPatchMessage(
  message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>,
  services: GomiCodeOssWorkspaceServices,
  options: {
    requireApproval?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<GomiPatchApplyResult> {
  return applyCodeOssPatchProposal(message.patch, services, options);
}

export async function applyCodeOssPatchProposal(
  patch: GomiPatchProposal,
  services: GomiCodeOssWorkspaceServices,
  options: {
    requireApproval?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<GomiPatchApplyResult> {
  const requireApproval = options.requireApproval ?? true;

  if (requireApproval && patch.approvalStatus !== 'approved') {
    throw new Error(`Patch ${patch.id} must be approved before it can be applied.`);
  }

  const rootFolder = getPrimaryWorkspaceFolder(services);
  const parsedFiles = parseUnifiedDiff(patch.diff);
  const appliedFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const parsedFile of parsedFiles) {
    const targetPath = parsedFile.newPath ?? parsedFile.oldPath;

    if (!targetPath) {
      throw new Error('Patch file is missing both old and new paths.');
    }

    const resource = resolveWorkspacePatchResource(services, rootFolder, targetPath);
    const existingContent = await readTextFileIfExists(services, resource);
    const nextContent = applyParsedPatchFile(existingContent, parsedFile);

    if (parsedFile.newPath === undefined) {
      deletedFiles.push(toWorkspaceRelativePath(services, [rootFolder], resource));

      if (!options.dryRun) {
        await deleteCodeOssResource(services, resource);
      }

      continue;
    }

    appliedFiles.push(toWorkspaceRelativePath(services, [rootFolder], resource));

    if (!options.dryRun) {
      await ensureParentFolder(services, resource);
      await writeTextResource(services, resource, nextContent, parsedFile.oldPath === undefined);
    }
  }

  return {
    patchId: patch.id,
    dryRun: options.dryRun ?? false,
    appliedFiles,
    deletedFiles
  };
}

async function collectWorkspaceFiles(
  services: GomiCodeOssWorkspaceServices,
  folder: GomiCodeOssWorkspaceFolder,
  resource: GomiCodeOssUri,
  prefix: string,
  files: string[],
  options: Required<GomiCodeOssWorkspaceOptions>,
  depth = 0
): Promise<void> {
  if (files.length >= options.maxFiles || depth > options.maxDepth) {
    return;
  }

  let stat: GomiCodeOssFileStat;

  try {
    stat = await services.fileService.resolve(resource, {
      resolveMetadata: false
    });
  } catch {
    return;
  }

  const children = stat.children ?? [];
  const orderedChildren = [...children].sort((left, right) => {
    if (Boolean(left.isDirectory) !== Boolean(right.isDirectory)) {
      return left.isDirectory ? -1 : 1;
    }

    return getStatName(services, left).localeCompare(getStatName(services, right));
  });

  for (const child of orderedChildren) {
    if (files.length >= options.maxFiles) {
      break;
    }

    const name = getStatName(services, child);

    if (!name || IGNORED_PATH_SEGMENTS.has(name)) {
      continue;
    }

    const relative = prefix ? `${prefix}/${name}` : name;
    const displayPath = folderPrefix(folder, services) ? `${folderPrefix(folder, services)}/${relative}` : relative;

    if (child.isDirectory) {
      await collectWorkspaceFiles(services, folder, child.resource, relative, files, options, depth + 1);
    } else {
      files.push(displayPath);
    }
  }
}

function collectOpenEditorResources(services: GomiCodeOssWorkspaceServices): GomiCodeOssUri[] {
  const editorService = services.editorService;

  if (!editorService) {
    return [];
  }

  const editors = [
    editorService.activeEditor,
    ...(editorService.visibleEditors ?? []),
    ...(editorService.editors ?? [])
  ].filter(Boolean) as GomiCodeOssEditorInput[];
  const resources = editors.flatMap((editor) => [
    editor.resource,
    editor.primary?.resource,
    editor.modified?.resource,
    editor.original?.resource
  ]);
  const activeModelResource = getActiveTextEditorControl(services)?.getModel?.()?.uri;

  return uniqueResources([...resources, activeModelResource].filter(Boolean) as GomiCodeOssUri[]);
}

function collectSelectionSnippets(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  options: Required<GomiCodeOssWorkspaceOptions>
): GomiWorkspaceContentSnippet[] {
  const control = getActiveTextEditorControl(services);
  const model = control?.getModel?.();

  if (!control || !model?.getValueInRange || !model.uri) {
    return [];
  }

  const selections = (control.getSelections?.() ?? [control.getSelection?.()]).filter(Boolean) as GomiCodeOssRange[];
  const snippets: GomiWorkspaceContentSnippet[] = [];

  for (const selection of selections) {
    if (isEmptyRange(selection)) {
      continue;
    }

    const selectedText = model.getValueInRange(selection).slice(0, options.maxSelectionLength);

    if (!selectedText.trim()) {
      continue;
    }

    snippets.push({
      filePath: toWorkspaceRelativePath(services, folders, model.uri),
      content: selectedText,
      language: languageFromPath(toWorkspaceRelativePath(services, folders, model.uri)),
      source: 'selection'
    });
  }

  return snippets.slice(0, options.maxSnippets);
}

function getActiveTextEditorControl(
  services: GomiCodeOssWorkspaceServices
): GomiCodeOssTextEditorControl | undefined {
  return (
    services.codeEditorService?.getFocusedCodeEditor?.() ??
    services.codeEditorService?.getActiveCodeEditor?.() ??
    services.editorService?.activeTextEditorControl ??
    undefined
  );
}

function collectDiagnosticSnippets(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  options: Required<GomiCodeOssWorkspaceOptions>
): GomiWorkspaceContentSnippet[] {
  const markers = services.markerService?.read() ?? [];
  const lines = markers
    .map((marker) => ({
      marker,
      filePath: toWorkspaceRelativePathOrUndefined(services, folders, marker.resource)
    }))
    .filter((item): item is { marker: GomiCodeOssMarker; filePath: string } => Boolean(item.filePath))
    .slice(0, options.maxDiagnostics)
    .map(({ marker, filePath }) => {
      const location = `${filePath}:${marker.startLineNumber ?? 1}:${marker.startColumn ?? 1}`;
      const code = typeof marker.code === 'string' ? marker.code : marker.code?.value;
      const source = marker.source ? `${marker.source}${code ? ` ${code}` : ''}` : code;

      return [
        severityLabel(marker.severity),
        location,
        source ? `[${source}]` : '',
        marker.message
      ].filter(Boolean).join(' ');
    });

  if (lines.length === 0) {
    return [];
  }

  return [
    {
      filePath: 'Code - OSS Diagnostics',
      content: lines.join('\n'),
      language: 'text',
      source: 'diagnostic'
    }
  ];
}

function pickSnippetResources(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  files: string[],
  openEditorResources: GomiCodeOssUri[],
  options: Required<GomiCodeOssWorkspaceOptions>
): Array<{ resource: GomiCodeOssUri; source: GomiWorkspaceContentSnippet['source'] }> {
  const byKey = new Map<string, { resource: GomiCodeOssUri; source: GomiWorkspaceContentSnippet['source'] }>();

  for (const resource of openEditorResources) {
    byKey.set(resourceKey(resource), {
      resource,
      source: 'open_editor'
    });
  }

  for (const filePath of files) {
    if (byKey.size >= options.maxSnippets) {
      break;
    }

    if (!isImportantFile(filePath)) {
      continue;
    }

    const resource = resolveWorkspacePathForRead(services, folders, filePath);

    if (resource) {
      byKey.set(resourceKey(resource), {
        resource,
        source: 'workspace'
      });
    }
  }

  return Array.from(byKey.values()).slice(0, options.maxSnippets);
}

async function readWorkspaceContentSnippets(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  snippetResources: Array<{ resource: GomiCodeOssUri; source: GomiWorkspaceContentSnippet['source'] }>,
  options: Required<GomiCodeOssWorkspaceOptions>
): Promise<GomiWorkspaceContentSnippet[]> {
  const snippets: GomiWorkspaceContentSnippet[] = [];

  for (const item of snippetResources) {
    try {
      const content = await readTextResource(services, item.resource);

      snippets.push({
        filePath: toWorkspaceRelativePath(services, folders, item.resource),
        content: content.slice(0, options.maxSnippetLength),
        language: languageFromPath(toWorkspaceRelativePath(services, folders, item.resource)),
        source: item.source
      });
    } catch {
      continue;
    }
  }

  return snippets;
}

function resolveWorkspacePathForRead(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  displayPath: string
): GomiCodeOssUri | undefined {
  for (const folder of folders) {
    const prefix = folderPrefix(folder, services);
    const pathInFolder = prefix && displayPath.startsWith(`${prefix}/`)
      ? displayPath.slice(prefix.length + 1)
      : displayPath;

    if (folder.toResource) {
      return folder.toResource(pathInFolder);
    }

    if (services.joinPath) {
      return services.joinPath(folder.uri, ...pathInFolder.split('/'));
    }
  }

  return undefined;
}

function resolveWorkspacePatchResource(
  services: GomiCodeOssWorkspaceServices,
  folder: GomiCodeOssWorkspaceFolder,
  patchPath: string
): GomiCodeOssUri {
  assertSafeWorkspacePath(patchPath);

  if (folder.toResource) {
    return folder.toResource(patchPath);
  }

  if (services.joinPath) {
    return services.joinPath(folder.uri, ...patchPath.split('/'));
  }

  throw new Error('Code - OSS joinPath service is required to resolve patch targets.');
}

function getPrimaryWorkspaceFolder(services: GomiCodeOssWorkspaceServices): GomiCodeOssWorkspaceFolder {
  const folder = services.workspaceContextService.getWorkspace().folders[0];

  if (!folder) {
    throw new Error('Open a workspace folder before applying a Gomi patch.');
  }

  return folder;
}

async function readTextFileIfExists(
  services: GomiCodeOssWorkspaceServices,
  resource: GomiCodeOssUri
): Promise<string> {
  try {
    return await readTextResource(services, resource);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return '';
    }

    throw error;
  }
}

async function readTextResource(
  services: GomiCodeOssWorkspaceServices,
  resource: GomiCodeOssUri
): Promise<string> {
  if (services.textFileService.read) {
    const content = await services.textFileService.read(resource, {
      acceptTextOnly: true,
      limits: {
        size: 160_000
      }
    });

    return content.value;
  }

  if (services.fileService.readFile) {
    const content = await services.fileService.readFile(resource, {
      limits: {
        size: 160_000
      }
    });

    return content.value.toString();
  }

  throw new Error('No Code - OSS text reader is available for Gomi workspace context.');
}

async function writeTextResource(
  services: GomiCodeOssWorkspaceServices,
  resource: GomiCodeOssUri,
  content: string,
  isNewFile: boolean
): Promise<void> {
  if (isNewFile && services.textFileService.create) {
    await services.textFileService.create([
      {
        resource,
        value: content,
        options: {
          overwrite: true
        }
      }
    ]);
    return;
  }

  if (!services.textFileService.write) {
    throw new Error('No Code - OSS text writer is available for Gomi patch application.');
  }

  await services.textFileService.write(resource, content, {
    atomic: {
      postfix: '.gomi'
    }
  });
}

async function deleteCodeOssResource(
  services: GomiCodeOssWorkspaceServices,
  resource: GomiCodeOssUri
): Promise<void> {
  const deleteResource = services.fileService.del ?? services.fileService.delete;

  if (!deleteResource) {
    throw new Error('No Code - OSS file delete API is available for Gomi patch application.');
  }

  await deleteResource(resource, {
    recursive: false,
    useTrash: false
  });
}

async function ensureParentFolder(
  services: GomiCodeOssWorkspaceServices,
  resource: GomiCodeOssUri
): Promise<void> {
  if (!services.fileService.createFolder || !services.dirname) {
    return;
  }

  const parent = services.dirname(resource);

  try {
    await services.fileService.createFolder(parent);
  } catch {
    return;
  }
}

function toWorkspaceRelativePath(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  resource: GomiCodeOssUri
): string {
  return toWorkspaceRelativePathOrUndefined(services, folders, resource) ?? getResourcePath(resource);
}

function toWorkspaceRelativePathOrUndefined(
  services: GomiCodeOssWorkspaceServices,
  folders: GomiCodeOssWorkspaceFolder[],
  resource: GomiCodeOssUri
): string | undefined {
  for (const folder of folders) {
    const relative = services.relativePath?.(folder.uri, resource);

    if (relative !== undefined && relative !== null && !relative.startsWith('..')) {
      const prefix = folderPrefix(folder, services);
      return prefix ? `${prefix}/${relative.split('\\').join('/')}` : relative.split('\\').join('/');
    }
  }

  return undefined;
}

function getStatName(services: GomiCodeOssWorkspaceServices, stat: GomiCodeOssFileStat): string {
  return stat.name ?? services.basename?.(stat.resource) ?? getResourcePath(stat.resource).split(/[\\/]/).pop() ?? '';
}

function folderPrefix(folder: GomiCodeOssWorkspaceFolder, services: GomiCodeOssWorkspaceServices): string {
  const workspace = services.workspaceContextService.getWorkspace();
  return workspace.folders.length > 1 ? folder.name : '';
}

function getResourcePath(resource: GomiCodeOssUri): string {
  return resource.fsPath ?? resource.path ?? resource.toString(true);
}

function resourceKey(resource: GomiCodeOssUri): string {
  return resource.toString(true);
}

function uniqueResources(resources: GomiCodeOssUri[]): GomiCodeOssUri[] {
  const seen = new Set<string>();
  const result: GomiCodeOssUri[] = [];

  for (const resource of resources) {
    const key = resourceKey(resource);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(resource);
  }

  return result;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function isImportantFile(filePath: string): boolean {
  const name = filePath.split('/').pop() ?? filePath;
  return IMPORTANT_FILE_PATTERNS.some((pattern) => pattern.test(name));
}

function isEmptyRange(range: GomiCodeOssRange): boolean {
  if (range.isEmpty?.()) {
    return true;
  }

  return (
    range.startLineNumber === range.endLineNumber &&
    range.startColumn === range.endColumn
  );
}

function severityLabel(severity: number | undefined): string {
  if (severity === 8) {
    return 'error';
  }

  if (severity === 4) {
    return 'warning';
  }

  if (severity === 2) {
    return 'info';
  }

  if (severity === 1) {
    return 'hint';
  }

  return 'diagnostic';
}

function assertSafeWorkspacePath(value: string): void {
  const normalized = value.replace(/\\/g, '/');

  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
    throw new Error(`Patch path must be relative to the workspace: ${value}`);
  }

  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error(`Patch path escapes the workspace root: ${value}`);
  }
}

function isFileNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /not\s*found|entrynotfound|filenotfound/i.test(`${error.name} ${error.message}`);
}

function languageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase();

  if (!extension || extension === filePath) {
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
    html: 'html',
    yaml: 'yaml',
    yml: 'yaml'
  };

  return languageMap[extension] ?? extension;
}

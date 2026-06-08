export interface ParsedPatchFile {
  oldPath?: string;
  newPath?: string;
  hunks: ParsedPatchHunk[];
}

export interface ParsedPatchHunk {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: ParsedPatchLine[];
}

export interface ParsedPatchLine {
  kind: 'context' | 'addition' | 'deletion';
  content: string;
}

export function parseUnifiedDiff(diff: string): ParsedPatchFile[] {
  const lines = diff.split(/\r?\n/);
  const files: ParsedPatchFile[] = [];
  let currentFile: ParsedPatchFile | undefined;
  let currentHunk: ParsedPatchHunk | undefined;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      currentFile = {
        oldPath: undefined,
        newPath: undefined,
        hunks: []
      };
      files.push(currentFile);
      currentHunk = undefined;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    if (line.startsWith('--- ')) {
      currentFile.oldPath = parseDiffPath(line.slice(4), 'a');
      continue;
    }

    if (line.startsWith('+++ ')) {
      currentFile.newPath = parseDiffPath(line.slice(4), 'b');
      continue;
    }

    if (line.startsWith('@@ ')) {
      currentHunk = parseHunkHeader(line);
      currentFile.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) {
      continue;
    }

    if (line.startsWith('\\ No newline at end of file')) {
      continue;
    }

    const marker = line[0];
    const content = line.slice(1);

    if (marker === ' ') {
      currentHunk.lines.push({ kind: 'context', content });
    } else if (marker === '+') {
      currentHunk.lines.push({ kind: 'addition', content });
    } else if (marker === '-') {
      currentHunk.lines.push({ kind: 'deletion', content });
    }
  }

  return files.filter((file) => file.hunks.length > 0);
}

export function applyParsedPatchFile(existingContent: string, parsedFile: ParsedPatchFile): string {
  const sourceLines = splitTextLines(existingContent);
  const resultLines: string[] = [];
  let sourceIndex = 0;

  for (const hunk of parsedFile.hunks) {
    const hunkSourceIndex = Math.max(0, hunk.oldStart - 1);

    if (hunkSourceIndex < sourceIndex) {
      throw new Error('Patch hunks overlap or are out of order.');
    }

    resultLines.push(...sourceLines.slice(sourceIndex, hunkSourceIndex));
    sourceIndex = hunkSourceIndex;

    for (const line of hunk.lines) {
      if (line.kind === 'addition') {
        resultLines.push(line.content);
        continue;
      }

      const currentLine = sourceLines[sourceIndex];

      if (currentLine !== line.content) {
        throw new Error(
          `Patch context mismatch at source line ${sourceIndex + 1}. Expected "${line.content}" but found "${currentLine ?? '<end-of-file>'}".`
        );
      }

      if (line.kind === 'context') {
        resultLines.push(currentLine);
      }

      sourceIndex += 1;
    }
  }

  resultLines.push(...sourceLines.slice(sourceIndex));

  return `${resultLines.join('\n')}${resultLines.length > 0 ? '\n' : ''}`;
}

function parseDiffPath(value: string, expectedPrefix: 'a' | 'b'): string | undefined {
  const cleanValue = value.trim().split(/\t/)[0];

  if (cleanValue === '/dev/null') {
    return undefined;
  }

  const expectedPrefixWithSlash = `${expectedPrefix}/`;

  return cleanValue.startsWith(expectedPrefixWithSlash)
    ? cleanValue.slice(expectedPrefixWithSlash.length)
    : cleanValue;
}

function parseHunkHeader(value: string): ParsedPatchHunk {
  const match = /^@@ -(?<oldStart>\d+)(?:,(?<oldCount>\d+))? \+(?<newStart>\d+)(?:,(?<newCount>\d+))? @@/.exec(
    value
  );

  if (!match?.groups) {
    throw new Error(`Invalid unified diff hunk header: ${value}`);
  }

  return {
    oldStart: Number(match.groups.oldStart),
    oldCount: Number(match.groups.oldCount ?? 1),
    newStart: Number(match.groups.newStart ?? 1),
    newCount: Number(match.groups.newCount ?? 1),
    lines: []
  };
}

function splitTextLines(value: string): string[] {
  if (!value) {
    return [];
  }

  const withoutFinalNewline = value.endsWith('\n') ? value.slice(0, -1) : value;

  return withoutFinalNewline.split(/\r?\n/);
}

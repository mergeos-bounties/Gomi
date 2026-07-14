/**
 * Patch risk summary (issue #17).
 * Analyzes a unified diff and produces a human-readable risk assessment.
 */

export interface PatchRiskSummary {
  totalFiles: number;
  addedLines: number;
  removedLines: number;
  sensitivePaths: string[];
  riskScore: 'low' | 'medium' | 'high';
  summary: string;
}

const SENSITIVE_PATH_PATTERNS = [
  /\.env$/i, /\.secret/i, /credentials/i, /password/i,
  /^\.git\//, /package-lock\.json$/, /yarn\.lock$/,
  /node_modules\//, /\.pem$/i, /\.key$/i,
];

export function analyzePatchRisk(diff: string, filePaths: string[] = []): PatchRiskSummary {
  const lines = diff.split('\n');
  let addedLines = 0;
  let removedLines = 0;

  // Count file headers
  const fileHeaders = new Set<string>();
  for (const line of lines) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (match) {
      fileHeaders.add(match[1]);
      fileHeaders.add(match[2]);
    }
    if (line.startsWith('+') && !line.startsWith('+++')) addedLines++;
    if (line.startsWith('-') && !line.startsWith('---')) removedLines++;
  }

  const allPaths = [...new Set([...fileHeaders, ...filePaths])];

  // Detect sensitive paths
  const sensitivePaths = allPaths.filter((p) =>
    SENSITIVE_PATH_PATTERNS.some((pattern) => pattern.test(p))
  );

  // Risk scoring
  let riskScore: 'low' | 'medium' | 'high' = 'low';
  if (sensitivePaths.length > 0) riskScore = 'high';
  else if (addedLines + removedLines > 200) riskScore = 'high';
  else if (addedLines + removedLines > 50) riskScore = 'medium';
  else if (allPaths.length > 5) riskScore = 'medium';

  const summaryParts: string[] = [];
  summaryParts.push(`${allPaths.length} file(s)`);
  summaryParts.push(`+${addedLines}/-${removedLines} lines`);
  if (sensitivePaths.length > 0) {
    summaryParts.push(`${sensitivePaths.length} sensitive path(s)`);
  }
  summaryParts.push(`risk: ${riskScore}`);

  return {
    totalFiles: allPaths.length,
    addedLines,
    removedLines,
    sensitivePaths,
    riskScore,
    summary: summaryParts.join(', '),
  };
}

/**
 * Windows desktop first-run checklist (issue #70).
 */

export interface WindowsChecklistItem {
  id: string;
  label: string;
  required: boolean;
  hint: string;
}

export function getWindowsFirstRunChecklist(): WindowsChecklistItem[] {
  return [
    {
      id: 'node',
      label: 'Node.js 22 installed',
      required: true,
      hint: 'Download from https://nodejs.org (LTS). Run node --version to verify.',
    },
    {
      id: 'git',
      label: 'Git installed',
      required: true,
      hint: 'Download from https://git-scm.com. Required for cloning and version tracking.',
    },
    {
      id: 'powershell',
      label: 'PowerShell 5.1+ available',
      required: true,
      hint: 'Pre-installed on Windows 10+. Run $PSVersionTable.PSVersion to check.',
    },
    {
      id: 'execution-policy',
      label: 'PowerShell execution policy allows scripts',
      required: true,
      hint: 'Run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser',
    },
    {
      id: 'vs-build-tools',
      label: 'Visual Studio Build Tools (for native modules)',
      required: false,
      hint: 'Install "Desktop development with C++" workload from https://visualstudio.microsoft.com/downloads/',
    },
    {
      id: 'code-oss-fork',
      label: 'Code - OSS fork cloned locally',
      required: false,
      hint: 'Use scripts/bootstrap-gomi-code-oss-fork.ps1 to set up.',
    },
    {
      id: 'disk-space',
      label: 'At least 10 GB free disk space',
      required: true,
      hint: 'Code - OSS build requires significant disk space.',
    },
  ];
}

export function formatChecklist(checklist: WindowsChecklistItem[]): string {
  return checklist
    .map((item) => {
      const icon = item.required ? '[REQUIRED]' : '[OPTIONAL]';
      return `- ${icon} ${item.label}\n  ${item.hint}`;
    })
    .join('\n\n');
}

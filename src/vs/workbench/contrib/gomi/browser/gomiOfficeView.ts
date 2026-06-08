import {
  GOMI_COMMAND_OPEN_OFFICE,
  GOMI_COMMAND_RUN_AGENT_TASK,
  GOMI_COMMAND_STOP_AGENT_TASK,
  GOMI_VIEW_ID
} from '../common/gomiConstants';

export const GOMI_OFFICE_VIEW_DESCRIPTOR = {
  id: GOMI_VIEW_ID,
  title: 'Gomi Office',
  containerTitle: 'Gomi Multi-Agent Office',
  activityBarCommand: GOMI_COMMAND_OPEN_OFFICE,
  commands: [GOMI_COMMAND_OPEN_OFFICE, GOMI_COMMAND_RUN_AGENT_TASK, GOMI_COMMAND_STOP_AGENT_TASK]
} as const;

export function createGomiOfficeWebviewHtml(scriptUri: string, styleUri: string): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<link rel="stylesheet" href="${styleUri}">`,
    '<title>Gomi Multi-Agent Office</title>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    `<script type="module" src="${scriptUri}"></script>`,
    '</body>',
    '</html>'
  ].join('');
}

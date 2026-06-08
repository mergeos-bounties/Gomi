import type { GomiAgentId, GomiTask, GomiWorkspaceSnapshot } from '../common/gomiTypes';

const agentTaskTemplates: Record<GomiAgentId, { title: string; detail: string }> = {
  ceo: {
    title: 'Coordinate delivery plan',
    detail: 'Split request, track agent work, and prepare final synthesis.'
  },
  'system-analyst': {
    title: 'Map project requirements',
    detail: 'Read project structure and identify modules, risks, and integration points.'
  },
  backend: {
    title: 'Review backend surface',
    detail: 'Inspect API, service, model, and controller responsibilities.'
  },
  frontend: {
    title: 'Design workbench experience',
    detail: 'Prepare Gomi Office panel, agent statuses, task queue, and report layout.'
  },
  database: {
    title: 'Check data model',
    detail: 'Review schema, migrations, storage needs, and memory persistence.'
  },
  qa: {
    title: 'Build QA checklist',
    detail: 'Find logic risks and define verification gates for the patch.'
  },
  devops: {
    title: 'Prepare build path',
    detail: 'Check scripts, packaging, registry, and runtime environment.'
  }
};

export class GomiTaskPlanner {
  createPlan(request: string, workspace: GomiWorkspaceSnapshot): GomiTask[] {
    const normalizedRequest = request.toLowerCase();
    const selectedAgents = new Set<GomiAgentId>(['system-analyst', 'frontend', 'qa']);

    if (this.matchesAny(normalizedRequest, ['api', 'backend', 'controller', 'service', 'login'])) {
      selectedAgents.add('backend');
    }

    if (this.matchesAny(normalizedRequest, ['database', 'schema', 'migration', 'sqlite', 'model'])) {
      selectedAgents.add('database');
    }

    if (this.matchesAny(normalizedRequest, ['deploy', 'build', 'docker', 'ci', 'package'])) {
      selectedAgents.add('devops');
    }

    if (selectedAgents.size < 5) {
      selectedAgents.add('backend');
      selectedAgents.add('database');
      selectedAgents.add('devops');
    }

    return Array.from(selectedAgents).map((agentId, index) => {
      const template = agentTaskTemplates[agentId];
      const contextDetail = `${template.detail} Workspace files in context: ${workspace.files.length}.`;

      return {
        id: `task-${index + 1}-${agentId}`,
        title: template.title,
        detail: contextDetail,
        agentId,
        status: 'queued',
        progress: 0
      };
    });
  }

  private matchesAny(value: string, keywords: string[]): boolean {
    return keywords.some((keyword) => value.includes(keyword));
  }
}

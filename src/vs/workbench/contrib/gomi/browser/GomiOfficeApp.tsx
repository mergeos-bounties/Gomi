import { useMemo, useState } from 'react';
import {
  Bot,
  Braces,
  CheckCircle2,
  ClipboardList,
  Code2,
  Database,
  Files,
  GitBranch,
  Play,
  Search,
  Send,
  Settings,
  Sparkles,
  Terminal,
  Users
} from 'lucide-react';
import { BASE_GOMI_AGENTS, GOMI_SAMPLE_REQUEST } from '../common/gomiConstants';
import type {
  GomiAgent,
  GomiAgentId,
  GomiChatMessage,
  GomiFinalReport,
  GomiPatchProposal,
  GomiTask,
  GomiWorkspaceSnapshot
} from '../common/gomiTypes';
import { GomiAgentRuntime } from '../node/agentRuntime';
import { PhaserOffice } from './PhaserOffice';

const activityItems = [
  { id: 'explorer', label: 'Explorer', Icon: Files },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'source-control', label: 'Source Control', Icon: GitBranch },
  { id: 'run', label: 'Run', Icon: Play },
  { id: 'gomi-office', label: 'Gomi Office', Icon: Bot },
  { id: 'settings', label: 'Settings', Icon: Settings }
];

export function GomiOfficeApp() {
  const runtime = useMemo(() => new GomiAgentRuntime({ delayMs: 360 }), []);
  const [request, setRequest] = useState(GOMI_SAMPLE_REQUEST);
  const [isRunning, setIsRunning] = useState(false);
  const [agents, setAgents] = useState<GomiAgent[]>(BASE_GOMI_AGENTS);
  const [tasks, setTasks] = useState<GomiTask[]>([]);
  const [messages, setMessages] = useState<GomiChatMessage[]>([]);
  const [report, setReport] = useState<GomiFinalReport | undefined>();
  const [patch, setPatch] = useState<GomiPatchProposal | undefined>();
  const [workspace, setWorkspace] = useState<GomiWorkspaceSnapshot | undefined>();

  async function runOfficeSession() {
    const trimmedRequest = request.trim();

    if (!trimmedRequest || isRunning) {
      return;
    }

    setIsRunning(true);
    setAgents(BASE_GOMI_AGENTS);
    setTasks([]);
    setMessages([]);
    setReport(undefined);
    setPatch(undefined);

    try {
      for await (const event of runtime.run(trimmedRequest)) {
        if (event.type === 'session_started') {
          setWorkspace(event.workspace);
        }

        if (event.type === 'agent_status') {
          setAgents((currentAgents) =>
            currentAgents.map((agent) =>
              agent.id === event.agentId
                ? { ...agent, status: event.status, currentTaskId: event.currentTaskId }
                : agent
            )
          );
        }

        if (event.type === 'message') {
          setMessages((currentMessages) => [...currentMessages, event.message]);
        }

        if (event.type === 'task_update') {
          setTasks((currentTasks) => upsertTask(currentTasks, event.task));
        }

        if (event.type === 'patch') {
          setPatch(event.patch);
        }

        if (event.type === 'report') {
          setReport(event.report);
        }
      }
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="gomi-shell">
      <header className="gomi-titlebar">
        <div className="gomi-titlebar__brand">
          <span className="gomi-logo">G</span>
          <strong>Gomi IDE</strong>
          <nav className="gomi-titlebar__menu" aria-label="Gomi IDE menu">
            <span>File</span>
            <span>Edit</span>
            <span>Selection</span>
            <span>Terminal</span>
            <span>Gomi</span>
          </nav>
        </div>
        <div className="gomi-titlebar__actions">
          <span>Open VSX</span>
          <span>Code - OSS fork scaffold</span>
        </div>
      </header>

      <div className="gomi-workbench">
        <ActivityBar />
        <ProjectSidebar workspace={workspace} />

        <main className="gomi-main">
          <div className="gomi-tabs">
            <div className="gomi-tab">
              <Bot size={16} />
              <span>Gomi Office</span>
            </div>
          </div>

          <section className="gomi-request" aria-label="Project Request">
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              aria-label="Project Request"
              spellCheck={false}
            />
            <button className="gomi-send" onClick={runOfficeSession} disabled={isRunning}>
              <Send size={17} />
              <span>{isRunning ? 'Running' : 'Run CEO'}</span>
            </button>
          </section>

          <section className="gomi-office-stage" aria-label="Gomi Office Simulation">
            <PhaserOffice agents={agents} tasks={tasks} messages={messages} />
          </section>

          <section className="gomi-bottom">
            <ChatLog messages={messages} />
            <FinalReport report={report} patch={patch} />
          </section>
        </main>

        <RightPanel agents={agents} tasks={tasks} report={report} />
      </div>

      <footer className="gomi-statusbar">
        <span>Gomi Office Runtime</span>
        <span>{isRunning ? 'Agents working' : 'Ready'}</span>
      </footer>
    </div>
  );
}

function ActivityBar() {
  return (
    <aside className="gomi-activitybar" aria-label="Activity Bar">
      {activityItems.map((item) => (
        <button
          className={`gomi-icon-button ${item.id === 'gomi-office' ? 'is-active' : ''}`}
          key={item.id}
          title={item.label}
          aria-label={item.label}
        >
          <item.Icon size={20} />
        </button>
      ))}
    </aside>
  );
}

function ProjectSidebar({ workspace }: { workspace?: GomiWorkspaceSnapshot }) {
  const files = workspace?.files ?? [
    'product.json',
    'src/vs/workbench/contrib/gomi',
    'resources/gomi-icon.svg'
  ];

  return (
    <aside className="gomi-sidebar" aria-label="Gomi Office Sidebar">
      <div className="gomi-panel-header">
        <span>Gomi Office</span>
        <Sparkles size={16} />
      </div>
      <div className="gomi-panel-body">
        <div className="gomi-project-row">
          <div className="gomi-project-name">{workspace?.rootName ?? 'Gomi'}</div>
          <div className="gomi-project-detail">
            {workspace?.gitSummary ?? 'MVP scaffold for Code - OSS integration.'}
          </div>
        </div>

        <div className="gomi-project-row">
          <div className="gomi-project-name">Project Context</div>
          <div className="gomi-chip-row">
            {files.slice(0, 6).map((file) => (
              <span className="gomi-chip" key={file}>
                {file}
              </span>
            ))}
          </div>
        </div>

        <div className="gomi-project-row">
          <div className="gomi-project-name">Agent Runtime</div>
          <div className="gomi-project-detail">
            CEO planner, message bus, event stream, patch proposal, final report.
          </div>
        </div>
      </div>
    </aside>
  );
}

function RightPanel({
  agents,
  tasks,
  report
}: {
  agents: GomiAgent[];
  tasks: GomiTask[];
  report?: GomiFinalReport;
}) {
  return (
    <aside className="gomi-right-panel" aria-label="Agent Status Panel">
      <div className="gomi-panel-header">
        <span>Agents</span>
        <Users size={16} />
      </div>
      <div className="gomi-panel-body">
        {agents.map((agent) => (
          <AgentRow agent={agent} key={agent.id} />
        ))}

        <div className="gomi-panel-header">
          <span>Task Queue</span>
          <ClipboardList size={16} />
        </div>
        {tasks.length === 0 ? (
          <div className="gomi-project-row">
            <div className="gomi-project-detail">No active tasks.</div>
          </div>
        ) : (
          tasks.map((task) => <TaskRow task={task} key={task.id} />)
        )}

        <div className="gomi-panel-header">
          <span>Final</span>
          <CheckCircle2 size={16} />
        </div>
        <div className="gomi-project-row">
          <div className="gomi-project-detail">
            {report?.summary ?? 'Waiting for CEO Agent synthesis.'}
          </div>
        </div>
      </div>
    </aside>
  );
}

function AgentRow({ agent }: { agent: GomiAgent }) {
  const Icon = iconForAgent(agent.id);

  return (
    <div className="gomi-agent-row">
      <div className="gomi-agent-avatar">
        <Icon size={17} />
      </div>
      <div className="gomi-agent-meta">
        <div className="gomi-agent-name">{agent.name}</div>
        <div className="gomi-agent-role">{agent.role}</div>
      </div>
      <span className="gomi-status" data-status={agent.status}>
        {agent.status}
      </span>
    </div>
  );
}

function TaskRow({ task }: { task: GomiTask }) {
  return (
    <div className="gomi-task-row">
      <div className="gomi-task-title">{task.title}</div>
      <div className="gomi-task-detail">{task.detail}</div>
      <div className="gomi-progress" aria-label={`${task.title} progress`}>
        <span style={{ width: `${task.progress}%` }} />
      </div>
      <span className="gomi-status" data-status={task.status}>
        {task.status}
      </span>
    </div>
  );
}

function ChatLog({ messages }: { messages: GomiChatMessage[] }) {
  return (
    <div className="gomi-log">
      <div className="gomi-panel-header">
        <span>Agent Chat Log</span>
        <Bot size={16} />
      </div>
      <div className="gomi-scroll">
        {messages.length === 0 ? (
          <div className="gomi-report-empty">No messages yet.</div>
        ) : (
          messages.map((message) => (
            <div className="gomi-message" key={message.id}>
              <div className="gomi-message__head">
                <span>{message.senderName}</span>
                <time>{message.createdAt}</time>
              </div>
              <div className="gomi-message__body">{message.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FinalReport({
  report,
  patch
}: {
  report?: GomiFinalReport;
  patch?: GomiPatchProposal;
}) {
  return (
    <div className="gomi-report">
      <div className="gomi-panel-header">
        <span>Final Report</span>
        <ClipboardList size={16} />
      </div>
      <div className="gomi-scroll">
        {!report ? (
          <div className="gomi-report-empty">Waiting for report.</div>
        ) : (
          <>
            <div className="gomi-project-row">
              <div className="gomi-project-name">{report.summary}</div>
            </div>
            {report.sections.map((section) => (
              <div className="gomi-project-row" key={section.title}>
                <div className="gomi-project-name">{section.title}</div>
                {section.lines.map((line) => (
                  <div className="gomi-report-line" key={line}>
                    {line}
                  </div>
                ))}
              </div>
            ))}
            {patch ? (
              <div className="gomi-project-row">
                <div className="gomi-project-name">{patch.filePath}</div>
                <div className="gomi-project-detail">{patch.summary}</div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function upsertTask(tasks: GomiTask[], nextTask: GomiTask): GomiTask[] {
  const taskExists = tasks.some((task) => task.id === nextTask.id);

  if (!taskExists) {
    return [...tasks, nextTask];
  }

  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

function iconForAgent(agentId: GomiAgentId) {
  if (agentId === 'backend') {
    return Braces;
  }

  if (agentId === 'frontend') {
    return Code2;
  }

  if (agentId === 'database') {
    return Database;
  }

  if (agentId === 'qa') {
    return CheckCircle2;
  }

  if (agentId === 'devops') {
    return Terminal;
  }

  return Bot;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Braces,
  CheckCircle2,
  ClipboardPaste,
  ClipboardList,
  Code2,
  Database,
  Download,
  Bed,
  FileDiff,
  Files,
  FolderOpen,
  GitBranch,
  Maximize2,
  Minimize2,
  Upload,
  Moon,
  PanelBottomClose,
  PanelBottomOpen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Plus,
  Play,
  RotateCcw,
  Save,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Terminal,
  Trash2,
  UserPlus,
  UserX,
  Users,
  XCircle
} from 'lucide-react';
import { BASE_GOMI_AGENTS, GOMI_SAMPLE_REQUEST } from '../common/gomiConstants';
import {
  GOMI_AVATAR_STYLE_OPTIONS,
  GOMI_AGENT_CLI_PROVIDERS,
  GOMI_HIRABLE_DEPARTMENT_IDS,
  GOMI_MEMORY_EMBEDDING_PROVIDERS,
  assignSeatProvider,
  deletePromptTemplate,
  fireEmployee,
  getMemoryEmbeddingProviderLabel,
  getProviderLabel,
  getSeatForAgent,
  hireEmployee,
  rememberRecentProject,
  removeRecentProject,
  setCliProvidersEnabled,
  setHttpProvidersEnabled,
  setHttpProviderMaxRetries,
  setLiveProviderMode,
  setLiveProviderPatchApprovalRequired,
  setMaxConcurrentAgentRuns,
  setMaxProjectMemoryItems,
  setMemoryBroadcastThreshold,
  setMemoryEmbeddingExecutionEnabled,
  setMemoryEmbeddingProvider,
  setMemoryPrivacyMode,
  setMemoryRetentionDays,
  setAvatarStyle,
  setPatchApprovalRequired,
  setSeatWorkMode,
  savePromptTemplate,
  setSecretRedactionEnabled,
  setSharedMemoryEnabled,
  setTerminalSnippetIndexing,
  simulateStaffingScenario,
  setWorkspaceTrustState,
  setWorkspaceContextIndexing
} from '../common/gomiOfficeSettings';
import type {
  GomiAgent,
  GomiAgentCliProviderId,
  GomiAvatarStyle,
  GomiAgentId,
  GomiAgentSeat,
  GomiChatMessage,
  GomiFinalReport,
  GomiUsageSummary,
  GomiLiveProviderMode,
  GomiMemoryBoardItem,
  GomiMemoryEmbeddingProviderId,
  GomiMemoryPrivacyMode,
  GomiOfficeSettings,
  GomiRecentProject,
  GomiRuntimeEvent,
  GomiTask,
  GomiWorkspaceTrustState,
  GomiWorkspaceSnapshot
} from '../common/gomiTypes';
import { GomiAgentRuntime, type GomiRuntimeMemoryPruneReport } from '../node/agentRuntime';
import {
  approvePatchReview,
  canApplyPatch,
  createPatchReviewState,
  getDiffLineKind,
  markPatchApplied,
  markPatchApplying,
  markPatchFailed,
  markPatchPreviewFailed,
  markPatchPreviewOpened,
  markPatchPreviewOpening,
  rejectPatchReview,
  type GomiPatchReviewState
} from './gomiPatchApproval';
import {
  loadPersistedOfficeSettings,
  persistOfficeSettings
} from './gomiOfficeSettingsPersistence';
import {
  exportSettingsToJson,
  importSettingsFromJson
} from '../common/gomiOfficeSettingsExport';
import {
  buildSettingsSearchIndex,
  matchesSettingsSearch,
  searchSettings
} from '../common/settingsSearch';
import { resolveGomiWebviewBridgeContext } from './gomiWebviewBridge';
import { PhaserOffice } from './PhaserOffice';
import { formatGomiTaskStatusLabel } from './gomiTaskView';
import { GomiKeyboardShortcuts } from './GomiKeyboardShortcuts';
import {
  enqueueStatusToast,
  type GomiStatusToast
} from './gomiStatusToasts';

const activityItems = [
  { id: 'explorer', label: 'Explorer', Icon: Files },
  { id: 'search', label: 'Search', Icon: Search },
  { id: 'source-control', label: 'Source Control', Icon: GitBranch },
  { id: 'run', label: 'Run', Icon: Play },
  { id: 'gomi-office', label: 'Gomi Office', Icon: Bot },
  { id: 'settings', label: 'Settings', Icon: Settings }
];

type GomiOfficeViewMode = 'standard' | 'expanded' | 'full-office';

const officeViewModes = [
  { id: 'standard', label: 'Standard office layout', Icon: Minimize2 },
  { id: 'expanded', label: 'Expanded office layout', Icon: PanelLeftClose },
  { id: 'full-office', label: 'Full office layout', Icon: Maximize2 }
] satisfies Array<{
  id: GomiOfficeViewMode;
  label: string;
  Icon: typeof Minimize2;
}>;

const COMPACT_AGENT_PANEL_QUERY = '(max-width: 1180px)';

export function GomiOfficeApp() {
  const workbenchContext = useMemo(() => resolveGomiWebviewBridgeContext(), []);
  const [officeSettings, setOfficeSettings] = useState<GomiOfficeSettings>(() =>
    loadPersistedOfficeSettings({
      stateStore: workbenchContext?.stateStore
    })
  );
  const runtime = useMemo(
    () =>
      new GomiAgentRuntime({
        delayMs: 360,
        officeSettings
      }),
    [officeSettings]
  );
  const workbenchBridge = workbenchContext?.bridge;
  const localAbortControllerRef = useRef<AbortController | null>(null);
  const agentStatusesRef = useRef(new Map(BASE_GOMI_AGENTS.map((agent) => [agent.id, agent.status])));
  const nextToastIdRef = useRef(1);
  const [request, setRequest] = useState(GOMI_SAMPLE_REQUEST);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState('');
  const [promptTemplateTitle, setPromptTemplateTitle] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [agents, setAgents] = useState<GomiAgent[]>(() =>
    applyOfficeSettingsToAgents(BASE_GOMI_AGENTS, officeSettings)
  );
  const [tasks, setTasks] = useState<GomiTask[]>([]);
  const [messages, setMessages] = useState<GomiChatMessage[]>([]);
  const [memoryItems, setMemoryItems] = useState<GomiMemoryBoardItem[]>([]);
  const [report, setReport] = useState<GomiFinalReport | undefined>();
  const [patchReview, setPatchReview] = useState<GomiPatchReviewState | undefined>();
  const [workspace, setWorkspace] = useState<GomiWorkspaceSnapshot | undefined>();
  const [memoryPruneReport, setMemoryPruneReport] = useState<GomiRuntimeMemoryPruneReport | undefined>();
  const [memoryPruneError, setMemoryPruneError] = useState<string | undefined>();
  const [isPruningMemory, setIsPruningMemory] = useState(false);
  const [statusToasts, setStatusToasts] = useState<GomiStatusToast[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(() => isCompactAgentPanelViewport());
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [officeViewMode, setOfficeViewMode] = useState<GomiOfficeViewMode>('standard');
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const sidePanelsAutoCollapsed = officeViewMode !== 'standard';
  const bottomAutoCollapsed = officeViewMode === 'full-office';
  const effectiveSidebarCollapsed = sidebarCollapsed || sidePanelsAutoCollapsed;
  const effectiveRightPanelCollapsed = rightPanelCollapsed || sidePanelsAutoCollapsed;
  const effectiveBottomCollapsed = bottomCollapsed || bottomAutoCollapsed;
  const isFullOffice = officeViewMode === 'full-office';
  const selectedPromptTemplate = useMemo(
    () =>
      officeSettings.promptTemplates.find(
        (promptTemplate) => promptTemplate.id === selectedPromptTemplateId
      ),
    [officeSettings.promptTemplates, selectedPromptTemplateId]
  );
  const visualAgents = useMemo(
    () => applyOfficeSettingsToAgents(agents, officeSettings),
    [agents, officeSettings]
  );
  const shellClassName = [
    'gomi-shell',
    isFullOffice ? 'is-full-office' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const workbenchClassName = [
    'gomi-workbench',
    effectiveSidebarCollapsed ? 'is-sidebar-collapsed' : '',
    effectiveRightPanelCollapsed ? 'is-right-collapsed' : '',
    officeViewMode === 'expanded' ? 'is-view-expanded' : '',
    isFullOffice ? 'is-view-full-office' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const mainClassName = [
    'gomi-main',
    effectiveBottomCollapsed ? 'is-bottom-collapsed' : '',
    officeViewMode === 'expanded' ? 'is-view-expanded' : '',
    isFullOffice ? 'is-view-full-office' : ''
  ]
    .filter(Boolean)
    .join(' ');
  const officeLayoutToken = [
    effectiveSidebarCollapsed,
    effectiveRightPanelCollapsed,
    effectiveBottomCollapsed,
    officeViewMode
  ].join(':');

  useEffect(() => {
    if (!workbenchBridge) {
      return undefined;
    }

    return workbenchBridge.onMessage((message) => {
      if (message.type === 'gomi.event') {
        applyRuntimeEvent(message.event);

        if (message.event.type === 'session_completed' || message.event.type === 'session_stopped') {
          setIsRunning(false);
        }
      }

      if (message.type === 'gomi.applyPatchResult') {
        setPatchReview((currentReview) => {
          if (!currentReview || currentReview.patch.id !== message.patchId) {
            return currentReview;
          }

          if (message.error) {
            return markPatchFailed(currentReview, message.error);
          }

          return markPatchApplied(currentReview);
        });
      }

      if (message.type === 'gomi.previewPatchResult') {
        setPatchReview((currentReview) => {
          if (!currentReview || currentReview.patch.id !== message.patchId) {
            return currentReview;
          }

          if (message.error || !message.result) {
            return markPatchPreviewFailed(currentReview, message.error ?? 'Native patch preview failed.');
          }

          return markPatchPreviewOpened(currentReview, message.result);
        });
      }

      if (message.type === 'gomi.pruneMemoryResult') {
        setIsPruningMemory(false);

        if (message.error || !message.report) {
          setMemoryPruneError(message.error ?? 'Memory prune did not return a report.');
          return;
        }

        setMemoryPruneError(undefined);
        setMemoryPruneReport(message.report);
      }
    });
  }, [workbenchBridge]);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia?.(COMPACT_AGENT_PANEL_QUERY);

    if (!mediaQuery) {
      return undefined;
    }

    const syncPanelState = () => {
      setRightPanelCollapsed(mediaQuery.matches);
    };

    syncPanelState();
    mediaQuery.addEventListener?.('change', syncPanelState);

    return () => {
      mediaQuery.removeEventListener?.('change', syncPanelState);
    };
  }, []);

  useEffect(() => {
    persistOfficeSettings(officeSettings, {
      stateStore: workbenchContext?.stateStore
    });
  }, [officeSettings, workbenchContext]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle help overlay with ? key
      if (e.key === '?' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        setShowKeyboardShortcuts((prev) => !prev);
      }

      // Close help overlay with Escape key
      if (e.key === 'Escape') {
        setShowKeyboardShortcuts(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function runOfficeSession() {
    const trimmedRequest = request.trim();

    if (!trimmedRequest || isRunning) {
      return;
    }

    setIsRunning(true);
    setAgents(applyOfficeSettingsToAgents(BASE_GOMI_AGENTS, officeSettings));
    setTasks([]);
    setMessages([]);
    setMemoryItems([]);
    setReport(undefined);
    setPatchReview(undefined);
    setWorkspace(undefined);
    setStatusToasts([]);
    agentStatusesRef.current = new Map(BASE_GOMI_AGENTS.map((agent) => [agent.id, agent.status]));

    if (workbenchBridge) {
      workbenchBridge.postMessage({
        type: 'gomi.run',
        request: trimmedRequest,
        officeSettings
      });
      return;
    }

    try {
      const abortController = new AbortController();
      localAbortControllerRef.current = abortController;

      for await (const event of runtime.run(trimmedRequest, {
        signal: abortController.signal,
        stopReason: 'Gomi Office session stopped from the office controls.'
      })) {
        applyRuntimeEvent(event);
      }
    } finally {
      localAbortControllerRef.current = null;
      setIsRunning(false);
    }
  }

  function stopOfficeSession() {
    if (!isRunning) {
      return;
    }

    if (workbenchBridge) {
      workbenchBridge.postMessage({
        type: 'gomi.stop',
        reason: 'Gomi Office session stopped from the office controls.'
      });
      return;
    }

    localAbortControllerRef.current?.abort('Gomi Office session stopped from the office controls.');
  }

  function selectPromptTemplate(templateId: string) {
    const template = officeSettings.promptTemplates.find(
      (promptTemplate) => promptTemplate.id === templateId
    );

    setSelectedPromptTemplateId(template?.id ?? '');
    setPromptTemplateTitle(template?.title ?? '');
  }

  function startNewPromptTemplate() {
    setSelectedPromptTemplateId('');
    setPromptTemplateTitle(promptTemplateTitleFromBody(request));
  }

  function saveCurrentPromptTemplate() {
    const body = request.trim();

    if (!body) {
      return;
    }

    const templateId = selectedPromptTemplate?.id ?? createPromptTemplateId();
    const title = promptTemplateTitle.trim() || promptTemplateTitleFromBody(body);

    setOfficeSettings((currentSettings) =>
      savePromptTemplate(currentSettings, {
        id: templateId,
        title,
        body,
        updatedAt: new Date().toISOString()
      })
    );
    setSelectedPromptTemplateId(templateId);
    setPromptTemplateTitle(title);
  }

  function applySelectedPromptTemplate() {
    if (!selectedPromptTemplate) {
      return;
    }

    setRequest(selectedPromptTemplate.body);
  }

  function removeSelectedPromptTemplate() {
    if (!selectedPromptTemplate) {
      return;
    }

    setOfficeSettings((currentSettings) =>
      deletePromptTemplate(currentSettings, selectedPromptTemplate.id)
    );
    setSelectedPromptTemplateId('');
    setPromptTemplateTitle('');
  }

  function approvePatch() {
    if (!patchReview) {
      return;
    }

    const approvedReview = approvePatchReview(patchReview);

    if (workbenchBridge && approvedReview.approvalStatus === 'approved') {
      workbenchBridge.postMessage({
        type: 'gomi.previewPatch',
        patch: {
          ...approvedReview.patch,
          approvalStatus: 'approved'
        }
      });
      setPatchReview(markPatchPreviewOpening(approvedReview));
      return;
    }

    setPatchReview(approvedReview);
  }

  function rejectPatch() {
    setPatchReview((currentReview) =>
      currentReview ? rejectPatchReview(currentReview) : currentReview
    );
  }

  function applyPatch() {
    setPatchReview((currentReview) => {
      if (!currentReview || !canApplyPatch(currentReview, { requirePreview: Boolean(workbenchBridge) })) {
        return currentReview;
      }

      const applyingReview = markPatchApplying(currentReview);

      if (workbenchBridge) {
        workbenchBridge.postMessage({
          type: 'gomi.applyPatch',
          patch: {
            ...currentReview.patch,
            approvalStatus: 'approved'
          }
        });

        return applyingReview;
      }

      return markPatchApplied(applyingReview);
    });
  }

  async function pruneMemoryNow() {
    if (isPruningMemory) {
      return;
    }

    setIsPruningMemory(true);
    setMemoryPruneError(undefined);

    if (workbenchBridge) {
      workbenchBridge.postMessage({
        type: 'gomi.pruneMemory',
        officeSettings
      });
      return;
    }

    try {
      setMemoryPruneReport(await runtime.pruneMemory());
    } catch (error) {
      setMemoryPruneError(error instanceof Error ? error.message : 'Unknown memory prune error.');
    } finally {
      setIsPruningMemory(false);
    }
  }

  function applyRuntimeEvent(event: GomiRuntimeEvent) {
    if (event.type === 'session_started') {
      setWorkspace(event.workspace);
    }

    if (event.type === 'agent_status') {
      queueAgentStatusToast(event.agentId, event.status);

      setAgents((currentAgents) =>
        currentAgents.map((agent) =>
          agent.id === event.agentId
            ? { ...agent, status: event.status, currentTaskId: event.currentTaskId }
            : agent
        )
      );
    }

    if (event.type === 'session_stopped') {
      for (const [agentId, status] of agentStatusesRef.current) {
        if (['planning', 'working', 'waiting', 'reviewing'].includes(status)) {
          queueAgentStatusToast(agentId, 'blocked');
        }
      }

      setAgents((currentAgents) =>
        currentAgents.map((agent) =>
          ['planning', 'working', 'waiting', 'reviewing'].includes(agent.status)
            ? { ...agent, status: 'blocked', currentTaskId: undefined }
            : agent
        )
      );
      setTasks((currentTasks) =>
        currentTasks.map((task) =>
          task.status === 'queued' || task.status === 'running'
            ? { ...task, status: 'blocked' }
            : task
        )
      );
    }

    if (event.type === 'message') {
      setMessages((currentMessages) => [...currentMessages, event.message]);
    }

    if (event.type === 'task_update') {
      setTasks((currentTasks) => upsertTask(currentTasks, event.task));
    }

    if (event.type === 'memory_update') {
      setMemoryItems((currentItems) => upsertMemoryBoardItem(currentItems, event.item));
    }

    if (event.type === 'patch') {
      setPatchReview(createPatchReviewState(event.patch));
    }

    if (event.type === 'report') {
      setReport(event.report);
    }
  }

  function queueAgentStatusToast(agentId: GomiAgentId, status: GomiAgent['status']) {
    const previousStatus = agentStatusesRef.current.get(agentId);
    agentStatusesRef.current.set(agentId, status);

    if (previousStatus === status || (status !== 'done' && status !== 'blocked')) {
      return;
    }

    const agent = BASE_GOMI_AGENTS.find((candidate) => candidate.id === agentId);
    setStatusToasts((currentToasts) =>
      enqueueStatusToast(currentToasts, {
        id: nextToastIdRef.current++,
        agentId,
        agentName: agent?.name ?? agentId,
        status
      })
    );
  }

  function focusAgent(agentId: GomiAgentId) {
    setOfficeViewMode('standard');
    setRightPanelCollapsed(false);
    globalThis.setTimeout(() => {
      globalThis.document?.getElementById(`gomi-agent-${agentId}`)?.focus();
    });
  }

  function handleExportSettings() {
    const json = exportSettingsToJson(officeSettings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = globalThis.document?.createElement('a');
    if (a) {
      a.href = url;
      a.download = 'gomi-office-settings.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleImportSettings(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const settings = importSettingsFromJson(reader.result as string);
        setOfficeSettings(settings);
      } catch (err) {
        globalThis.alert?.(
          `Failed to import settings: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    };
    reader.readAsText(file);
  }

  function rememberCurrentProject() {
    const project = recentProjectFromWorkspace(workspace);

    if (!project) {
      return;
    }

    setOfficeSettings((currentSettings) => rememberRecentProject(currentSettings, project));
  }

  function openRecentProject(project: GomiRecentProject) {
    const openedProject = {
      ...project,
      lastOpenedAt: new Date().toISOString()
    };

    setOfficeSettings((currentSettings) => rememberRecentProject(currentSettings, openedProject));

    if (workbenchBridge) {
      workbenchBridge.postMessage({
        type: 'gomi.openProject',
        project: openedProject
      });
      return;
    }

    setRequest(`Open recent project: ${project.name}\nPath: ${project.path}`);
  }

  function removeRecentProjectEntry(projectId: string) {
    setOfficeSettings((currentSettings) => removeRecentProject(currentSettings, projectId));
  }

  function assignProvider(seatId: string, providerId: GomiAgentCliProviderId) {
    setOfficeSettings((currentSettings) => assignSeatProvider(currentSettings, seatId, providerId));
  }

  function toggleSeatSleep(seat: GomiAgentSeat) {
    setOfficeSettings((currentSettings) =>
      setSeatWorkMode(currentSettings, seat.id, seat.workMode === 'sleeping' ? 'active' : 'sleeping')
    );
  }

  function fireOfficeEmployee(seatId: string) {
    setOfficeSettings((currentSettings) => fireEmployee(currentSettings, seatId));
  }

  function hireOfficeEmployee(departmentId: GomiAgentId) {
    setOfficeSettings((currentSettings) => hireEmployee(currentSettings, departmentId));
  }

  function simulateOfficeStaffing() {
    setOfficeSettings((currentSettings) => simulateStaffingScenario(currentSettings));
  }

  function restoreOfficeEmployee(seatId: string) {
    setOfficeSettings((currentSettings) => setSeatWorkMode(currentSettings, seatId, 'active'));
  }

  function updateBroadcastThreshold(broadcastThreshold: number) {
    setOfficeSettings((currentSettings) =>
      setMemoryBroadcastThreshold(currentSettings, broadcastThreshold)
    );
  }

  function updateSharedMemoryEnabled(sharedMemoryEnabled: boolean) {
    setOfficeSettings((currentSettings) =>
      setSharedMemoryEnabled(currentSettings, sharedMemoryEnabled)
    );
  }

  function updateWorkspaceContextIndexing(indexWorkspaceContext: boolean) {
    setOfficeSettings((currentSettings) =>
      setWorkspaceContextIndexing(currentSettings, indexWorkspaceContext)
    );
  }

  function updateTerminalSnippetIndexing(indexTerminalSnippets: boolean) {
    setOfficeSettings((currentSettings) =>
      setTerminalSnippetIndexing(currentSettings, indexTerminalSnippets)
    );
  }

  function updateMemoryEmbeddingProvider(embeddingProvider: GomiMemoryEmbeddingProviderId) {
    setOfficeSettings((currentSettings) =>
      setMemoryEmbeddingProvider(currentSettings, embeddingProvider)
    );
  }

  function updateMemoryEmbeddingExecutionEnabled(embeddingExecutionEnabled: boolean) {
    setOfficeSettings((currentSettings) =>
      setMemoryEmbeddingExecutionEnabled(currentSettings, embeddingExecutionEnabled)
    );
  }

  function updateMemoryPrivacyMode(privacyMode: GomiMemoryPrivacyMode) {
    setOfficeSettings((currentSettings) =>
      setMemoryPrivacyMode(currentSettings, privacyMode)
    );
  }

  function updateSecretRedaction(redactSecrets: boolean) {
    setOfficeSettings((currentSettings) =>
      setSecretRedactionEnabled(currentSettings, redactSecrets)
    );
  }

  function updateMemoryRetentionDays(retentionDays: number) {
    setOfficeSettings((currentSettings) =>
      setMemoryRetentionDays(currentSettings, retentionDays)
    );
  }

  function updateMaxProjectMemoryItems(maxProjectMemoryItems: number) {
    setOfficeSettings((currentSettings) =>
      setMaxProjectMemoryItems(currentSettings, maxProjectMemoryItems)
    );
  }

  function updateAvatarStyle(avatarStyle: GomiAvatarStyle) {
    setOfficeSettings((currentSettings) => setAvatarStyle(currentSettings, avatarStyle));
  }

  function updatePatchApprovalRequired(requirePatchApproval: boolean) {
    setOfficeSettings((currentSettings) =>
      setPatchApprovalRequired(currentSettings, requirePatchApproval)
    );
  }

  function updateWorkspaceTrust(workspaceTrust: GomiWorkspaceTrustState) {
    setOfficeSettings((currentSettings) =>
      setWorkspaceTrustState(currentSettings, workspaceTrust)
    );
  }

  function updateLiveProviderMode(liveProviderMode: GomiLiveProviderMode) {
    setOfficeSettings((currentSettings) =>
      setLiveProviderMode(currentSettings, liveProviderMode)
    );
  }

  function updateCliProvidersEnabled(allowCliProviders: boolean) {
    setOfficeSettings((currentSettings) =>
      setCliProvidersEnabled(currentSettings, allowCliProviders)
    );
  }

  function updateHttpProvidersEnabled(allowHttpProviders: boolean) {
    setOfficeSettings((currentSettings) =>
      setHttpProvidersEnabled(currentSettings, allowHttpProviders)
    );
  }

  function updateLiveProviderPatchApprovalRequired(requirePatchApprovalForLiveProviders: boolean) {
    setOfficeSettings((currentSettings) =>
      setLiveProviderPatchApprovalRequired(currentSettings, requirePatchApprovalForLiveProviders)
    );
  }

  function updateMaxConcurrentAgentRuns(maxConcurrentAgentRuns: number) {
    setOfficeSettings((currentSettings) =>
      setMaxConcurrentAgentRuns(currentSettings, maxConcurrentAgentRuns)
    );
  }

  function updateHttpProviderMaxRetries(httpMaxRetries: number) {
    setOfficeSettings((currentSettings) =>
      setHttpProviderMaxRetries(currentSettings, httpMaxRetries)
    );
  }

  function setLayoutMode(mode: GomiOfficeViewMode) {
    setOfficeViewMode(mode);

    if (mode === 'standard') {
      setSidebarCollapsed(false);
      setRightPanelCollapsed(false);
      setBottomCollapsed(false);
    }
  }

  function toggleSidebarPanel() {
    if (effectiveSidebarCollapsed) {
      setOfficeViewMode('standard');
      setSidebarCollapsed(false);
      return;
    }

    setSidebarCollapsed(true);
  }

  function toggleRightPanel() {
    if (effectiveRightPanelCollapsed) {
      setOfficeViewMode('standard');
      setRightPanelCollapsed(false);
      return;
    }

    setRightPanelCollapsed(true);
  }

  function closeRightPanel() {
    setRightPanelCollapsed(true);
  }

  function toggleBottomPanel() {
    if (effectiveBottomCollapsed) {
      setOfficeViewMode('standard');
      setBottomCollapsed(false);
      return;
    }

    setBottomCollapsed(true);
  }

  return (
    <div className={shellClassName}>
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

      <div className={workbenchClassName}>
        <ActivityBar />
        <ProjectSidebar
          workspace={workspace}
          memoryItems={memoryItems}
          recentProjects={officeSettings.recentProjects}
          onRememberCurrentProject={rememberCurrentProject}
          onOpenRecentProject={openRecentProject}
          onRemoveRecentProject={removeRecentProjectEntry}
        />

        <main className={mainClassName}>
          <div className="gomi-tabs">
            <div className="gomi-tab">
              <Bot size={16} />
              <span>Gomi Office</span>
            </div>
            <div className="gomi-view-controls" aria-label="Gomi Office view controls">
              <button
                className="gomi-icon-button"
                onClick={toggleSidebarPanel}
                title={effectiveSidebarCollapsed ? 'Expand project sidebar' : 'Collapse project sidebar'}
                aria-label={effectiveSidebarCollapsed ? 'Expand project sidebar' : 'Collapse project sidebar'}
              >
                {effectiveSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button
                className="gomi-icon-button"
                onClick={toggleBottomPanel}
                title={effectiveBottomCollapsed ? 'Expand chat and report' : 'Collapse chat and report'}
                aria-label={effectiveBottomCollapsed ? 'Expand chat and report' : 'Collapse chat and report'}
              >
                {effectiveBottomCollapsed ? <PanelBottomOpen size={18} /> : <PanelBottomClose size={18} />}
              </button>
              <button
                className="gomi-icon-button"
                onClick={toggleRightPanel}
                title={effectiveRightPanelCollapsed ? 'Expand agent panel' : 'Collapse agent panel'}
                aria-label={effectiveRightPanelCollapsed ? 'Expand agent panel' : 'Collapse agent panel'}
              >
                {effectiveRightPanelCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
              </button>
              <div className="gomi-view-mode-controls" role="group" aria-label="Office layout mode">
                {officeViewModes.map(({ id, label, Icon }) => (
                  <button
                    className={`gomi-icon-button ${officeViewMode === id ? 'is-active' : ''}`}
                    onClick={() => setLayoutMode(id)}
                    title={label}
                    aria-label={label}
                    key={id}
                  >
                    <Icon size={17} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="gomi-request" aria-label="Project Request">
            <textarea
              value={request}
              onChange={(event) => setRequest(event.target.value)}
              aria-label="Project Request"
              spellCheck={false}
            />
            <div className="gomi-request-sidebar">
              <div className="gomi-template-tools" aria-label="Prompt Templates">
                <label className="gomi-template-field">
                  <span>Template</span>
                  <select
                    value={selectedPromptTemplateId}
                    onChange={(event) => selectPromptTemplate(event.target.value)}
                    aria-label="Saved prompt template"
                  >
                    <option value="">New template</option>
                    {officeSettings.promptTemplates.map((promptTemplate) => (
                      <option value={promptTemplate.id} key={promptTemplate.id}>
                        {promptTemplate.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="gomi-template-field">
                  <span>Name</span>
                  <input
                    value={promptTemplateTitle}
                    onChange={(event) => setPromptTemplateTitle(event.target.value)}
                    aria-label="Prompt template name"
                    placeholder={promptTemplateTitleFromBody(request)}
                  />
                </label>
                <div className="gomi-template-actions">
                  <button
                    className="gomi-icon-button"
                    onClick={startNewPromptTemplate}
                    title="New prompt template"
                    aria-label="New prompt template"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    className="gomi-icon-button"
                    onClick={saveCurrentPromptTemplate}
                    disabled={!request.trim()}
                    title="Save prompt template"
                    aria-label="Save prompt template"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    className="gomi-icon-button"
                    onClick={applySelectedPromptTemplate}
                    disabled={!selectedPromptTemplate}
                    title="Apply prompt template"
                    aria-label="Apply prompt template"
                  >
                    <ClipboardPaste size={16} />
                  </button>
                  <button
                    className="gomi-icon-button is-danger"
                    onClick={removeSelectedPromptTemplate}
                    disabled={!selectedPromptTemplate}
                    title="Delete prompt template"
                    aria-label="Delete prompt template"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="gomi-request-actions">
                <button className="gomi-send" onClick={runOfficeSession} disabled={isRunning}>
                  <Send size={17} />
                  <span>{isRunning ? 'Running' : 'Run CEO'}</span>
                </button>
                {isRunning ? (
                  <button className="gomi-send is-stop" onClick={stopOfficeSession}>
                    <XCircle size={17} />
                    <span>Stop</span>
                  </button>
                ) : undefined}
              </div>
            </div>
          </section>

          <section className="gomi-office-stage" aria-label="Gomi Office Simulation">
            <PhaserOffice
              agents={visualAgents}
              officeSettings={officeSettings}
              tasks={tasks}
              messages={messages}
              memoryItems={memoryItems}
              layoutToken={officeLayoutToken}
            />
          </section>

          <section className="gomi-bottom">
            <ChatLog messages={messages} />
            <FinalReport
              report={report}
              patchReview={patchReview}
              onApprovePatch={approvePatch}
              onRejectPatch={rejectPatch}
              onApplyPatch={applyPatch}
              nativePreviewRequired={Boolean(workbenchBridge)}
            />
          </section>
        </main>

        <RightPanel
          agents={visualAgents}
          tasks={tasks}
          report={report}
          officeSettings={officeSettings}
          memoryItems={memoryItems}
          memoryPruneReport={memoryPruneReport}
          memoryPruneError={memoryPruneError}
          isPruningMemory={isPruningMemory}
          onProviderChange={assignProvider}
          onToggleSeatSleep={toggleSeatSleep}
          onClosePanel={closeRightPanel}
          onHireEmployee={hireOfficeEmployee}
          onSimulateStaffing={simulateOfficeStaffing}
          onFireEmployee={fireOfficeEmployee}
          onRestoreEmployee={restoreOfficeEmployee}
          onExportSettings={handleExportSettings}
          onImportSettings={handleImportSettings}
          onBroadcastThresholdChange={updateBroadcastThreshold}
          onSharedMemoryEnabledChange={updateSharedMemoryEnabled}
          onWorkspaceContextIndexingChange={updateWorkspaceContextIndexing}
          onTerminalSnippetIndexingChange={updateTerminalSnippetIndexing}
          onMemoryEmbeddingProviderChange={updateMemoryEmbeddingProvider}
          onMemoryEmbeddingExecutionEnabledChange={updateMemoryEmbeddingExecutionEnabled}
          onMemoryPrivacyModeChange={updateMemoryPrivacyMode}
          onSecretRedactionChange={updateSecretRedaction}
          onMemoryRetentionDaysChange={updateMemoryRetentionDays}
          onMaxProjectMemoryItemsChange={updateMaxProjectMemoryItems}
          onAvatarStyleChange={updateAvatarStyle}
          onPatchApprovalRequiredChange={updatePatchApprovalRequired}
          onWorkspaceTrustChange={updateWorkspaceTrust}
          onLiveProviderModeChange={updateLiveProviderMode}
          onCliProvidersEnabledChange={updateCliProvidersEnabled}
          onHttpProvidersEnabledChange={updateHttpProvidersEnabled}
          onLiveProviderPatchApprovalRequiredChange={updateLiveProviderPatchApprovalRequired}
          onMaxConcurrentAgentRunsChange={updateMaxConcurrentAgentRuns}
          onHttpProviderMaxRetriesChange={updateHttpProviderMaxRetries}
          onPruneMemory={pruneMemoryNow}
        />
      </div>

      <div className="gomi-toast-stack" aria-live="polite" aria-label="Agent status updates">
        {statusToasts.map((toast) => (
          <div className="gomi-toast" data-status={toast.status} key={toast.id}>
            <button className="gomi-toast__focus" onClick={() => focusAgent(toast.agentId)}>
              <strong>{toast.agentName}</strong>
              <span>{toast.status === 'done' ? 'Finished' : 'Blocked'}</span>
            </button>
            <button
              className="gomi-icon-button"
              onClick={() => setStatusToasts((toasts) => toasts.filter((item) => item.id !== toast.id))}
              title="Dismiss status update"
              aria-label={`Dismiss ${toast.agentName} status update`}
            >
              <XCircle size={16} />
            </button>
          </div>
        ))}
      </div>

      <footer className="gomi-statusbar">
        <span>{workbenchBridge ? 'Gomi Workbench Bridge' : 'Gomi Demo Runtime'}</span>
        <span>{isRunning ? 'Agents working' : 'Ready'}</span>
      </footer>
      {showKeyboardShortcuts && (
        <GomiKeyboardShortcuts onClose={() => setShowKeyboardShortcuts(false)} />
      )}
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

function ProjectSidebar({
  workspace,
  memoryItems,
  recentProjects,
  onRememberCurrentProject,
  onOpenRecentProject,
  onRemoveRecentProject
}: {
  workspace?: GomiWorkspaceSnapshot;
  memoryItems: GomiMemoryBoardItem[];
  recentProjects: GomiRecentProject[];
  onRememberCurrentProject: () => void;
  onOpenRecentProject: (project: GomiRecentProject) => void;
  onRemoveRecentProject: (projectId: string) => void;
}) {
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
          <div className="gomi-project-row__head">
            <div className="gomi-project-name">Recent Projects</div>
            <button
              className="gomi-icon-button"
              onClick={onRememberCurrentProject}
              disabled={!workspace?.rootPath}
              title="Save current project"
              aria-label="Save current project"
            >
              <Star size={15} />
            </button>
          </div>
          <RecentProjectsLauncher
            recentProjects={recentProjects}
            onOpenRecentProject={onOpenRecentProject}
            onRemoveRecentProject={onRemoveRecentProject}
          />
        </div>

        <div className="gomi-project-row">
          <div className="gomi-project-name">Agent Runtime</div>
          <div className="gomi-project-detail">
            CEO planner, message bus, event stream, patch proposal, final report.
          </div>
        </div>

        <div className="gomi-project-row">
          <div className="gomi-project-name">Shared Memory Board</div>
          <MemoryBoardPanel memoryItems={memoryItems} compact />
        </div>
      </div>
    </aside>
  );
}

function RecentProjectsLauncher({
  recentProjects,
  onOpenRecentProject,
  onRemoveRecentProject
}: {
  recentProjects: GomiRecentProject[];
  onOpenRecentProject: (project: GomiRecentProject) => void;
  onRemoveRecentProject: (projectId: string) => void;
}) {
  if (recentProjects.length === 0) {
    return <div className="gomi-project-detail">No recent projects.</div>;
  }

  return (
    <div className="gomi-recent-projects" aria-label="Recent Projects Launcher">
      {recentProjects.map((project) => (
        <div className="gomi-recent-project" key={project.id}>
          <button
            className="gomi-recent-project__main"
            onClick={() => onOpenRecentProject(project)}
            title={`Open ${project.name}`}
          >
            <FolderOpen size={16} />
            <span>
              <strong>{project.name}</strong>
              <small>{project.path}</small>
            </span>
          </button>
          <button
            className="gomi-icon-button"
            onClick={() => onRemoveRecentProject(project.id)}
            title={`Remove ${project.name}`}
            aria-label={`Remove ${project.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

function RightPanel({
  agents,
  tasks,
  report,
  officeSettings,
  memoryItems,
  memoryPruneReport,
  memoryPruneError,
  isPruningMemory,
  onExportSettings,
  onImportSettings,
  onProviderChange,
  onToggleSeatSleep,
  onClosePanel,
  onHireEmployee,
  onSimulateStaffing,
  onFireEmployee,
  onRestoreEmployee,
  onBroadcastThresholdChange,
  onSharedMemoryEnabledChange,
  onWorkspaceContextIndexingChange,
  onTerminalSnippetIndexingChange,
  onMemoryEmbeddingProviderChange,
  onMemoryEmbeddingExecutionEnabledChange,
  onMemoryPrivacyModeChange,
  onSecretRedactionChange,
  onMemoryRetentionDaysChange,
  onMaxProjectMemoryItemsChange,
  onAvatarStyleChange,
  onPatchApprovalRequiredChange,
  onWorkspaceTrustChange,
  onLiveProviderModeChange,
  onCliProvidersEnabledChange,
  onHttpProvidersEnabledChange,
  onLiveProviderPatchApprovalRequiredChange,
  onMaxConcurrentAgentRunsChange,
  onHttpProviderMaxRetriesChange,
  onPruneMemory
}: {
  agents: GomiAgent[];
  tasks: GomiTask[];
  report?: GomiFinalReport;
  officeSettings: GomiOfficeSettings;
  memoryItems: GomiMemoryBoardItem[];
  memoryPruneReport?: GomiRuntimeMemoryPruneReport;
  memoryPruneError?: string;
  isPruningMemory: boolean;
  onProviderChange: (seatId: string, providerId: GomiAgentCliProviderId) => void;
  onToggleSeatSleep: (seat: GomiAgentSeat) => void;
  onClosePanel: () => void;
  onHireEmployee: (departmentId: GomiAgentId) => void;
  onSimulateStaffing: () => void;
  onFireEmployee: (seatId: string) => void;
  onRestoreEmployee: (seatId: string) => void;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
  onBroadcastThresholdChange: (broadcastThreshold: number) => void;
  onSharedMemoryEnabledChange: (sharedMemoryEnabled: boolean) => void;
  onWorkspaceContextIndexingChange: (indexWorkspaceContext: boolean) => void;
  onTerminalSnippetIndexingChange: (indexTerminalSnippets: boolean) => void;
  onMemoryEmbeddingProviderChange: (embeddingProvider: GomiMemoryEmbeddingProviderId) => void;
  onMemoryEmbeddingExecutionEnabledChange: (embeddingExecutionEnabled: boolean) => void;
  onMemoryPrivacyModeChange: (privacyMode: GomiMemoryPrivacyMode) => void;
  onSecretRedactionChange: (redactSecrets: boolean) => void;
  onMemoryRetentionDaysChange: (retentionDays: number) => void;
  onMaxProjectMemoryItemsChange: (maxProjectMemoryItems: number) => void;
  onAvatarStyleChange: (avatarStyle: GomiAvatarStyle) => void;
  onPatchApprovalRequiredChange: (requirePatchApproval: boolean) => void;
  onWorkspaceTrustChange: (workspaceTrust: GomiWorkspaceTrustState) => void;
  onLiveProviderModeChange: (liveProviderMode: GomiLiveProviderMode) => void;
  onCliProvidersEnabledChange: (allowCliProviders: boolean) => void;
  onHttpProvidersEnabledChange: (allowHttpProviders: boolean) => void;
  onLiveProviderPatchApprovalRequiredChange: (requirePatchApprovalForLiveProviders: boolean) => void;
  onMaxConcurrentAgentRunsChange: (maxConcurrentAgentRuns: number) => void;
  onHttpProviderMaxRetriesChange: (httpMaxRetries: number) => void;
  onPruneMemory: () => void;
}) {
  return (
    <aside className="gomi-right-panel" aria-label="Agent Status Panel">
      <div className="gomi-panel-header">
        <span>Agents</span>
        <div className="gomi-panel-header__actions">
          <button className="gomi-icon-button" onClick={onClosePanel} title="Close agent panel" aria-label="Close agent panel">
            <PanelRightClose size={16} />
          </button>
        </div>
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

        <OfficeSettingsPanel
          officeSettings={officeSettings}
          memoryItems={memoryItems}
          memoryPruneReport={memoryPruneReport}
          memoryPruneError={memoryPruneError}
          isPruningMemory={isPruningMemory}
          onExportSettings={onExportSettings}
          onImportSettings={onImportSettings}
          onProviderChange={onProviderChange}
          onToggleSeatSleep={onToggleSeatSleep}
          onHireEmployee={onHireEmployee}
          onSimulateStaffing={onSimulateStaffing}
          onFireEmployee={onFireEmployee}
          onRestoreEmployee={onRestoreEmployee}
          onBroadcastThresholdChange={onBroadcastThresholdChange}
          onSharedMemoryEnabledChange={onSharedMemoryEnabledChange}
          onWorkspaceContextIndexingChange={onWorkspaceContextIndexingChange}
          onTerminalSnippetIndexingChange={onTerminalSnippetIndexingChange}
          onMemoryEmbeddingProviderChange={onMemoryEmbeddingProviderChange}
          onMemoryEmbeddingExecutionEnabledChange={onMemoryEmbeddingExecutionEnabledChange}
          onMemoryPrivacyModeChange={onMemoryPrivacyModeChange}
          onSecretRedactionChange={onSecretRedactionChange}
          onMemoryRetentionDaysChange={onMemoryRetentionDaysChange}
          onMaxProjectMemoryItemsChange={onMaxProjectMemoryItemsChange}
          onAvatarStyleChange={onAvatarStyleChange}
          onPatchApprovalRequiredChange={onPatchApprovalRequiredChange}
          onWorkspaceTrustChange={onWorkspaceTrustChange}
          onLiveProviderModeChange={onLiveProviderModeChange}
          onCliProvidersEnabledChange={onCliProvidersEnabledChange}
          onHttpProvidersEnabledChange={onHttpProvidersEnabledChange}
          onLiveProviderPatchApprovalRequiredChange={onLiveProviderPatchApprovalRequiredChange}
          onMaxConcurrentAgentRunsChange={onMaxConcurrentAgentRunsChange}
          onHttpProviderMaxRetriesChange={onHttpProviderMaxRetriesChange}
          onPruneMemory={onPruneMemory}
        />
      </div>
    </aside>
  );
}

function AgentRow({ agent }: { agent: GomiAgent }) {
  const Icon = agent.status === 'sleeping' ? Bed : iconForAgent(agent.id);

  return (
    <div className="gomi-agent-row" id={`gomi-agent-${agent.id}`} tabIndex={-1}>
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
        {formatGomiTaskStatusLabel(task)}
      </span>
    </div>
  );
}

function ProviderStatusBar({ officeSettings }: { officeSettings: GomiOfficeSettings }) {
  const badges: Array<{ label: string; active: boolean; title: string }> = [
    {
      label: 'CLI',
      active: officeSettings.execution.allowCliProviders,
      title: officeSettings.execution.allowCliProviders ? 'CLI providers enabled' : 'CLI providers disabled'
    },
    {
      label: 'HTTP',
      active: officeSettings.execution.allowHttpProviders,
      title: officeSettings.execution.allowHttpProviders ? 'HTTP providers enabled' : 'HTTP providers disabled'
    },
    {
      label: officeSettings.execution.liveProviderMode === 'demo-only'
        ? 'Demo'
        : officeSettings.execution.liveProviderMode === 'trusted-workspaces'
          ? 'Trusted'
          : 'All',
      active: officeSettings.execution.liveProviderMode !== 'demo-only',
      title: `Live provider mode: ${officeSettings.execution.liveProviderMode}`
    },
    {
      label: officeSettings.memory.embeddingProvider === 'local-hashing' ? 'Local' : 'Remote',
      active: officeSettings.memory.embeddingProvider !== 'local-hashing',
      title: `Embedding: ${getMemoryEmbeddingProviderLabel(officeSettings.memory.embeddingProvider)}`
    },
    {
      label: 'Patch',
      active: !officeSettings.memory.requirePatchApproval,
      title: officeSettings.memory.requirePatchApproval ? 'Patch approval required' : 'Auto-apply enabled'
    }
  ];

  const activeCount = badges.filter((b) => b.active).length;

  return (
    <div className="gomi-provider-status-bar" aria-label="Provider status">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`gomi-provider-badge${badge.active ? ' is-active' : ''}`}
          title={badge.title}
        >
          {badge.active ? '●' : '○'} {badge.label}
        </span>
      ))}
      <span className="gomi-provider-badge-count" title="Active providers">{activeCount} active</span>
    </div>
  );
}

function OfficeSettingsPanel({
  officeSettings,
  memoryItems,
  memoryPruneReport,
  memoryPruneError,
  isPruningMemory,
  onExportSettings,
  onImportSettings,
  onProviderChange,
  onToggleSeatSleep,
  onHireEmployee,
  onSimulateStaffing,
  onFireEmployee,
  onRestoreEmployee,
  onBroadcastThresholdChange,
  onSharedMemoryEnabledChange,
  onWorkspaceContextIndexingChange,
  onTerminalSnippetIndexingChange,
  onMemoryEmbeddingProviderChange,
  onMemoryEmbeddingExecutionEnabledChange,
  onMemoryPrivacyModeChange,
  onSecretRedactionChange,
  onMemoryRetentionDaysChange,
  onMaxProjectMemoryItemsChange,
  onAvatarStyleChange,
  onPatchApprovalRequiredChange,
  onWorkspaceTrustChange,
  onLiveProviderModeChange,
  onCliProvidersEnabledChange,
  onHttpProvidersEnabledChange,
  onLiveProviderPatchApprovalRequiredChange,
  onMaxConcurrentAgentRunsChange,
  onHttpProviderMaxRetriesChange,
  onPruneMemory
}: {
  officeSettings: GomiOfficeSettings;
  memoryItems: GomiMemoryBoardItem[];
  memoryPruneReport?: GomiRuntimeMemoryPruneReport;
  memoryPruneError?: string;
  isPruningMemory: boolean;
  onExportSettings: () => void;
  onImportSettings: (file: File) => void;
  onProviderChange: (seatId: string, providerId: GomiAgentCliProviderId) => void;
  onToggleSeatSleep: (seat: GomiAgentSeat) => void;
  onHireEmployee: (departmentId: GomiAgentId) => void;
  onSimulateStaffing: () => void;
  onFireEmployee: (seatId: string) => void;
  onRestoreEmployee: (seatId: string) => void;
  onBroadcastThresholdChange: (broadcastThreshold: number) => void;
  onSharedMemoryEnabledChange: (sharedMemoryEnabled: boolean) => void;
  onWorkspaceContextIndexingChange: (indexWorkspaceContext: boolean) => void;
  onTerminalSnippetIndexingChange: (indexTerminalSnippets: boolean) => void;
  onMemoryEmbeddingProviderChange: (embeddingProvider: GomiMemoryEmbeddingProviderId) => void;
  onMemoryEmbeddingExecutionEnabledChange: (embeddingExecutionEnabled: boolean) => void;
  onMemoryPrivacyModeChange: (privacyMode: GomiMemoryPrivacyMode) => void;
  onSecretRedactionChange: (redactSecrets: boolean) => void;
  onMemoryRetentionDaysChange: (retentionDays: number) => void;
  onMaxProjectMemoryItemsChange: (maxProjectMemoryItems: number) => void;
  onAvatarStyleChange: (avatarStyle: GomiAvatarStyle) => void;
  onPatchApprovalRequiredChange: (requirePatchApproval: boolean) => void;
  onWorkspaceTrustChange: (workspaceTrust: GomiWorkspaceTrustState) => void;
  onLiveProviderModeChange: (liveProviderMode: GomiLiveProviderMode) => void;
  onCliProvidersEnabledChange: (allowCliProviders: boolean) => void;
  onHttpProvidersEnabledChange: (allowHttpProviders: boolean) => void;
  onLiveProviderPatchApprovalRequiredChange: (requirePatchApprovalForLiveProviders: boolean) => void;
  onMaxConcurrentAgentRunsChange: (maxConcurrentAgentRuns: number) => void;
  onHttpProviderMaxRetriesChange: (httpMaxRetries: number) => void;
  onPruneMemory: () => void;
}) {
  const [settingsSearchQuery, setSettingsSearchQuery] = useState('');
  const leaders = officeSettings.seats.filter((seat) => seat.seatKind !== 'employee');
  const employees = officeSettings.seats.filter((seat) => seat.seatKind === 'employee');
  const employeeDepartments = GOMI_HIRABLE_DEPARTMENT_IDS.map((departmentId) => ({
    departmentId,
    label: getSeatForAgent(officeSettings, departmentId)?.name.replace(' Head', '') ?? departmentId,
    employees: employees.filter((seat) => seat.departmentId === departmentId)
  }));
  const selectedEmbeddingProvider =
    GOMI_MEMORY_EMBEDDING_PROVIDERS.find(
      (provider) => provider.id === officeSettings.memory.embeddingProvider
    ) ?? GOMI_MEMORY_EMBEDDING_PROVIDERS[0];
  const embeddingEnvNames = [
    selectedEmbeddingProvider.endpointEnv,
    selectedEmbeddingProvider.modelEnv,
    selectedEmbeddingProvider.apiKeyEnv
  ].filter(Boolean);
  const settingsSearchIndex = useMemo(
    () => buildSettingsSearchIndex(officeSettings as unknown as Record<string, unknown>),
    [officeSettings]
  );
  const settingsSearchResults = useMemo(
    () => searchSettings(settingsSearchIndex, settingsSearchQuery),
    [settingsSearchIndex, settingsSearchQuery]
  );
  const settingsSearchTerms = useMemo(
    () => settingsSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean),
    [settingsSearchQuery]
  );
  const showAppearanceSettings = matchesSettingsSearch(
    ['Office Appearance', 'agent avatar style', officeSettings.avatarStyle, GOMI_AVATAR_STYLE_OPTIONS],
    settingsSearchQuery
  );
  const showLeaderSettings = matchesSettingsSearch(
    ['CEO And Department Heads', 'leader provider sleep wake', leaders],
    settingsSearchQuery
  );
  const showEmployeeSettings = matchesSettingsSearch(
    ['Employees', 'staffing hire fire restore department active total', employeeDepartments],
    settingsSearchQuery
  );
  const showMemorySettings = matchesSettingsSearch(
    [
      'Shared Memory',
      'embedding provider privacy retention broadcast threshold terminal snippets workspace context patch approval prune',
      officeSettings.memory,
      selectedEmbeddingProvider,
      embeddingEnvNames,
      memoryItems,
      memoryPruneReport
    ],
    settingsSearchQuery
  );
  const showExecutionSettings = matchesSettingsSearch(
    ['Execution Policy', 'workspace trust live provider CLI HTTP retries concurrent approval', officeSettings.execution],
    settingsSearchQuery
  );
  const visibleSettingsGroupCount = [
    showAppearanceSettings,
    showLeaderSettings,
    showEmployeeSettings,
    showMemorySettings,
    showExecutionSettings
  ].filter(Boolean).length;
  const searchPreviewResults = settingsSearchResults.slice(0, 5);

  return (
    <section className="gomi-settings-panel" aria-label="Office Settings">
      <div className="gomi-panel-header">
        <span>Office Settings</span>
        <Settings size={16} />
      </div>

      <div className="gomi-settings-toolbar">
        <button className="gomi-action-button" onClick={onExportSettings}>
          <Download size={14} />
          <span>Export</span>
        </button>
        <label className="gomi-action-button">
          <Upload size={14} />
          <span>Import</span>
          <input
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportSettings(file);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <label className="gomi-settings-search" htmlFor="gomi-settings-search-input">
        <Search size={14} />
        <input
          id="gomi-settings-search-input"
          type="search"
          value={settingsSearchQuery}
          onChange={(event) => setSettingsSearchQuery(event.target.value)}
          placeholder="Search settings"
          aria-label="Search settings"
        />
      </label>

      {settingsSearchTerms.length > 0 ? (
        <div className="gomi-settings-search-summary" aria-live="polite">
          <span>{visibleSettingsGroupCount} section{visibleSettingsGroupCount === 1 ? '' : 's'} matched</span>
          {searchPreviewResults.map((result) => (
            <mark className="gomi-settings-search-chip" key={`${result.section}-${result.key}`}>
              {result.section}: {result.label}
            </mark>
          ))}
        </div>
      ) : undefined}

      <ProviderStatusBar officeSettings={officeSettings} />

      {showAppearanceSettings ? (
      <div className="gomi-settings-group">
        <div className="gomi-settings-title">Office Appearance</div>
        <div className="gomi-avatar-style-controls" role="radiogroup" aria-label="Agent avatar style">
          {GOMI_AVATAR_STYLE_OPTIONS.map((option) => (
            <button
              className={officeSettings.avatarStyle === option.id ? 'is-active' : ''}
              key={option.id}
              type="button"
              role="radio"
              aria-checked={officeSettings.avatarStyle === option.id}
              onClick={() => onAvatarStyleChange(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      ) : undefined}

      {showLeaderSettings ? (
      <div className="gomi-settings-group">
        <div className="gomi-settings-title">CEO And Department Heads</div>
        {leaders.map((seat) => (
          <div className="gomi-seat-row" key={seat.id}>
            <div className="gomi-seat-row__head">
              <div>
                <div className="gomi-agent-name">{seat.name}</div>
                <div className="gomi-agent-role">{seat.role}</div>
              </div>
              <span className="gomi-status" data-status={seat.workMode}>
                {seat.workMode}
              </span>
            </div>

            <label className="gomi-field">
              <span>Provider</span>
              <select
                value={seat.providerId}
                onChange={(event) =>
                  onProviderChange(seat.id, event.target.value as GomiAgentCliProviderId)
                }
              >
                {GOMI_AGENT_CLI_PROVIDERS.map((provider) => (
                  <option value={provider.id} key={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            {seat.canSleep ? (
              <button className="gomi-action-button" onClick={() => onToggleSeatSleep(seat)}>
                {seat.workMode === 'sleeping' ? <RotateCcw size={14} /> : <Moon size={14} />}
                <span>{seat.workMode === 'sleeping' ? 'Wake' : 'Sleep'}</span>
              </button>
            ) : (
              <div className="gomi-seat-note">
                CEO is always retained. Provider route: {getProviderLabel(seat.providerId)}.
              </div>
            )}
          </div>
        ))}
      </div>
      ) : undefined}

      {showEmployeeSettings ? (
      <div className="gomi-settings-group">
        <div className="gomi-settings-title-row">
          <div className="gomi-settings-title">Employees</div>
          <button className="gomi-action-button" onClick={onSimulateStaffing}>
            <Users size={14} />
            <span>Simulate Staffing</span>
          </button>
        </div>
        {employeeDepartments.map((department) => (
          <div className="gomi-employee-department" key={department.departmentId}>
            <div className="gomi-employee-department__head">
              <div>
                <div className="gomi-agent-name">{department.label}</div>
                <div className="gomi-agent-role">
                  {department.employees.filter((seat) => seat.workMode !== 'fired').length} active / {department.employees.length} total
                </div>
              </div>
              <button
                className="gomi-icon-button"
                onClick={() => onHireEmployee(department.departmentId)}
                title={`Hire ${department.label} employee`}
                aria-label={`Hire ${department.label} employee`}
              >
                <UserPlus size={16} />
              </button>
            </div>

            {department.employees.length === 0 ? (
              <div className="gomi-project-detail">No employees hired yet.</div>
            ) : (
              department.employees.map((seat) => (
                <div className="gomi-employee-row" data-mode={seat.workMode} key={seat.id}>
                  <div>
                    <div className="gomi-agent-name">{seat.name}</div>
                    <div className="gomi-agent-role">{seat.role}</div>
                  </div>
                  <span className="gomi-status" data-status={seat.workMode}>
                    {seat.workMode}
                  </span>
                  {seat.workMode === 'fired' ? (
                    <button className="gomi-icon-button" onClick={() => onRestoreEmployee(seat.id)} title="Restore employee" aria-label="Restore employee">
                      <RotateCcw size={16} />
                    </button>
                  ) : (
                    <button className="gomi-icon-button is-danger" onClick={() => onFireEmployee(seat.id)} title="Fire employee" aria-label="Fire employee">
                      <UserX size={16} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        ))}
      </div>
      ) : undefined}

      {showMemorySettings ? (
      <div className="gomi-settings-group">
        <div className="gomi-settings-title-row">
          <div className="gomi-settings-title">Shared Memory</div>
          <button
            className="gomi-action-button"
            onClick={onPruneMemory}
            disabled={isPruningMemory}
          >
            <Database size={14} />
            <span>{isPruningMemory ? 'Pruning' : 'Prune Now'}</span>
          </button>
        </div>
        <div className="gomi-memory-summary">
          <span>{officeSettings.memory.retrievalMode}</span>
          <span>{getMemoryEmbeddingProviderLabel(officeSettings.memory.embeddingProvider)}</span>
          <span>{officeSettings.memory.embeddingExecutionEnabled ? 'embeddings on' : 'embeddings local'}</span>
          <span>{officeSettings.memory.sharedMemoryEnabled ? 'shared on' : 'shared off'}</span>
          <span>{officeSettings.memory.indexTerminalSnippets ? 'terminal snippets on' : 'terminal snippets off'}</span>
          <span>{officeSettings.memory.privacyMode}</span>
          <span>{`broadcast >= ${Math.round(officeSettings.memory.broadcastThreshold * 100)}%`}</span>
          <span>{`${officeSettings.memory.retentionDays}d retention`}</span>
          <span>{officeSettings.memory.requirePatchApproval ? 'approval required' : 'auto apply allowed'}</span>
        </div>
        {memoryPruneReport ? (
          <div className="gomi-memory-summary" aria-live="polite">
            <span>{`${memoryPruneReport.removed} removed`}</span>
            <span>{`${memoryPruneReport.remaining} remaining`}</span>
            <span>{`lexical ${memoryPruneReport.lexical.removed}/${memoryPruneReport.lexical.remaining}`}</span>
            <span>{`vector ${memoryPruneReport.vector.removed}/${memoryPruneReport.vector.remaining}`}</span>
          </div>
        ) : undefined}
        {memoryPruneError ? (
          <div className="gomi-seat-note" role="alert">
            {memoryPruneError}
          </div>
        ) : undefined}
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.memory.sharedMemoryEnabled}
            onChange={(event) => onSharedMemoryEnabledChange(event.target.checked)}
          />
          <span>Shared project memory</span>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.memory.indexWorkspaceContext}
            onChange={(event) => onWorkspaceContextIndexingChange(event.target.checked)}
            disabled={!officeSettings.memory.sharedMemoryEnabled}
          />
          <span>Index workspace context</span>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.memory.indexTerminalSnippets}
            onChange={(event) => onTerminalSnippetIndexingChange(event.target.checked)}
            disabled={!officeSettings.memory.sharedMemoryEnabled || !officeSettings.memory.indexWorkspaceContext}
          />
          <span>Terminal snippets</span>
        </label>
        <label className="gomi-field">
          <span>Embedding Provider</span>
          <select
            value={officeSettings.memory.embeddingProvider}
            onChange={(event) =>
              onMemoryEmbeddingProviderChange(event.target.value as GomiMemoryEmbeddingProviderId)
            }
          >
            {GOMI_MEMORY_EMBEDDING_PROVIDERS.map((provider) => (
              <option value={provider.id} key={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.memory.embeddingExecutionEnabled}
            onChange={(event) => onMemoryEmbeddingExecutionEnabledChange(event.target.checked)}
            disabled={officeSettings.memory.embeddingProvider === 'local-hashing'}
          />
          <span>HTTP embeddings</span>
        </label>
        <div className="gomi-seat-note">
          {selectedEmbeddingProvider.description}
          {embeddingEnvNames.length > 0 ? ` Env: ${embeddingEnvNames.join(', ')}.` : ''}
        </div>
        <label className="gomi-field">
          <span>Privacy</span>
          <select
            value={officeSettings.memory.privacyMode}
            onChange={(event) => onMemoryPrivacyModeChange(event.target.value as GomiMemoryPrivacyMode)}
          >
            <option value="standard">Standard</option>
            <option value="strict">Strict</option>
          </select>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.memory.redactSecrets}
            onChange={(event) => onSecretRedactionChange(event.target.checked)}
            disabled={officeSettings.memory.privacyMode === 'strict'}
          />
          <span>Secret redaction</span>
        </label>
        <label className="gomi-range-field">
          <span>Broadcast threshold</span>
          <input
            type="range"
            min={45}
            max={95}
            step={1}
            value={Math.round(officeSettings.memory.broadcastThreshold * 100)}
            onChange={(event) => onBroadcastThresholdChange(Number(event.target.value) / 100)}
          />
          <strong>{Math.round(officeSettings.memory.broadcastThreshold * 100)}%</strong>
        </label>
        <div className="gomi-memory-grid">
          <label className="gomi-field">
            <span>Retention days</span>
            <input
              type="number"
              min={1}
              max={365}
              value={officeSettings.memory.retentionDays}
              onChange={(event) => onMemoryRetentionDaysChange(Number(event.target.value))}
            />
          </label>
          <label className="gomi-field">
            <span>Max memory items</span>
            <input
              type="number"
              min={40}
              max={5000}
              step={10}
              value={officeSettings.memory.maxProjectMemoryItems}
              onChange={(event) => onMaxProjectMemoryItemsChange(Number(event.target.value))}
            />
          </label>
        </div>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.memory.requirePatchApproval}
            onChange={(event) => onPatchApprovalRequiredChange(event.target.checked)}
          />
          <span>Patch approval required</span>
        </label>
        <MemoryBoardPanel memoryItems={memoryItems} />
      </div>
      ) : undefined}

      {showExecutionSettings ? (
      <div className="gomi-settings-group">
        <div className="gomi-settings-title">Execution Policy</div>
        <div className="gomi-memory-summary">
          <span>{officeSettings.execution.workspaceTrust}</span>
          <span>{officeSettings.execution.liveProviderMode}</span>
          <span>{officeSettings.execution.allowCliProviders ? 'CLI on' : 'CLI off'}</span>
          <span>{officeSettings.execution.allowHttpProviders ? 'HTTP on' : 'HTTP off'}</span>
          <span>{`${officeSettings.execution.maxConcurrentAgentRuns} concurrent`}</span>
          <span>{`${officeSettings.execution.httpMaxRetries} HTTP retries`}</span>
        </div>
        <label className="gomi-field">
          <span>Workspace Trust</span>
          <select
            value={officeSettings.execution.workspaceTrust}
            onChange={(event) => onWorkspaceTrustChange(event.target.value as GomiWorkspaceTrustState)}
          >
            <option value="untrusted">Untrusted</option>
            <option value="trusted">Trusted</option>
          </select>
        </label>
        <label className="gomi-field">
          <span>Live Provider Mode</span>
          <select
            value={officeSettings.execution.liveProviderMode}
            onChange={(event) => onLiveProviderModeChange(event.target.value as GomiLiveProviderMode)}
          >
            <option value="demo-only">Demo only</option>
            <option value="trusted-workspaces">Trusted workspaces</option>
            <option value="allow-all">Allow all</option>
          </select>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.execution.allowCliProviders}
            onChange={(event) => onCliProvidersEnabledChange(event.target.checked)}
          />
          <span>CLI providers</span>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.execution.allowHttpProviders}
            onChange={(event) => onHttpProvidersEnabledChange(event.target.checked)}
          />
          <span>HTTP model providers</span>
        </label>
        <label className="gomi-toggle-field">
          <input
            type="checkbox"
            checked={officeSettings.execution.requirePatchApprovalForLiveProviders}
            onChange={(event) => onLiveProviderPatchApprovalRequiredChange(event.target.checked)}
          />
          <span>Approval required for live providers</span>
        </label>
        <label className="gomi-field">
          <span>Max concurrent agent runs</span>
          <input
            type="number"
            min={1}
            max={8}
            value={officeSettings.execution.maxConcurrentAgentRuns}
            onChange={(event) => onMaxConcurrentAgentRunsChange(Number(event.target.value))}
          />
        </label>
        <label className="gomi-field">
          <span>HTTP max retries</span>
          <input
            type="number"
            min={0}
            max={5}
            value={officeSettings.execution.httpMaxRetries}
            onChange={(event) => onHttpProviderMaxRetriesChange(Number(event.target.value))}
          />
        </label>
      </div>
      ) : undefined}

      {settingsSearchTerms.length > 0 && visibleSettingsGroupCount === 0 ? (
        <div className="gomi-settings-empty" role="status">
          No settings match "{settingsSearchQuery}".
        </div>
      ) : undefined}
    </section>
  );
}

function MemoryBoardPanel({
  memoryItems,
  compact = false
}: {
  memoryItems: GomiMemoryBoardItem[];
  compact?: boolean;
}) {
  const visibleItems = memoryItems.slice(-5).reverse();

  return (
    <div className={`gomi-memory-board ${compact ? 'is-compact' : ''}`} aria-label="Shared Memory Board">
      {visibleItems.length === 0 ? (
        <div className="gomi-project-detail">Shared project facts will appear here.</div>
      ) : (
        visibleItems.map((item) => (
          <div className="gomi-memory-card" data-source={item.source} key={item.id}>
            <div className="gomi-memory-card__head">
              <span>{item.title}</span>
              <span>{item.source}</span>
            </div>
            <div className="gomi-memory-card__body">{shortenText(item.content, compact ? 96 : 142)}</div>
            <div className="gomi-memory-card__meta">
              <span>{item.key}</span>
              {item.shouldBroadcast === false ? <span>stored quietly</span> : undefined}
            </div>
          </div>
        ))
      )}
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
                <span>
                  {message.senderName}
                  {message.recipientName ? ` -> ${message.recipientName}` : ''}
                </span>
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
  patchReview,
  onApprovePatch,
  onRejectPatch,
  onApplyPatch,
  nativePreviewRequired
}: {
  report?: GomiFinalReport;
  patchReview?: GomiPatchReviewState;
  onApprovePatch: () => void;
  onRejectPatch: () => void;
  onApplyPatch: () => void;
  nativePreviewRequired: boolean;
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
            <PatchApprovalPanel
              patchReview={patchReview}
              onApprovePatch={onApprovePatch}
              onRejectPatch={onRejectPatch}
              onApplyPatch={onApplyPatch}
              nativePreviewRequired={nativePreviewRequired}
            />
            <UsageEstimatePanel usageEstimate={report.usageEstimate} />
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
          </>
        )}
      </div>
    </div>
  );
}

function UsageEstimatePanel({ usageEstimate }: { usageEstimate?: GomiUsageSummary }) {
  if (!usageEstimate) {
    return undefined;
  }

  return (
    <div className="gomi-project-row gomi-usage-panel" aria-label="Usage Estimate">
      <div className="gomi-usage-panel__head">
        <div>
          <div className="gomi-project-name">Usage Estimate</div>
          <div className="gomi-project-detail">
            {usageEstimate.runCount} provider run{usageEstimate.runCount === 1 ? '' : 's'} · {usageEstimate.pricing.label}
          </div>
        </div>
        <span className="gomi-status" data-status={usageEstimate.hasEstimatedTokens ? 'pending' : 'done'}>
          {usageEstimate.hasEstimatedTokens ? 'estimated' : 'metered'}
        </span>
      </div>

      <div className="gomi-usage-grid">
        <UsageMetric label="Input" value={formatCount(usageEstimate.inputTokens)} />
        <UsageMetric label="Output" value={formatCount(usageEstimate.outputTokens)} />
        <UsageMetric label="Total" value={formatCount(usageEstimate.totalTokens)} />
        <UsageMetric label="Cost" value={formatCurrencyEstimate(usageEstimate.estimatedCostUsd)} />
      </div>

      <div className="gomi-chip-row">
        <span className="gomi-chip">
          ${usageEstimate.pricing.inputUsdPerMillionTokens}/M input
        </span>
        <span className="gomi-chip">
          ${usageEstimate.pricing.outputUsdPerMillionTokens}/M output
        </span>
        {usageEstimate.items.slice(0, 3).map((item, index) => (
          <span className="gomi-chip" key={`${item.providerId ?? 'provider'}-${item.model ?? 'model'}-${index}`}>
            {item.providerId ?? 'provider'}{item.model ? ` · ${item.model}` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

function UsageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="gomi-usage-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PatchApprovalPanel({
  patchReview,
  onApprovePatch,
  onRejectPatch,
  onApplyPatch,
  nativePreviewRequired
}: {
  patchReview?: GomiPatchReviewState;
  onApprovePatch: () => void;
  onRejectPatch: () => void;
  onApplyPatch: () => void;
  nativePreviewRequired: boolean;
}) {
  if (!patchReview) {
    return (
      <div className="gomi-project-row">
        <div className="gomi-project-name">Patch Review</div>
        <div className="gomi-project-detail">No patch proposal yet.</div>
      </div>
    );
  }

  const { patch, approvalStatus } = patchReview;

  return (
    <div className="gomi-project-row gomi-patch-review">
      <div className="gomi-patch-review__head">
        <div>
          <div className="gomi-project-name">{patch.filePath}</div>
          <div className="gomi-project-detail">{patch.summary}</div>
        </div>
        <span className="gomi-status" data-status={approvalStatus}>
          {approvalStatus}
        </span>
      </div>

      <div className="gomi-chip-row">
        {patch.targetFiles.map((file) => (
          <span className="gomi-chip" key={file}>
            {file}
          </span>
        ))}
        <span className="gomi-chip">risk: {patch.riskLevel}</span>
        <span className="gomi-chip">by: {patch.createdByAgentId}</span>
        {nativePreviewRequired ? (
          <span className="gomi-chip">preview: {patchReview.previewStatus}</span>
        ) : undefined}
      </div>

      {patchReview.previewError ? (
        <div className="gomi-project-detail">{patchReview.previewError}</div>
      ) : undefined}

      <div className="gomi-patch-actions">
        <button
          className="gomi-action-button"
          onClick={onApprovePatch}
          disabled={approvalStatus === 'applied' || approvalStatus === 'applying'}
        >
          <ShieldCheck size={14} />
          <span>Approve</span>
        </button>
        <button
          className="gomi-action-button is-danger"
          onClick={onRejectPatch}
          disabled={approvalStatus === 'applied' || approvalStatus === 'applying'}
        >
          <XCircle size={14} />
          <span>Reject</span>
        </button>
        <button
          className="gomi-action-button is-primary"
          onClick={onApplyPatch}
          disabled={!canApplyPatch(patchReview, { requirePreview: nativePreviewRequired })}
        >
          <FileDiff size={14} />
          <span>Apply</span>
        </button>
      </div>

      <pre className="gomi-diff-view" aria-label="Patch diff preview">
        {patch.diff.split('\n').map((line, index) => (
          <code data-kind={getDiffLineKind(line)} key={`${line}-${index}`}>
            {line || ' '}
          </code>
        ))}
      </pre>
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

function upsertMemoryBoardItem(
  items: GomiMemoryBoardItem[],
  nextItem: GomiMemoryBoardItem
): GomiMemoryBoardItem[] {
  const existingIndex = items.findIndex((item) => item.id === nextItem.id || item.key === nextItem.key);

  if (existingIndex === -1) {
    return [...items, nextItem].slice(-18);
  }

  return items.map((item, index) => (index === existingIndex ? nextItem : item));
}

function shortenText(value: string, maxLength: number): string {
  const compactValue = value.replace(/\s+/g, ' ').trim();

  if (compactValue.length <= maxLength) {
    return compactValue;
  }

  return `${compactValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(value);
}

function formatCurrencyEstimate(value: number): string {
  if (value > 0 && value < 0.0001) {
    return '<$0.0001';
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(value);
}

function promptTemplateTitleFromBody(body: string): string {
  const title = body.split(/\r?\n/, 1)[0]?.replace(/\s+/g, ' ').trim();

  return title ? shortenText(title, 48) : 'Untitled template';
}

function createPromptTemplateId(): string {
  return `prompt-template-${Date.now().toString(36)}`;
}

function isCompactAgentPanelViewport(): boolean {
  return Boolean(globalThis.matchMedia?.(COMPACT_AGENT_PANEL_QUERY).matches);
}

function applyOfficeSettingsToAgents(
  agents: GomiAgent[],
  officeSettings: GomiOfficeSettings
): GomiAgent[] {
  return agents.map((agent) => {
    const seat = getSeatForAgent(officeSettings, agent.id);

    if (seat?.workMode === 'sleeping') {
      return {
        ...agent,
        status: 'sleeping',
        currentTaskId: undefined
      };
    }

    return agent;
  });
}

function recentProjectFromWorkspace(
  workspace: GomiWorkspaceSnapshot | undefined
): Pick<GomiRecentProject, 'name' | 'path'> | undefined {
  if (!workspace?.rootPath) {
    return undefined;
  }

  return {
    name: workspace.rootName,
    path: workspace.rootPath
  };
}

function iconForAgent(agentId: GomiAgentId) {
  if (agentId === 'backend') {
    return Braces;
  }

  if (agentId === 'frontend') {
    return Code2;
  }

  if (agentId === 'designer') {
    return Palette;
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

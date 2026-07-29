import type { GomiLocale } from './gomiTypes';

export interface GomiI18nPack {
  locale: GomiLocale;
  label: string;
  strings: Record<string, string>;
}

const EN_STRINGS: Record<string, string> = {
  // Title bar
  'app.name': 'Gomi IDE',
  'titlebar.file': 'File',
  'titlebar.edit': 'Edit',
  'titlebar.selection': 'Selection',
  'titlebar.terminal': 'Terminal',
  'titlebar.gomi': 'Gomi',
  'titlebar.openVsx': 'Open VSX',
  'titlebar.codeOss': 'Code - OSS fork scaffold',

  // Activity bar
  'activity.explorer': 'Explorer',
  'activity.search': 'Search',
  'activity.sourceControl': 'Source Control',
  'activity.run': 'Run',
  'activity.gomiOffice': 'Gomi Office',
  'activity.settings': 'Settings',

  // Gomi Office
  'office.tab': 'Gomi Office',
  'office.requestPlaceholder': 'Describe your project request...',
  'office.run': 'Run CEO',
  'office.running': 'Running',
  'office.stop': 'Stop',
  'office.projectContext': 'Project Context',
  'office.recentProjects': 'Recent Projects',
  'office.saveCurrentProject': 'Save current project',
  'office.noRecentProjects': 'No recent projects.',
  'office.runtimeDescription': 'CEO planner, message bus, event stream, patch proposal, final report.',
  'office.sharedMemory': 'Shared Memory Board',

  // Agent statuses
  'agent.status.idle': 'Idle',
  'agent.status.planning': 'Planning',
  'agent.status.working': 'Working',
  'agent.status.waiting': 'Waiting',
  'agent.status.reviewing': 'Reviewing',
  'agent.status.sleeping': 'Sleeping',
  'agent.status.done': 'Done',
  'agent.status.blocked': 'Blocked',

  // Toast notifications
  'toast.finished': 'Finished',
  'toast.blocked': 'Blocked',
  'toast.dismiss': 'Dismiss {agentName} status update',

  // Agent panel
  'panel.agents': 'Agents',
  'panel.taskQueue': 'Task Queue',
  'panel.noTasks': 'No active tasks.',
  'panel.final': 'Final',
  'panel.waitingForReport': 'Waiting for CEO Agent synthesis.',

  // Settings
  'settings.general': 'General',
  'settings.language': 'Language',
  'settings.languageLabel': 'UI Language',
  'settings.avatarStyle': 'Avatar Style',
  'settings.avatarStyleLabel': 'Avatar Style',
  'settings.members': 'Members',
  'settings.providers': 'Providers',
  'settings.memory': 'Memory',
  'settings.execution': 'Execution',
  'settings.exportSettings': 'Export Settings',
  'settings.importSettings': 'Import Settings',
  'settings.provider.cli': 'CLI',
  'settings.provider.http': 'HTTP',
  'settings.provider.liveMode': 'Live Mode',
  'settings.closePanel': 'Close agent panel',
  'settings.memory.retrievalMode': 'Retrieval Mode',
  'settings.memory.embeddingProvider': 'Embedding Provider',
  'settings.memory.sharedMemory': 'Shared Memory',
  'settings.memory.workspaceIndexing': 'Workspace Indexing',
  'settings.memory.terminalIndexing': 'Terminal Indexing',
  'settings.memory.privacyMode': 'Privacy Mode',
  'settings.memory.retentionDays': 'Retention (days)',
  'settings.memory.maxItems': 'Max Memory Items',
  'settings.memory.broadcastThreshold': 'Broadcast Threshold',
  'settings.memory.patchApproval': 'Patch Approval',
  'settings.memory.secretRedaction': 'Secret Redaction',
  'settings.execution.workspaceTrust': 'Workspace Trust',
  'settings.execution.liveProviderMode': 'Live Provider Mode',
  'settings.execution.cliProviders': 'CLI Providers',
  'settings.execution.httpProviders': 'HTTP Providers',
  'settings.execution.patchApprovalLive': 'Patch Approval for Live',
  'settings.execution.maxConcurrent': 'Max Concurrent Runs',
  'settings.execution.httpMaxRetries': 'HTTP Max Retries',

  // Status bar
  'statusbar.bridge': 'Gomi Workbench Bridge',
  'statusbar.demo': 'Gomi Demo Runtime',
  'statusbar.working': 'Agents working',
  'statusbar.ready': 'Ready',

  // Template
  'template.new': 'New template',
  'template.name': 'Name',
  'template.save': 'Save prompt template',
  'template.apply': 'Apply prompt template',
  'template.delete': 'Delete prompt template',
  'template.newTemplate': 'New prompt template',

  // Layout mode
  'layout.standard': 'Standard office layout',
  'layout.expanded': 'Expanded office layout',
  'layout.fullOffice': 'Full office layout',
  'layout.expandSidebar': 'Expand project sidebar',
  'layout.collapseSidebar': 'Collapse project sidebar',
  'layout.expandBottom': 'Expand chat and report',
  'layout.collapseBottom': 'Collapse chat and report',
  'layout.expandAgentPanel': 'Expand agent panel',
  'layout.collapseAgentPanel': 'Collapse agent panel',
};

const VI_STRINGS: Record<string, string> = {
  // Title bar
  'app.name': 'Gomi IDE',
  'titlebar.file': 'Tập tin',
  'titlebar.edit': 'Sửa',
  'titlebar.selection': 'Chọn',
  'titlebar.terminal': 'Thiết bị đầu cuối',
  'titlebar.gomi': 'Gomi',
  'titlebar.openVsx': 'Open VSX',
  'titlebar.codeOss': 'Code - OSS fork scaffold',

  // Activity bar
  'activity.explorer': 'Trình khám phá',
  'activity.search': 'Tìm kiếm',
  'activity.sourceControl': 'Kiểm soát mã nguồn',
  'activity.run': 'Chạy',
  'activity.gomiOffice': 'Gomi Office',
  'activity.settings': 'Cài đặt',

  // Gomi Office
  'office.tab': 'Gomi Office',
  'office.requestPlaceholder': 'Mô tả yêu cầu dự án...',
  'office.run': 'Chạy CEO',
  'office.running': 'Đang chạy',
  'office.stop': 'Dừng',
  'office.projectContext': 'Ngữ cảnh dự án',
  'office.recentProjects': 'Dự án gần đây',
  'office.saveCurrentProject': 'Lưu dự án hiện tại',
  'office.noRecentProjects': 'Không có dự án nào.',
  'office.runtimeDescription': 'CEO lập kế hoạch, xe buýt tin nhắn, luồng sự kiện, đề xuất bản vá, báo cáo cuối cùng.',
  'office.sharedMemory': 'Bảng bộ nhớ chia sẻ',

  // Agent statuses
  'agent.status.idle': 'Nhàn rỗi',
  'agent.status.planning': 'Đang lập kế hoạch',
  'agent.status.working': 'Đang làm việc',
  'agent.status.waiting': 'Đang chờ',
  'agent.status.reviewing': 'Đang xem xét',
  'agent.status.sleeping': 'Đang ngủ',
  'agent.status.done': 'Hoàn thành',
  'agent.status.blocked': 'Bị chặn',

  // Toast notifications
  'toast.finished': 'Hoàn thành',
  'toast.blocked': 'Bị chặn',
  'toast.dismiss': 'Bỏ qua cập nhật trạng thái {agentName}',

  // Agent panel
  'panel.agents': 'Tác nhân',
  'panel.taskQueue': 'Hàng đợi tác vụ',
  'panel.noTasks': 'Không có tác vụ nào.',
  'panel.final': 'Kết quả',
  'panel.waitingForReport': 'Đang chờ CEO tổng hợp.',

  // Settings
  'settings.general': 'Chung',
  'settings.language': 'Ngôn ngữ',
  'settings.languageLabel': 'Ngôn ngữ giao diện',
  'settings.avatarStyle': 'Kiểu đại diện',
  'settings.avatarStyleLabel': 'Kiểu hình đại diện',
  'settings.members': 'Thành viên',
  'settings.providers': 'Nhà cung cấp',
  'settings.memory': 'Bộ nhớ',
  'settings.execution': 'Thực thi',
  'settings.exportSettings': 'Xuất cài đặt',
  'settings.importSettings': 'Nhập cài đặt',
  'settings.provider.cli': 'CLI',
  'settings.provider.http': 'HTTP',
  'settings.provider.liveMode': 'Chế độ trực tiếp',
  'settings.closePanel': 'Đóng bảng tác nhân',
  'settings.memory.retrievalMode': 'Chế độ truy xuất',
  'settings.memory.embeddingProvider': 'Nhà cung cấp embedding',
  'settings.memory.sharedMemory': 'Bộ nhớ chia sẻ',
  'settings.memory.workspaceIndexing': 'Lập chỉ mục workspace',
  'settings.memory.terminalIndexing': 'Lập chỉ mục terminal',
  'settings.memory.privacyMode': 'Chế độ riêng tư',
  'settings.memory.retentionDays': 'Lưu giữ (ngày)',
  'settings.memory.maxItems': 'Số mục tối đa',
  'settings.memory.broadcastThreshold': 'Ngưỡng phát sóng',
  'settings.memory.patchApproval': 'Phê duyệt bản vá',
  'settings.memory.secretRedaction': 'Che dữ liệu bí mật',
  'settings.execution.workspaceTrust': 'Độ tin cậy workspace',
  'settings.execution.liveProviderMode': 'Chế độ nhà cung cấp trực tiếp',
  'settings.execution.cliProviders': 'Nhà cung cấp CLI',
  'settings.execution.httpProviders': 'Nhà cung cấp HTTP',
  'settings.execution.patchApprovalLive': 'Phê duyệt bản vá trực tiếp',
  'settings.execution.maxConcurrent': 'Số lần chạy đồng thời tối đa',
  'settings.execution.httpMaxRetries': 'Số lần thử lại HTTP tối đa',

  // Status bar
  'statusbar.bridge': 'Gomi Workbench Bridge',
  'statusbar.demo': 'Gomi Demo Runtime',
  'statusbar.working': 'Tác nhân đang làm việc',
  'statusbar.ready': 'Sẵn sàng',

  // Template
  'template.new': 'Mẫu mới',
  'template.name': 'Tên',
  'template.save': 'Lưu mẫu',
  'template.apply': 'Áp dụng mẫu',
  'template.delete': 'Xóa mẫu',
  'template.newTemplate': 'Mẫu mới',

  // Layout mode
  'layout.standard': 'Bố cục tiêu chuẩn',
  'layout.expanded': 'Bố cục mở rộng',
  'layout.fullOffice': 'Bố cục toàn màn hình',
  'layout.expandSidebar': 'Mở rộng thanh bên',
  'layout.collapseSidebar': 'Thu gọn thanh bên',
  'layout.expandBottom': 'Mở rộng chat và báo cáo',
  'layout.collapseBottom': 'Thu gọn chat và báo cáo',
  'layout.expandAgentPanel': 'Mở rộng bảng tác nhân',
  'layout.collapseAgentPanel': 'Thu gọn bảng tác nhân',
};

export const GOMI_LOCALE_PACKS: GomiI18nPack[] = [
  { locale: 'en', label: 'English', strings: EN_STRINGS },
  { locale: 'vi', label: 'Tiếng Việt', strings: VI_STRINGS },
];

const packMap = new Map(GOMI_LOCALE_PACKS.map((pack) => [pack.locale, pack]));

export function t(locale: GomiLocale, key: string, fallback?: string): string {
  const pack = packMap.get(locale);
  if (pack && pack.strings[key]) {
    return pack.strings[key];
  }
  // Fallback to English
  const enPack = packMap.get('en');
  if (enPack && enPack.strings[key]) {
    return enPack.strings[key];
  }
  return fallback ?? key;
}

export function getLocaleLabel(locale: GomiLocale): string {
  return GOMI_LOCALE_PACKS.find((pack) => pack.locale === locale)?.label ?? locale;
}

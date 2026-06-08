import { $, append, findParentWithClass, getWindow } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { DisposableStore, MutableDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { basename, dirname, joinPath, relativePath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IMarkerService } from '../../../../platform/markers/common/markers.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { ViewPane, ViewPaneShowActions } from '../../../browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import {
  Extensions as ViewExtensions,
  IViewDescriptor,
  IViewDescriptorService,
  ViewContainerLocation
} from '../../../common/views.js';
import {
  IOverlayWebview,
  IWebviewService,
  WebviewContentPurpose
} from '../../webview/browser/webview.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ITextFileService } from '../../../services/textfile/common/textfiles.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { ISCMService } from '../../scm/common/scm.js';
import {
  applyCodeOssPatchMessage,
  createCodeOssWorkspaceSnapshotReader
} from './codeOssWorkspaceServices.js';
import { createGomiWebviewHostBridge } from './gomiWebviewHostBridge.js';
import { GomiWebviewHostController } from './gomiWebviewHostController.js';

const GOMI_VIEW_CONTAINER_ID = 'workbench.view.gomiOffice';
const GOMI_OFFICE_VIEW_ID = 'gomi.office.view';
const GOMI_COMMAND_OPEN_OFFICE = 'gomi.openOffice';
const GOMI_COMMAND_RUN_AGENT_TASK = 'gomi.runAgentTask';
const GOMI_OFFICE_WEBVIEW_ROOT = FileAccess.asBrowserUri('vs/workbench/contrib/gomi/browser/media/office');
const GOMI_OFFICE_WEBVIEW_SCRIPT = FileAccess.asBrowserUri('vs/workbench/contrib/gomi/browser/media/office/assets/index.js');
const GOMI_OFFICE_WEBVIEW_STYLE = FileAccess.asBrowserUri('vs/workbench/contrib/gomi/browser/media/office/assets/index.css');

const gomiOfficeIcon = registerIcon(
  'gomi-office',
  Codicon.hubot,
  localize('gomiOfficeIcon', 'View icon of the Gomi Office multi-agent workspace.')
);

class GomiOfficeViewPane extends ViewPane {
  private readonly webview = this._register(new MutableDisposable<IOverlayWebview>());
  private readonly webviewDisposables = this._register(new DisposableStore());
  private container?: HTMLElement;
  private rootContainer?: HTMLElement;

  constructor(
    options: IViewletViewOptions,
    @IConfigurationService configurationService: IConfigurationService,
    @IContextKeyService contextKeyService: IContextKeyService,
    @IContextMenuService contextMenuService: IContextMenuService,
    @IInstantiationService instantiationService: IInstantiationService,
    @IKeybindingService keybindingService: IKeybindingService,
    @IOpenerService openerService: IOpenerService,
    @IHoverService hoverService: IHoverService,
    @IThemeService themeService: IThemeService,
    @IViewDescriptorService viewDescriptorService: IViewDescriptorService,
    @IWebviewService private readonly webviewService: IWebviewService,
    @IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
    @IFileService private readonly fileService: IFileService,
    @IEditorService private readonly editorService: IEditorService,
    @ITextFileService private readonly textFileService: ITextFileService,
    @IMarkerService private readonly markerService: IMarkerService,
    @ICodeEditorService private readonly codeEditorService: ICodeEditorService,
    @ITerminalService private readonly terminalService: ITerminalService,
    @ISCMService private readonly scmService: ISCMService
  ) {
    super(
      { ...options, titleMenuId: MenuId.ViewTitle, showActions: ViewPaneShowActions.WhenExpanded },
      keybindingService,
      contextMenuService,
      configurationService,
      contextKeyService,
      viewDescriptorService,
      instantiationService,
      openerService,
      themeService,
      hoverService
    );

    this._register(this.onDidChangeBodyVisibility(() => this.updateWebviewVisibility()));
  }

  focus(): void {
    super.focus();
    this.webview.value?.focus();
  }

  protected renderBody(container: HTMLElement): void {
    super.renderBody(container);
    container.classList.add('gomi-office-native-view');
    this.container = container;
    this.rootContainer = undefined;
    this.activateWebview();
    this.layoutWebview();
    this.updateWebviewVisibility();
  }

  protected layoutBody(height: number, width: number): void {
    super.layoutBody(height, width);

    if (this.container) {
      this.container.style.height = `${height}px`;
      this.container.style.width = `${width}px`;
    }

    this.layoutWebview();
  }

  private activateWebview(): void {
    if (this.webview.value) {
      return;
    }

    const webview = this.webviewService.createWebviewOverlay({
      providedViewType: GOMI_OFFICE_VIEW_ID,
      title: this.title,
      options: {
        purpose: WebviewContentPurpose.WebviewView,
        retainContextWhenHidden: true,
        enableFindWidget: true
      },
      contentOptions: {
        allowScripts: true,
        allowForms: true,
        localResourceRoots: [GOMI_OFFICE_WEBVIEW_ROOT]
      },
      extension: undefined
    });

    webview.setHtml(createGomiOfficeWebviewHtml());
    this.webview.value = webview;
    const bridge = createGomiWebviewHostBridge(webview);
    const codeOssWorkspaceServices = {
      workspaceContextService: this.workspaceContextService,
      fileService: this.fileService,
      editorService: this.editorService,
      codeEditorService: this.codeEditorService,
      textFileService: this.textFileService,
      markerService: this.markerService,
      terminalService: this.terminalService,
      scmService: this.scmService,
      basename,
      dirname,
      joinPath,
      relativePath
    };
    const controller = new GomiWebviewHostController({
      bridge,
      runtimeOptions: {
        workspaceReader: createCodeOssWorkspaceSnapshotReader(codeOssWorkspaceServices)
      },
      patchApplier: (message) => applyCodeOssPatchMessage(message, codeOssWorkspaceServices)
    });
    controller.start();
    this.webviewDisposables.add(bridge);
    this.webviewDisposables.add(controller);
    this.webviewDisposables.add(toDisposable(() => this.webview.value?.release(this)));
  }

  private updateWebviewVisibility(): void {
    const webview = this.webview.value;

    if (!webview) {
      return;
    }

    if (this.isBodyVisible()) {
      webview.claim(this, getWindow(this.element), undefined);
      this.layoutWebview();
    } else {
      webview.release(this);
    }
  }

  private layoutWebview(): void {
    const webview = this.webview.value;

    if (!this.container || !webview) {
      return;
    }

    if (!this.rootContainer || !this.rootContainer.isConnected) {
      this.rootContainer = findParentWithClass(this.container, 'monaco-scrollable-element') ?? undefined;
    }

    webview.setAnchorElement(this.container, this.rootContainer);
  }
}

export const GOMI_VIEW_CONTAINER = Registry.as(ViewExtensions.ViewContainersRegistry).registerViewContainer(
  {
    id: GOMI_VIEW_CONTAINER_ID,
    title: localize2('gomiOffice', 'Gomi Office'),
    ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [
      GOMI_VIEW_CONTAINER_ID,
      { mergeViewWithContainerWhenSingleView: true }
    ]),
    icon: gomiOfficeIcon,
    order: 6,
    hideIfEmpty: true,
    alwaysUseContainerInfo: true
  },
  ViewContainerLocation.Sidebar
);

const gomiOfficeViewDescriptor: IViewDescriptor = {
  id: GOMI_OFFICE_VIEW_ID,
  name: localize2('gomiOfficeView', 'Gomi Office'),
  containerIcon: gomiOfficeIcon,
  ctorDescriptor: new SyncDescriptor(GomiOfficeViewPane),
  canToggleVisibility: false,
  canMoveView: true,
  openCommandActionDescriptor: {
    id: GOMI_COMMAND_OPEN_OFFICE,
    mnemonicTitle: localize({ key: 'miViewGomiOffice', comment: ['&& denotes a mnemonic'] }, '&&Gomi Office'),
    keybindings: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyG
    },
    order: 6
  }
};

Registry.as(ViewExtensions.ViewsRegistry).registerViews([gomiOfficeViewDescriptor], GOMI_VIEW_CONTAINER);

export const GOMI_NATIVE_WORKBENCH_COMMANDS = {
  openOffice: GOMI_COMMAND_OPEN_OFFICE,
  runAgentTask: GOMI_COMMAND_RUN_AGENT_TASK
} as const;

function createGomiOfficeWebviewHtml(): string {
  const nonce = createNonce();
  const scriptUri = toWebviewResourceString(GOMI_OFFICE_WEBVIEW_SCRIPT);
  const styleUri = toWebviewResourceString(GOMI_OFFICE_WEBVIEW_STYLE);
  const resourceSchemes = [
    GOMI_OFFICE_WEBVIEW_ROOT.scheme,
    GOMI_OFFICE_WEBVIEW_SCRIPT.scheme,
    GOMI_OFFICE_WEBVIEW_STYLE.scheme
  ]
    .filter((scheme, index, schemes) => scheme && schemes.indexOf(scheme) === index)
    .map((scheme) => `${scheme}:`)
    .join(' ');

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${resourceSchemes} data: blob:; font-src ${resourceSchemes}; style-src ${resourceSchemes} 'unsafe-inline'; script-src ${resourceSchemes} 'nonce-${nonce}'; connect-src ${resourceSchemes} https:;">`,
    `<link rel="stylesheet" href="${styleUri}">`,
    '<title>Gomi Multi-Agent Office</title>',
    '</head>',
    '<body>',
    '<div id="root"></div>',
    `<script nonce="${nonce}">window.__GOMI_CODE_OSS_WEBVIEW__ = true; window.__GOMI_ENABLE_WORKBENCH_BRIDGE__ = true;</script>`,
    `<script nonce="${nonce}" type="module" src="${scriptUri}"></script>`,
    '</body>',
    '</html>'
  ].join('');
}

function toWebviewResourceString(uri: URI): string {
  return uri.toString(true);
}

function createNonce(): string {
  const source = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += source[Math.floor(Math.random() * source.length)];
  }

  return nonce;
}

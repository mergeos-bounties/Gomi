import { $, append } from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import {
  Extensions as ViewExtensions,
  IViewDescriptor,
  ViewContainerLocation
} from '../../../common/views.js';

const GOMI_VIEW_CONTAINER_ID = 'workbench.view.gomiOffice';
const GOMI_OFFICE_VIEW_ID = 'gomi.office.view';
const GOMI_COMMAND_OPEN_OFFICE = 'gomi.openOffice';
const GOMI_COMMAND_RUN_AGENT_TASK = 'gomi.runAgentTask';

const gomiOfficeIcon = registerIcon(
  'gomi-office',
  Codicon.hubot,
  localize('gomiOfficeIcon', 'View icon of the Gomi Office multi-agent workspace.')
);

class GomiOfficeViewPane extends ViewPane {
  protected renderBody(container: HTMLElement): void {
    super.renderBody(container);
    container.classList.add('gomi-office-native-view');

    const root = append(container, $('.gomi-office-native-view__root'));
    append(root, $('h2', undefined, 'Gomi Office'));
    append(
      root,
      $('p', undefined, 'CEO Agent, specialist agents, shared project memory, and patch review live here.')
    );
    append(
      root,
      $('p', undefined, 'The full React and Phaser office webview bundle is mounted by the Gomi workbench bridge.')
    );
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

import { GOMI_OFFICE_VIEW_DESCRIPTOR } from './gomiOfficeView';

export const GOMI_WORKBENCH_CONTRIBUTION = {
  id: 'workbench.contrib.gomiOffice',
  viewDescriptor: GOMI_OFFICE_VIEW_DESCRIPTOR,
  contributionPoint: 'workbench.common.main'
} as const;

export function getGomiWorkbenchContribution() {
  return GOMI_WORKBENCH_CONTRIBUTION;
}

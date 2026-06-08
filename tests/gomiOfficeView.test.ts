import { describe, expect, it } from 'vitest';
import { GOMI_OFFICE_VIEW_DESCRIPTOR } from '../src/vs/workbench/contrib/gomi/browser/gomiOfficeView';
import {
  GOMI_OFFICE_VIEW_ID,
  GOMI_VIEW_CONTAINER_ID
} from '../src/vs/workbench/contrib/gomi/common/gomiConstants';

describe('Gomi Office view descriptor', () => {
  it('separates the Activity Bar container from the office view id', () => {
    expect(GOMI_VIEW_CONTAINER_ID).toBe('workbench.view.gomiOffice');
    expect(GOMI_OFFICE_VIEW_ID).toBe('gomi.office.view');
    expect(GOMI_OFFICE_VIEW_DESCRIPTOR.containerId).toBe(GOMI_VIEW_CONTAINER_ID);
    expect(GOMI_OFFICE_VIEW_DESCRIPTOR.id).toBe(GOMI_OFFICE_VIEW_ID);
  });
});

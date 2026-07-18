/** First-run onboarding tour (#12) */
export interface TourStep { id: string; target: string; title: string; content: string; position: 'top' | 'bottom' | 'left' | 'right' }
export function getOnboardingSteps(): TourStep[] {
  return [
    { id: 'welcome', target: '#gomi-office', title: 'Welcome to Gomi', content: 'This is your multi-agent development office.', position: 'bottom' },
    { id: 'ceo', target: '#ceo-agent', title: 'CEO Agent', content: 'Type your request here — the CEO plans and delegates.', position: 'right' },
    { id: 'settings', target: '#office-settings', title: 'Settings', content: 'Configure agents, providers, and memory here.', position: 'left' },
    { id: 'memory', target: '#memory-board', title: 'Memory Board', content: 'Agents share findings here. Review and search.', position: 'top' },
    { id: 'patches', target: '#patch-review', title: 'Patch Review', content: 'Approve or reject code changes before they apply.', position: 'top' },
  ];
}
export function isFirstRun(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const seen = localStorage.getItem('gomi-onboarding-seen');
  if (seen) return false;
  localStorage.setItem('gomi-onboarding-seen', '1');
  return true;
}

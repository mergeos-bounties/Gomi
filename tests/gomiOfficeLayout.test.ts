import { describe, expect, it } from 'vitest';
import { BASE_GOMI_AGENTS } from '../src/vs/workbench/contrib/gomi/common/gomiConstants';
import { createGomiOfficeLayout, workStatusLabels } from '../src/vs/workbench/contrib/gomi/browser/gomiOfficeLayout';

describe('Gomi office layout', () => {
  it('assigns every base agent to a visible room seat', () => {
    const layout = createGomiOfficeLayout(1280, 720);

    expect(layout.seats).toHaveLength(BASE_GOMI_AGENTS.length);

    for (const agent of BASE_GOMI_AGENTS) {
      const seat = layout.seats.find((candidate) => candidate.agentId === agent.id);
      const room = layout.rooms.find((candidate) => candidate.id === seat?.roomId);

      expect(seat, `${agent.id} should have a seat`).toBeDefined();
      expect(room, `${agent.id} should have a room`).toBeDefined();
      expect(seat?.x).toBeGreaterThanOrEqual(room?.x ?? 0);
      expect(seat?.x).toBeLessThanOrEqual((room?.x ?? 0) + (room?.width ?? 0));
      expect(seat?.y).toBeGreaterThanOrEqual(room?.y ?? 0);
      expect(seat?.y).toBeLessThanOrEqual((room?.y ?? 0) + (room?.height ?? 0));
    }
  });

  it('keeps office boards inside compact and full-size viewports', () => {
    for (const viewport of [
      { width: 430, height: 300 },
      { width: 1024, height: 580 },
      { width: 1680, height: 920 }
    ]) {
      const layout = createGomiOfficeLayout(viewport.width, viewport.height);

      for (const board of [layout.memoryBoard, layout.statusWall]) {
        expect(board.x).toBeGreaterThanOrEqual(0);
        expect(board.y).toBeGreaterThanOrEqual(0);
        expect(board.x + board.width).toBeLessThanOrEqual(viewport.width);
        expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);
      }

      expect(layout.gomiHub.x).toBeGreaterThanOrEqual(0);
      expect(layout.gomiHub.x).toBeLessThanOrEqual(viewport.width);
      expect(layout.gomiHub.y).toBeGreaterThanOrEqual(0);
      expect(layout.gomiHub.y).toBeLessThanOrEqual(viewport.height);
    }
  });

  it('names every agent status for the status wall and bubbles', () => {
    expect(Object.keys(workStatusLabels).sort()).toEqual([
      'blocked',
      'done',
      'idle',
      'planning',
      'reviewing',
      'sleeping',
      'waiting',
      'working'
    ]);
  });
});

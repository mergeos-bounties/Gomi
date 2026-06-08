import type { GomiAgentId, GomiAgentStatus } from '../common/gomiTypes';

export interface GomiOfficeRoomLayout {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GomiOfficeBoardLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GomiOfficeAgentSeat {
  agentId: GomiAgentId;
  roomId: string;
  x: number;
  y: number;
}

export interface GomiOfficeLayout {
  rooms: GomiOfficeRoomLayout[];
  memoryBoard: GomiOfficeBoardLayout;
  statusWall: GomiOfficeBoardLayout;
  gomiHub: { x: number; y: number };
  seats: GomiOfficeAgentSeat[];
}

export const agentRoomIds: Record<GomiAgentId, string> = {
  ceo: 'ceo-office',
  'system-analyst': 'analysis-bay',
  backend: 'backend-den',
  frontend: 'frontend-studio',
  designer: 'design-studio',
  database: 'data-lab',
  qa: 'qa-desk',
  devops: 'devops-pod'
};

export const workStatusLabels: Record<GomiAgentStatus, string> = {
  idle: 'Idle',
  planning: 'Planning',
  working: 'Working',
  waiting: 'Waiting',
  reviewing: 'Reviewing',
  sleeping: 'Sleeping',
  done: 'Done',
  blocked: 'Blocked'
};

export function createGomiOfficeLayout(width: number, height: number): GomiOfficeLayout {
  const safeWidth = Math.max(360, width);
  const safeHeight = Math.max(260, height);
  const compact = safeWidth < 760 || safeHeight < 430;
  const pad = compact ? 14 : 22;
  const gap = compact ? 8 : 14;
  const topY = compact ? safeHeight * 0.12 : safeHeight * 0.1;
  const bottomY = compact ? safeHeight * 0.63 : safeHeight * 0.59;
  const roomHeight = compact ? safeHeight * 0.25 : safeHeight * 0.27;
  const memoryBoardWidth = clamp(safeWidth * (compact ? 0.38 : 0.34), 185, 310);
  const memoryBoardHeight = clamp(safeHeight * (compact ? 0.23 : 0.27), 82, 128);
  const rooms = compact
    ? createCompactRooms(safeWidth, safeHeight, pad, gap, topY, bottomY, roomHeight)
    : createDesktopRooms(safeWidth, topY, bottomY, roomHeight);
  const memoryBoard = {
    x: clamp(safeWidth * (compact ? 0.31 : 0.34), pad, safeWidth - memoryBoardWidth - pad),
    y: clamp(safeHeight * (compact ? 0.34 : 0.36), pad, safeHeight - memoryBoardHeight - pad),
    width: memoryBoardWidth,
    height: memoryBoardHeight
  };
  const statusWallWidth = clamp(safeWidth * 0.18, 140, 210);
  const statusWall = {
    x: clamp(memoryBoard.x + memoryBoard.width + 14, pad, safeWidth - statusWallWidth - pad),
    y: memoryBoard.y,
    width: statusWallWidth,
    height: memoryBoard.height
  };

  return {
    rooms,
    memoryBoard,
    statusWall,
    gomiHub: {
      x: clamp(safeWidth * 0.5, pad + 44, safeWidth - pad - 44),
      y: clamp(safeHeight * 0.52, topY + roomHeight + 22, bottomY - 20)
    },
    seats: createSeats(rooms)
  };
}

function createCompactRooms(
  width: number,
  _height: number,
  pad: number,
  gap: number,
  topY: number,
  bottomY: number,
  roomHeight: number
): GomiOfficeRoomLayout[] {
  const usable = width - pad * 2;

  return [
    room('ceo-office', 'CEO Office', pad, topY, usable * 0.24, roomHeight),
    room('analysis-bay', 'Analysis Bay', pad + usable * 0.24 + gap, topY, usable * 0.28, roomHeight),
    room('frontend-studio', 'Frontend Studio', pad + usable * 0.52 + gap * 2, topY, usable * 0.24, roomHeight),
    room('design-studio', 'Design', pad + usable * 0.76 + gap * 3, topY, usable * 0.16 - gap * 3, roomHeight),
    room('backend-den', 'Backend Den', pad, bottomY, usable * 0.24, roomHeight),
    room('data-lab', 'Data Lab', pad + usable * 0.24 + gap, bottomY, usable * 0.23, roomHeight),
    room('qa-desk', 'QA Desk', pad + usable * 0.47 + gap * 2, bottomY, usable * 0.23, roomHeight),
    room('devops-pod', 'DevOps Pod', pad + usable * 0.7 + gap * 3, bottomY, usable * 0.3 - gap * 3, roomHeight)
  ];
}

function createDesktopRooms(width: number, topY: number, bottomY: number, roomHeight: number): GomiOfficeRoomLayout[] {
  return [
    room('ceo-office', 'CEO Office', width * 0.05, topY, width * 0.21, roomHeight),
    room('analysis-bay', 'Analysis Bay', width * 0.31, topY, width * 0.2, roomHeight),
    room('backend-den', 'Backend Den', width * 0.54, topY, width * 0.16, roomHeight),
    room('frontend-studio', 'Frontend Studio', width * 0.73, topY, width * 0.14, roomHeight),
    room('design-studio', 'Design', width * 0.89, topY, width * 0.07, roomHeight),
    room('data-lab', 'Data Lab', width * 0.05, bottomY, width * 0.24, roomHeight),
    room('qa-desk', 'QA Desk', width * 0.37, bottomY, width * 0.25, roomHeight),
    room('devops-pod', 'DevOps Pod', width * 0.72, bottomY, width * 0.24, roomHeight)
  ];
}

function createSeats(rooms: GomiOfficeRoomLayout[]): GomiOfficeAgentSeat[] {
  return (Object.entries(agentRoomIds) as Array<[GomiAgentId, string]>).map(([agentId, roomId]) => {
    const targetRoom = rooms.find((candidate) => candidate.id === roomId) ?? rooms[0];

    return {
      agentId,
      roomId,
      x: targetRoom.x + targetRoom.width * 0.5,
      y: targetRoom.y + targetRoom.height * 0.68
    };
  });
}

function room(
  id: string,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number
): GomiOfficeRoomLayout {
  return {
    id,
    label,
    x,
    y,
    width: Math.max(48, width),
    height: Math.max(58, height)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

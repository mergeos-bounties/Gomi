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

export interface GomiOfficeConversationRoute {
  speakerId: GomiAgentId;
  recipientId: GomiAgentId;
  speakerSeat: { x: number; y: number };
  recipientSeat: { x: number; y: number };
  speakerVisitPoint: { x: number; y: number };
  bubbleAnchor: { x: number; y: number };
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

const fallbackConversationRecipients: Record<GomiAgentId, GomiAgentId[]> = {
  ceo: ['system-analyst', 'qa'],
  'system-analyst': ['backend', 'database', 'designer', 'qa'],
  backend: ['database', 'qa', 'frontend'],
  frontend: ['designer', 'qa', 'backend'],
  designer: ['frontend', 'qa'],
  database: ['backend', 'qa'],
  qa: ['backend', 'frontend', 'devops'],
  devops: ['backend', 'qa']
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

export function isGomiAgentId(value: string): value is GomiAgentId {
  return Object.prototype.hasOwnProperty.call(agentRoomIds, value);
}

export function resolveGomiConversationRecipient(
  senderId: GomiAgentId,
  explicitRecipientId?: string,
  availableAgentIds: GomiAgentId[] = Object.keys(agentRoomIds) as GomiAgentId[]
): GomiAgentId | undefined {
  const available = new Set(availableAgentIds);

  if (
    explicitRecipientId &&
    isGomiAgentId(explicitRecipientId) &&
    explicitRecipientId !== senderId &&
    available.has(explicitRecipientId)
  ) {
    return explicitRecipientId;
  }

  return (
    fallbackConversationRecipients[senderId].find((agentId) => agentId !== senderId && available.has(agentId)) ??
    availableAgentIds.find((agentId) => agentId !== senderId)
  );
}

export function createGomiConversationRoute(
  width: number,
  height: number,
  seats: GomiOfficeAgentSeat[],
  speakerId: GomiAgentId,
  recipientId: GomiAgentId
): GomiOfficeConversationRoute | undefined {
  if (speakerId === recipientId) {
    return undefined;
  }

  const speakerSeat = seats.find((seat) => seat.agentId === speakerId);
  const recipientSeat = seats.find((seat) => seat.agentId === recipientId);

  if (!speakerSeat || !recipientSeat) {
    return undefined;
  }

  const dx = recipientSeat.x - speakerSeat.x;
  const dy = recipientSeat.y - speakerSeat.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const unitX = dx / distance;
  const unitY = dy / distance;
  const approachDistance = clamp(distance * 0.22, 38, 62);
  const speakerVisitPoint = {
    x: clamp(recipientSeat.x - unitX * approachDistance, 34, width - 34),
    y: clamp(recipientSeat.y - unitY * approachDistance, 78, height - 40)
  };
  const bubbleAnchor = {
    x: clamp((speakerVisitPoint.x + recipientSeat.x) / 2, 34, width - 34),
    y: clamp(Math.min(speakerVisitPoint.y, recipientSeat.y) - 96, 18, height - 72)
  };

  return {
    speakerId,
    recipientId,
    speakerSeat,
    recipientSeat,
    speakerVisitPoint,
    bubbleAnchor
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

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type {
  GomiAgent,
  GomiAgentSeat,
  GomiChatMessage,
  GomiMemoryBoardItem,
  GomiOfficeSettings,
  GomiTask
} from '../common/gomiTypes';
import {
  agentRoomIds,
  createGomiOfficeLayout,
  type GomiOfficeBoardLayout,
  type GomiOfficeRoomLayout
} from './gomiOfficeLayout';

interface PhaserOfficeProps {
  agents: GomiAgent[];
  officeSettings: GomiOfficeSettings;
  tasks: GomiTask[];
  messages: GomiChatMessage[];
  memoryItems?: GomiMemoryBoardItem[];
  layoutToken?: string;
}

const statusColors: Record<GomiAgent['status'], number> = {
  idle: 0x64748b,
  planning: 0x2dd4bf,
  working: 0x38bdf8,
  waiting: 0x94a3b8,
  reviewing: 0xfbbf24,
  sleeping: 0x818cf8,
  done: 0x22c55e,
  blocked: 0xf43f5e
};

const roleColors: Record<GomiAgent['id'], number> = {
  ceo: 0x2dd4bf,
  'system-analyst': 0x60a5fa,
  backend: 0xa78bfa,
  frontend: 0xf472b6,
  designer: 0xfb7185,
  database: 0x38bdf8,
  qa: 0xfbbf24,
  devops: 0x34d399
};

export function PhaserOffice({
  agents,
  officeSettings,
  tasks,
  messages,
  memoryItems = [],
  layoutToken
}: PhaserOfficeProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GomiOfficeScene | null>(null);
  const agentsRef = useRef(agents);
  const officeSettingsRef = useRef(officeSettings);
  const tasksRef = useRef(tasks);
  const messagesRef = useRef(messages);
  const memoryItemsRef = useRef(memoryItems);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    agentsRef.current = agents;
    officeSettingsRef.current = officeSettings;
    tasksRef.current = tasks;
    messagesRef.current = messages;
    memoryItemsRef.current = memoryItems;
    sceneRef.current?.renderOffice(agents, officeSettings, tasks, messages, memoryItems);
  }, [agents, officeSettings, tasks, messages, memoryItems]);

  useEffect(() => {
    const frame = globalThis.requestAnimationFrame(() => {
      resizeGameToHost(hostRef.current, gameRef.current);
      sceneRef.current?.renderOffice(
        agentsRef.current,
        officeSettingsRef.current,
        tasksRef.current,
        messagesRef.current,
        memoryItemsRef.current
      );
    });

    return () => {
      globalThis.cancelAnimationFrame(frame);
    };
  }, [layoutToken]);

  useEffect(() => {
    if (!hostRef.current || gameRef.current) {
      return;
    }

    class OfficeScene extends Phaser.Scene implements GomiOfficeScene {
      constructor() {
        super('GomiOfficeScene');
      }

      create() {
        sceneRef.current = this;
        this.renderOffice(
          agentsRef.current,
          officeSettingsRef.current,
          tasksRef.current,
          messagesRef.current,
          memoryItemsRef.current
        );
      }

      renderOffice(
        nextAgents: GomiAgent[],
        nextOfficeSettings: GomiOfficeSettings,
        nextTasks: GomiTask[],
        nextMessages: GomiChatMessage[],
        nextMemoryItems: GomiMemoryBoardItem[]
      ) {
        const width = this.game.canvas.width || this.scale.width || 640;
        const height = this.game.canvas.height || this.scale.height || 360;
        const officeLayout = createGomiOfficeLayout(width, height);
        const latestSpeech = this.getLatestSpeechBySender(nextMessages);

        this.children.removeAll(true);
        this.tweens.killAll();

        const graphics = this.add.graphics();
        this.drawOfficeShell(graphics, width, height, officeLayout.rooms);
        this.drawMemoryBoard(graphics, officeLayout.memoryBoard, nextTasks, nextMessages, nextMemoryItems);
        this.drawStatusWall(graphics, officeLayout.statusWall, nextAgents, nextTasks, nextOfficeSettings.seats);
        this.drawGomiRoute(graphics, officeLayout.gomiHub, officeLayout.seats, nextAgents);
        this.drawDepartmentStaff(graphics, officeLayout.rooms, nextOfficeSettings.seats);

        for (const agent of nextAgents) {
          const seat = officeLayout.seats.find((candidate) => candidate.agentId === agent.id);
          this.drawAgent(agent, width, height, latestSpeech.get(agent.id), seat);
        }

        this.drawGomiGuide(
          officeLayout.gomiHub.x,
          officeLayout.gomiHub.y,
          width,
          nextTasks.some((task) => task.status === 'running'),
          latestSpeech.get('pet-gomi')
        );
      }

      private drawOfficeShell(
        graphics: Phaser.GameObjects.Graphics,
        width: number,
        height: number,
        rooms: GomiOfficeRoomLayout[]
      ) {
        graphics.fillStyle(0xdbeafe, 1);
        graphics.fillRect(0, 0, width, height);
        graphics.fillStyle(0xf8fafc, 1);
        graphics.fillRoundedRect(18, 18, width - 36, height - 36, 14);

        this.drawFloorGrid(graphics, width, height);

        graphics.lineStyle(2, 0x93c5fd, 1);
        graphics.strokeRoundedRect(18, 18, width - 36, height - 36, 14);

        for (const roomLayout of rooms) {
          this.drawRoom(graphics, roomLayout);
        }

        this.drawFurniture(graphics, width, height, rooms);
      }

      private drawFloorGrid(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
        graphics.fillStyle(0xf1f5f9, 1);
        graphics.fillRoundedRect(26, 26, width - 52, height - 52, 12);
        graphics.lineStyle(1, 0xcbd5e1, 0.42);

        for (let x = 32; x < width - 24; x += 34) {
          graphics.lineBetween(x, 24, x, height - 24);
        }

        for (let y = 32; y < height - 24; y += 34) {
          graphics.lineBetween(24, y, width - 24, y);
        }

        graphics.fillStyle(0xbfdbfe, 0.78);
        graphics.fillRoundedRect(width * 0.27, height * 0.41, width * 0.46, height * 0.1, 20);
        graphics.fillStyle(0xfef3c7, 0.85);
        graphics.fillRoundedRect(width * 0.34, height * 0.445, width * 0.32, height * 0.018, 8);
      }

      private drawRoom(
        graphics: Phaser.GameObjects.Graphics,
        roomLayout: GomiOfficeRoomLayout
      ) {
        const { x, y, width, height, label } = roomLayout;
        const departmentId = roomDepartmentId(roomLayout.id) ?? 'ceo';
        const accent = roleColors[departmentId];

        graphics.fillStyle(0xffffff, 0.98);
        graphics.fillRoundedRect(x, y, width, height, 10);
        graphics.fillStyle(accent, 0.13);
        graphics.fillRoundedRect(x + 5, y + 5, width - 10, 25, 7);
        graphics.lineStyle(2, accent, 0.75);
        graphics.strokeRoundedRect(x, y, width, height, 10);
        graphics.lineStyle(3, 0xf1f5f9, 1);
        graphics.lineBetween(x + width * 0.45, y + height, x + width * 0.62, y + height);
        this.add.text(x + 12, y + 10, label, {
          color: '#0f172a',
          fontFamily: 'Inter, Arial',
          fontSize: '13px',
          fontStyle: '700'
        });
      }

      private drawFurniture(
        graphics: Phaser.GameObjects.Graphics,
        width: number,
        height: number,
        rooms: GomiOfficeRoomLayout[]
      ) {
        for (const roomLayout of rooms) {
          const desk = {
            x: roomLayout.x + Math.max(10, roomLayout.width * 0.16),
            y: roomLayout.y + roomLayout.height * 0.62
          };
          const deskWidth = Math.min(92, Math.max(48, roomLayout.width * 0.58));

          graphics.fillStyle(0xbf7c2a, 1);
          graphics.fillRoundedRect(desk.x, desk.y, deskWidth, 34, 8);
          graphics.fillStyle(0x0f172a, 1);
          graphics.fillRoundedRect(desk.x + 10, desk.y + 7, 32, 18, 4);
          graphics.fillStyle(0xdbeafe, 1);
          graphics.fillRoundedRect(desk.x + deskWidth - 32, desk.y + 8, 20, 14, 3);
          graphics.fillStyle(0x64748b, 1);
          graphics.fillRoundedRect(desk.x + deskWidth * 0.35, desk.y + 40, 34, 14, 6);
          graphics.fillStyle(0x93c5fd, 0.55);
          graphics.fillRoundedRect(desk.x - 3, desk.y + 22, 14, 20, 6);
          graphics.fillRoundedRect(desk.x + deskWidth - 11, desk.y + 22, 14, 20, 6);
        }

        graphics.fillStyle(0x0f766e, 0.98);
        graphics.fillRoundedRect(width * 0.42, height * 0.43, width * 0.16, height * 0.06, 12);
        graphics.fillStyle(0xf8fafc, 1);
        graphics.fillCircle(width * 0.45, height * 0.46, 6);
        graphics.fillCircle(width * 0.5, height * 0.46, 6);
        graphics.fillCircle(width * 0.55, height * 0.46, 6);

        this.drawPlant(graphics, width * 0.05, height * 0.43);
        this.drawPlant(graphics, width * 0.91, height * 0.43);
        this.drawWindow(graphics, width * 0.41, height * 0.035, width * 0.2, height * 0.05);
      }

      private drawMemoryBoard(
        graphics: Phaser.GameObjects.Graphics,
        boardLayout: GomiOfficeBoardLayout,
        tasks: GomiTask[],
        messages: GomiChatMessage[],
        memoryItems: GomiMemoryBoardItem[]
      ) {
        const { x, y, width: boardWidth, height: boardHeight } = boardLayout;
        const notes = this.createMemoryNotes(tasks, messages, memoryItems);

        graphics.fillStyle(0x422006, 1);
        graphics.fillRoundedRect(x - 8, y - 8, boardWidth + 16, boardHeight + 16, 10);
        graphics.fillStyle(0xf8fafc, 1);
        graphics.fillRoundedRect(x, y, boardWidth, boardHeight, 8);
        graphics.lineStyle(2, 0xfbbf24, 1);
        graphics.strokeRoundedRect(x, y, boardWidth, boardHeight, 8);

        this.add.text(x + 12, y + 10, 'Memory Board', {
          color: '#111827',
          fontFamily: 'Inter, Arial',
          fontSize: '13px',
          fontStyle: '700'
        });

        notes.forEach((note, index) => {
          const noteX = x + 12 + (index % 2) * (boardWidth * 0.48);
          const noteY = y + 36 + Math.floor(index / 2) * 34;
          const noteColor = [0xfef3c7, 0xccfbf1, 0xdbeafe, 0xfce7f3][index % 4];

          graphics.fillStyle(noteColor, 1);
          graphics.fillRoundedRect(noteX, noteY, boardWidth * 0.43, 26, 4);
          this.add.text(noteX + 6, noteY + 5, note, {
            color: '#111827',
            fontFamily: 'Inter, Arial',
            fontSize: '10px',
            wordWrap: { width: boardWidth * 0.43 - 12 }
          });
        });
      }

      private drawStatusWall(
        graphics: Phaser.GameObjects.Graphics,
        wallLayout: GomiOfficeBoardLayout,
        agents: GomiAgent[],
        tasks: GomiTask[],
        seats: GomiAgentSeat[]
      ) {
        const { x, y, width, height } = wallLayout;
        const runningCount = tasks.filter((task) => task.status === 'running').length;
        const doneCount = tasks.filter((task) => task.status === 'done').length;
        const blockedCount = agents.filter((agent) => agent.status === 'blocked').length;
        const sleepingCount = agents.filter((agent) => agent.status === 'sleeping').length;
        const employees = seats.filter((seat) => seat.seatKind === 'employee');
        const activeEmployees = employees.filter((seat) => seat.workMode !== 'fired').length;
        const rows = [
          `Active ${runningCount}`,
          `Done ${doneCount}/${Math.max(tasks.length, 1)}`,
          blockedCount > 0 ? `Blocked ${blockedCount}` : `Sleep ${sleepingCount}`,
          `Staff ${activeEmployees}/${Math.max(employees.length, 1)}`
        ];

        graphics.fillStyle(0xecfeff, 0.97);
        graphics.fillRoundedRect(x, y, width, height, 10);
        graphics.lineStyle(2, 0x14b8a6, 0.9);
        graphics.strokeRoundedRect(x, y, width, height, 10);

        this.add.text(x + 12, y + 10, 'Status Wall', {
          color: '#0f172a',
          fontFamily: 'Inter, Arial',
          fontSize: '13px',
          fontStyle: '700'
        });

        rows.forEach((row, index) => {
          const rowY = y + 34 + index * 20;
          const color = [0x2dd4bf, 0x22c55e, 0x818cf8, 0xfbbf24][index];

          graphics.fillStyle(color, 0.85);
          graphics.fillCircle(x + 14, rowY + 6, 4);
          this.add.text(x + 24, rowY, row, {
            color: '#0f172a',
            fontFamily: 'Inter, Arial',
            fontSize: '11px'
          });
        });
      }

      private drawDepartmentStaff(
        graphics: Phaser.GameObjects.Graphics,
        rooms: GomiOfficeRoomLayout[],
        seats: GomiAgentSeat[]
      ) {
        const employees = seats.filter((seat) => seat.seatKind === 'employee');

        for (const roomLayout of rooms) {
          const departmentId = roomDepartmentId(roomLayout.id);
          const departmentEmployees = employees.filter((seat) => seat.departmentId === departmentId);
          const activeEmployees = departmentEmployees.filter((seat) => seat.workMode !== 'fired');
          const firedEmployees = departmentEmployees.filter((seat) => seat.workMode === 'fired');

          activeEmployees.slice(0, 6).forEach((seat, index) => {
            this.drawEmployeeAvatar(seat, roomLayout, index, activeEmployees.length);
          });

          if (activeEmployees.length > 6) {
            this.drawStaffOverflow(roomLayout, activeEmployees.length - 6);
          }

          if (firedEmployees.length > 0) {
            this.drawOffboardedStaff(graphics, roomLayout, firedEmployees.length);
          }
        }
      }

      private drawEmployeeAvatar(
        seat: GomiAgentSeat,
        roomLayout: GomiOfficeRoomLayout,
        index: number,
        total: number
      ) {
        const columns = roomLayout.width < 120 ? 2 : 3;
        const spacingX = Math.min(31, Math.max(22, roomLayout.width / (columns + 1)));
        const spacingY = 30;
        const startX = roomLayout.x + roomLayout.width * 0.18;
        const startY = roomLayout.y + roomLayout.height * 0.35;
        const horizontalPadding = Math.min(16, Math.max(8, roomLayout.width * 0.15));
        const topPadding = Math.min(38, Math.max(22, roomLayout.height * 0.36));
        const bottomPadding = Math.min(34, Math.max(18, roomLayout.height * 0.28));
        const x = clampWithin(
          startX + (index % columns) * spacingX,
          roomLayout.x + horizontalPadding,
          roomLayout.x + roomLayout.width - horizontalPadding
        );
        const y = clampWithin(
          startY + Math.floor(index / columns) * spacingY,
          roomLayout.y + topPadding,
          roomLayout.y + roomLayout.height - bottomPadding
        );
        const color = roleColors[seat.agentId];
        const group = this.add.container(x, y);

        group.add(this.add.ellipse(0, 15, 28, 10, 0x475569, 0.16));
        group.add(this.add.circle(0, -4, 11, 0xffedd5, 1));
        group.add(this.add.rectangle(0, 13, 18, 18, color, 0.95).setOrigin(0.5));
        group.add(this.add.rectangle(0, -13, 17, 7, color, 0.92).setOrigin(0.5));
        group.add(this.add.circle(-4, -5, 1.4, 0x111827, 1));
        group.add(this.add.circle(4, -5, 1.4, 0x111827, 1));
        group.add(this.add.arc(0, -1, 4, 20, 160, false).setStrokeStyle(1, 0x111827));
        group.add(this.add.circle(10, -14, 3.8, 0x22c55e, 1));

        if (total > 1) {
          this.tweens.add({
            targets: group,
            y: y - 3,
            duration: 900 + index * 120,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      }

      private drawStaffOverflow(roomLayout: GomiOfficeRoomLayout, count: number) {
        this.add
          .text(roomLayout.x + roomLayout.width - 28, roomLayout.y + roomLayout.height - 42, `+${count}`, {
            color: '#14532d',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700',
            backgroundColor: '#dcfce7',
            padding: { x: 5, y: 3 }
          })
          .setOrigin(0.5, 0);
      }

      private drawOffboardedStaff(
        graphics: Phaser.GameObjects.Graphics,
        roomLayout: GomiOfficeRoomLayout,
        count: number
      ) {
        const x = roomLayout.x + roomLayout.width - 22;
        const y = roomLayout.y + roomLayout.height - 24;

        graphics.fillStyle(0x94a3b8, 0.6);
        graphics.fillCircle(x, y - 8, 8);
        graphics.fillRoundedRect(x - 10, y, 20, 14, 4);
        graphics.fillStyle(0x475569, 0.9);
        graphics.fillRoundedRect(x - 7, y + 11, 14, 8, 3);
        this.add.text(x + 13, y - 15, `left ${count}`, {
          color: '#475569',
          fontFamily: 'Inter, Arial',
          fontSize: '10px',
          fontStyle: '700'
        });
      }

      private createMemoryNotes(
        tasks: GomiTask[],
        messages: GomiChatMessage[],
        memoryItems: GomiMemoryBoardItem[]
      ): string[] {
        if (memoryItems.length > 0) {
          return memoryItems
            .slice(-4)
            .reverse()
            .map((item) =>
              this.shorten(
                `${this.shorten(item.title, 12)}: ${item.content.replace(/\s+/g, ' ')}`,
                34
              )
            );
        }

        const runningTask = tasks.find((task) => task.status === 'running');
        const doneCount = tasks.filter((task) => task.status === 'done').length;
        const latestAgent = [...messages].reverse().find((message) => message.senderId !== 'user');

        return [
          runningTask ? `Now: ${this.shorten(runningTask.title, 17)}` : 'Goal: plan safely',
          `Done: ${doneCount}/${Math.max(tasks.length, 1)}`,
          latestAgent ? `Said: ${this.shorten(latestAgent.senderName, 12)}` : 'Context first',
          'Patch needs approval'
        ];
      }

      private drawAgent(
        agent: GomiAgent,
        width: number,
        height: number,
        bubbleText?: string,
        seat?: { x: number; y: number }
      ) {
        const x = seat?.x ?? (agent.position.x / 100) * width;
        const y = seat?.y ?? (agent.position.y / 100) * height;

        if (agent.status === 'sleeping') {
          this.drawSleepingAgent(agent, x, y, width);
          return;
        }

        const color = roleColors[agent.id];
        const statusColor = statusColors[agent.status];
        const isActive = agent.status !== 'idle' && agent.status !== 'waiting';
        const group = this.add.container(x, y);

        group.add(this.add.ellipse(0, 28, 54, 18, 0x475569, 0.18));
        group.add(this.add.rectangle(-11, 34, 10, 13, 0x334155, 1).setOrigin(0.5));
        group.add(this.add.rectangle(11, 34, 10, 13, 0x334155, 1).setOrigin(0.5));
        group.add(this.add.rectangle(0, 11, 34, 36, color, 1).setOrigin(0.5));
        group.add(this.add.circle(0, -18, 22, 0xffedd5, 1));
        group.add(this.add.rectangle(0, -33, 36, 14, color, 1).setOrigin(0.5));
        group.add(this.add.circle(-8, -20, 2.4, 0x111827, 1));
        group.add(this.add.circle(8, -20, 2.4, 0x111827, 1));
        group.add(this.add.circle(-13, -13, 3, 0xfca5a5, 0.75));
        group.add(this.add.circle(13, -13, 3, 0xfca5a5, 0.75));
        group.add(this.add.arc(0, -13, 8, 20, 160, false).setStrokeStyle(2, 0x111827));

        const badge = this.add.circle(24, -34, 7, statusColor, 1);
        group.add(badge);

        this.add
          .text(x, y + 43, agent.name.replace(' Agent', ''), {
            color: '#0f172a',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700',
            backgroundColor: '#ffffff',
            padding: { x: 5, y: 2 }
          })
          .setOrigin(0.5, 0);

        if (isActive) {
          this.tweens.add({
            targets: group,
            y: y - 8,
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          this.tweens.add({
            targets: badge,
            scale: 1.35,
            duration: 420,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }

        if (bubbleText) {
          this.drawSpeechBubble(x, y - 88, this.shorten(bubbleText, 58), width);
        }
      }

      private drawGomiRoute(
        graphics: Phaser.GameObjects.Graphics,
        hub: { x: number; y: number },
        seats: Array<{ agentId: GomiAgent['id']; roomId: string; x: number; y: number }>,
        agents: GomiAgent[]
      ) {
        const activeAgents = agents.filter((agent) =>
          ['planning', 'working', 'reviewing', 'blocked'].includes(agent.status)
        );

        if (activeAgents.length === 0) {
          return;
        }

        graphics.lineStyle(3, 0x0f766e, 0.42);

        for (const agent of activeAgents.slice(0, 3)) {
          const roomId = agentRoomIds[agent.id];
          const target = seats.find((seat) => seat.roomId === roomId);

          if (!target) {
            continue;
          }

          graphics.lineBetween(hub.x, hub.y, target.x, target.y);
          graphics.fillStyle(statusColors[agent.status], 0.85);
          graphics.fillCircle((hub.x + target.x) / 2, (hub.y + target.y) / 2, 5);
        }
      }

      private drawSleepingAgent(agent: GomiAgent, x: number, y: number, sceneWidth: number) {
        const group = this.add.container(x, y);
        const color = roleColors[agent.id];

        group.add(this.add.ellipse(0, 30, 70, 18, 0x475569, 0.18));
        group.add(this.add.rectangle(0, 14, 68, 24, 0x475569, 1).setOrigin(0.5));
        group.add(this.add.rectangle(12, 4, 48, 18, color, 1).setOrigin(0.5));
        group.add(this.add.circle(-24, 2, 14, 0xffedd5, 1));
        group.add(this.add.rectangle(7, 12, 58, 18, 0x93c5fd, 0.92).setOrigin(0.5));
        group.add(this.add.arc(-26, 1, 6, 20, 150, false).setStrokeStyle(2, 0x111827));
        group.add(this.add.circle(31, -9, 7, statusColors.sleeping, 1));

        this.add
          .text(x, y + 44, agent.name.replace(' Agent', ''), {
            color: '#0f172a',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700',
            backgroundColor: '#ffffff',
            padding: { x: 5, y: 2 }
          })
          .setOrigin(0.5, 0);

        this.add.text(x + 28, y - 42, 'Zzz', {
          color: '#c4b5fd',
          fontFamily: 'Inter, Arial',
          fontSize: '13px',
          fontStyle: '700'
        });

        this.tweens.add({
          targets: group,
          y: y - 3,
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });

        this.drawSpeechBubble(x, y - 82, 'Sleeping. Seat retained.', sceneWidth);
      }

      private drawGomiGuide(x: number, y: number, sceneWidth: number, isMoving: boolean, bubbleText?: string) {
        const group = this.add.container(x, y);

        group.add(this.add.ellipse(0, 25, 42, 14, 0x475569, 0.18));
        group.add(this.add.circle(0, 0, 20, 0x2dd4bf, 1));
        group.add(this.add.circle(-7, -3, 3, 0x0f172a, 1));
        group.add(this.add.circle(7, -3, 3, 0x0f172a, 1));
        group.add(this.add.arc(0, 3, 9, 20, 160, false).setStrokeStyle(2, 0x0f172a));
        group.add(this.add.circle(-15, -16, 6, 0xf97316, 1));
        group.add(this.add.circle(15, -16, 6, 0xf97316, 1));

        this.add
          .text(x, y + 30, 'Gomi', {
            color: '#0f172a',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700',
            backgroundColor: '#ccfbf1',
            padding: { x: 5, y: 2 }
          })
          .setOrigin(0.5, 0);

        if (isMoving) {
          this.tweens.add({
            targets: group,
            x: x + 52,
            y: y - 10,
            duration: 960,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }

        if (bubbleText) {
          this.drawSpeechBubble(x, y - 62, this.shorten(bubbleText, 48), sceneWidth);
        }
      }

      private drawSpeechBubble(x: number, y: number, text: string, sceneWidth: number) {
        const bubbleWidth = Math.min(190, Math.max(126, text.length * 5.2));
        const bubbleHeight = text.length > 34 ? 48 : 34;
        const bubbleX = Phaser.Math.Clamp(x - bubbleWidth / 2, 18, sceneWidth - bubbleWidth - 18);
        const bubbleY = Math.max(18, y);
        const graphics = this.add.graphics();

        graphics.fillStyle(0xf8fafc, 1);
        graphics.fillRoundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 10);
        graphics.fillTriangle(
          x - 8,
          bubbleY + bubbleHeight - 1,
          x + 8,
          bubbleY + bubbleHeight - 1,
          x,
          bubbleY + bubbleHeight + 10
        );
        graphics.lineStyle(1, 0x94a3b8, 1);
        graphics.strokeRoundedRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 10);

        this.add.text(bubbleX + 10, bubbleY + 8, text, {
          color: '#111827',
          fontFamily: 'Inter, Arial',
          fontSize: '11px',
          lineSpacing: 2,
          wordWrap: { width: bubbleWidth - 20 }
        });
      }

      private drawPlant(graphics: Phaser.GameObjects.Graphics, x: number, y: number) {
        graphics.fillStyle(0x64748b, 1);
        graphics.fillRoundedRect(x, y + 20, 24, 18, 6);
        graphics.fillStyle(0x22c55e, 1);
        graphics.fillEllipse(x + 8, y + 16, 16, 28);
        graphics.fillEllipse(x + 18, y + 12, 16, 30);
        graphics.fillEllipse(x + 13, y + 3, 18, 28);
      }

      private drawWindow(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        width: number,
        height: number
      ) {
        graphics.fillStyle(0xbae6fd, 1);
        graphics.fillRoundedRect(x, y, width, height, 8);
        graphics.lineStyle(2, 0xffffff, 0.7);
        graphics.lineBetween(x + width / 2, y, x + width / 2, y + height);
        graphics.lineBetween(x, y + height / 2, x + width, y + height / 2);
      }

      private getLatestSpeechBySender(messages: GomiChatMessage[]): Map<GomiChatMessage['senderId'], string> {
        const latest = new Map<GomiChatMessage['senderId'], string>();

        for (const message of [...messages].reverse()) {
          if (message.senderId === 'user' || message.senderId === 'system') {
            continue;
          }

          if (!latest.has(message.senderId)) {
            latest.set(message.senderId, message.content);
          }
        }

        return latest;
      }

      private shorten(value: string, maxLength: number): string {
        if (value.length <= maxLength) {
          return value;
        }

        return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
      }
    }

    gameRef.current = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: hostRef.current,
      backgroundColor: '#111827',
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight
      },
      scene: OfficeScene
    });

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      if (width <= 0 || height <= 0) {
        return;
      }

      if (lastSizeRef.current.width === width && lastSizeRef.current.height === height) {
        return;
      }

      lastSizeRef.current = { width, height };
      resizeGameToHost(host, gameRef.current);
      sceneRef.current?.renderOffice(
        agentsRef.current,
        officeSettingsRef.current,
        tasksRef.current,
        messagesRef.current,
        memoryItemsRef.current
      );
    });

    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, []);

  return <div className="gomi-office-canvas" ref={hostRef} />;
}

function resizeGameToHost(host: HTMLDivElement | null, game: Phaser.Game | null) {
  if (!host || !game) {
    return;
  }

  const width = Math.max(1, Math.floor(host.clientWidth));
  const height = Math.max(1, Math.floor(host.clientHeight));
  const scale = game.scale;
  const canvas = game.canvas;

  scale.resize(width, height);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
}

function roomDepartmentId(roomId: string): GomiAgentSeat['departmentId'] | undefined {
  const entry = (Object.entries(agentRoomIds) as Array<[GomiAgent['id'], string]>)
    .find(([, candidateRoomId]) => candidateRoomId === roomId);
  const agentId = entry?.[0];

  return agentId === 'ceo' ? undefined : agentId;
}

function clampWithin(value: number, min: number, max: number): number {
  if (max < min) {
    return (min + max) / 2;
  }

  return Phaser.Math.Clamp(value, min, max);
}

interface GomiOfficeScene extends Phaser.Scene {
  renderOffice(
    agents: GomiAgent[],
    officeSettings: GomiOfficeSettings,
    tasks: GomiTask[],
    messages: GomiChatMessage[],
    memoryItems: GomiMemoryBoardItem[]
  ): void;
}

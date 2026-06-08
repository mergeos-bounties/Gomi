import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import type {
  GomiAgent,
  GomiChatMessage,
  GomiMemoryBoardItem,
  GomiTask
} from '../common/gomiTypes';

interface PhaserOfficeProps {
  agents: GomiAgent[];
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
  tasks,
  messages,
  memoryItems = [],
  layoutToken
}: PhaserOfficeProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GomiOfficeScene | null>(null);
  const agentsRef = useRef(agents);
  const tasksRef = useRef(tasks);
  const messagesRef = useRef(messages);
  const memoryItemsRef = useRef(memoryItems);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    agentsRef.current = agents;
    tasksRef.current = tasks;
    messagesRef.current = messages;
    memoryItemsRef.current = memoryItems;
    sceneRef.current?.renderOffice(agents, tasks, messages, memoryItems);
  }, [agents, tasks, messages, memoryItems]);

  useEffect(() => {
    const frame = globalThis.requestAnimationFrame(() => {
      resizeGameToHost(hostRef.current, gameRef.current);
      sceneRef.current?.renderOffice(
        agentsRef.current,
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
          tasksRef.current,
          messagesRef.current,
          memoryItemsRef.current
        );
      }

      renderOffice(
        nextAgents: GomiAgent[],
        nextTasks: GomiTask[],
        nextMessages: GomiChatMessage[],
        nextMemoryItems: GomiMemoryBoardItem[]
      ) {
        const width = this.game.canvas.width || this.scale.width || 640;
        const height = this.game.canvas.height || this.scale.height || 360;
        const latestSpeech = this.getLatestSpeechBySender(nextMessages);

        this.children.removeAll(true);
        this.tweens.killAll();

        const graphics = this.add.graphics();
        this.drawOfficeShell(graphics, width, height);
        this.drawMemoryBoard(graphics, width, height, nextTasks, nextMessages, nextMemoryItems);

        for (const agent of nextAgents) {
          this.drawAgent(agent, width, height, latestSpeech.get(agent.id));
        }

        this.drawGomiGuide(
          width,
          height,
          nextTasks.some((task) => task.status === 'running'),
          latestSpeech.get('pet-gomi')
        );
      }

      private drawOfficeShell(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
        graphics.fillStyle(0x0f172a, 1);
        graphics.fillRect(0, 0, width, height);
        graphics.fillStyle(0x172033, 1);
        graphics.fillRoundedRect(18, 18, width - 36, height - 36, 14);

        this.drawFloorGrid(graphics, width, height);

        graphics.lineStyle(2, 0x334155, 1);
        graphics.strokeRoundedRect(18, 18, width - 36, height - 36, 14);

        this.drawRoom(graphics, width * 0.05, height * 0.1, width * 0.25, height * 0.28, 'CEO Office');
        this.drawRoom(
          graphics,
          width * 0.36,
          height * 0.1,
          width * 0.25,
          height * 0.28,
          'Analysis Bay'
        );
        this.drawRoom(
          graphics,
          width * 0.64,
          height * 0.1,
          width * 0.16,
          height * 0.28,
          'Frontend Studio'
        );
        this.drawRoom(
          graphics,
          width * 0.82,
          height * 0.1,
          width * 0.12,
          height * 0.28,
          'Design'
        );
        this.drawRoom(graphics, width * 0.05, height * 0.58, width * 0.25, height * 0.28, 'Data Lab');
        this.drawRoom(graphics, width * 0.38, height * 0.58, width * 0.25, height * 0.28, 'QA Desk');
        this.drawRoom(graphics, width * 0.71, height * 0.58, width * 0.23, height * 0.28, 'DevOps Pod');
        this.drawFurniture(graphics, width, height);
      }

      private drawFloorGrid(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
        graphics.lineStyle(1, 0x253247, 0.55);

        for (let x = 32; x < width - 24; x += 34) {
          graphics.lineBetween(x, 24, x, height - 24);
        }

        for (let y = 32; y < height - 24; y += 34) {
          graphics.lineBetween(24, y, width - 24, y);
        }

        graphics.fillStyle(0x26364e, 0.72);
        graphics.fillRoundedRect(width * 0.29, height * 0.42, width * 0.43, height * 0.09, 18);
      }

      private drawRoom(
        graphics: Phaser.GameObjects.Graphics,
        x: number,
        y: number,
        width: number,
        height: number,
        label: string
      ) {
        graphics.fillStyle(0x1b2638, 0.96);
        graphics.fillRoundedRect(x, y, width, height, 10);
        graphics.lineStyle(1, 0x475569, 1);
        graphics.strokeRoundedRect(x, y, width, height, 10);
        this.add.text(x + 12, y + 10, label, {
          color: '#cbd5e1',
          fontFamily: 'Inter, Arial',
          fontSize: '13px',
          fontStyle: '700'
        });
      }

      private drawFurniture(graphics: Phaser.GameObjects.Graphics, width: number, height: number) {
        const desks = [
          { x: width * 0.11, y: height * 0.28 },
          { x: width * 0.43, y: height * 0.28 },
          { x: width * 0.68, y: height * 0.28 },
          { x: width * 0.83, y: height * 0.28 },
          { x: width * 0.11, y: height * 0.75 },
          { x: width * 0.45, y: height * 0.75 },
          { x: width * 0.76, y: height * 0.75 }
        ];

        for (const desk of desks) {
          graphics.fillStyle(0x8b5e34, 1);
          graphics.fillRoundedRect(desk.x, desk.y, 92, 34, 8);
          graphics.fillStyle(0x334155, 1);
          graphics.fillRoundedRect(desk.x + 10, desk.y + 7, 32, 18, 4);
          graphics.fillStyle(0xe2e8f0, 1);
          graphics.fillRoundedRect(desk.x + 54, desk.y + 8, 20, 14, 3);
          graphics.fillStyle(0x475569, 1);
          graphics.fillRoundedRect(desk.x + 29, desk.y + 40, 34, 14, 6);
        }

        graphics.fillStyle(0x0f766e, 1);
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
        width: number,
        height: number,
        tasks: GomiTask[],
        messages: GomiChatMessage[],
        memoryItems: GomiMemoryBoardItem[]
      ) {
        const boardWidth = Math.min(270, width * 0.34);
        const boardHeight = Math.min(118, height * 0.28);
        const x = width * 0.33;
        const y = height * 0.14;
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

      private drawAgent(agent: GomiAgent, width: number, height: number, bubbleText?: string) {
        const x = (agent.position.x / 100) * width;
        const y = (agent.position.y / 100) * height;

        if (agent.status === 'sleeping') {
          this.drawSleepingAgent(agent, x, y, width);
          return;
        }

        const color = roleColors[agent.id];
        const statusColor = statusColors[agent.status];
        const isActive = agent.status !== 'idle' && agent.status !== 'waiting';
        const group = this.add.container(x, y);

        group.add(this.add.ellipse(0, 28, 54, 18, 0x020617, 0.24));
        group.add(this.add.rectangle(-11, 34, 10, 13, 0x1e293b, 1).setOrigin(0.5));
        group.add(this.add.rectangle(11, 34, 10, 13, 0x1e293b, 1).setOrigin(0.5));
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
            color: '#e5e7eb',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700'
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

      private drawSleepingAgent(agent: GomiAgent, x: number, y: number, sceneWidth: number) {
        const group = this.add.container(x, y);
        const color = roleColors[agent.id];

        group.add(this.add.ellipse(0, 30, 70, 18, 0x020617, 0.24));
        group.add(this.add.rectangle(0, 14, 68, 24, 0x1e293b, 1).setOrigin(0.5));
        group.add(this.add.rectangle(12, 4, 48, 18, color, 1).setOrigin(0.5));
        group.add(this.add.circle(-24, 2, 14, 0xffedd5, 1));
        group.add(this.add.rectangle(7, 12, 58, 18, 0x93c5fd, 0.92).setOrigin(0.5));
        group.add(this.add.arc(-26, 1, 6, 20, 150, false).setStrokeStyle(2, 0x111827));
        group.add(this.add.circle(31, -9, 7, statusColors.sleeping, 1));

        this.add
          .text(x, y + 44, agent.name.replace(' Agent', ''), {
            color: '#e5e7eb',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700'
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

      private drawGomiGuide(width: number, height: number, isMoving: boolean, bubbleText?: string) {
        const x = width * 0.5;
        const y = height * 0.48;
        const group = this.add.container(x, y);

        group.add(this.add.ellipse(0, 25, 42, 14, 0x020617, 0.22));
        group.add(this.add.circle(0, 0, 20, 0x2dd4bf, 1));
        group.add(this.add.circle(-7, -3, 3, 0x0f172a, 1));
        group.add(this.add.circle(7, -3, 3, 0x0f172a, 1));
        group.add(this.add.arc(0, 3, 9, 20, 160, false).setStrokeStyle(2, 0x0f172a));
        group.add(this.add.circle(-15, -16, 6, 0xf97316, 1));
        group.add(this.add.circle(15, -16, 6, 0xf97316, 1));

        this.add
          .text(x, y + 30, 'Gomi', {
            color: '#ccfbf1',
            fontFamily: 'Inter, Arial',
            fontSize: '12px',
            fontStyle: '700'
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
          this.drawSpeechBubble(x, y - 62, this.shorten(bubbleText, 48), width);
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
        graphics.fillStyle(0x475569, 1);
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

interface GomiOfficeScene extends Phaser.Scene {
  renderOffice(
    agents: GomiAgent[],
    tasks: GomiTask[],
    messages: GomiChatMessage[],
    memoryItems: GomiMemoryBoardItem[]
  ): void;
}

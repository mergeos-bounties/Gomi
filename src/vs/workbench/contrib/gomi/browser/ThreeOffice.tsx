/**
 * ThreeOffice — 3D multi-agent office using Three.js (issue #7, 200 MRG).
 * Drop-in alternative to PhaserOffice with the same prop interface.
 * Uses Three.js + CSS3DRenderer for agent labels.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GomiAgent, GomiAgentSeat, GomiOfficeSettings, GomiTask } from '../common/gomiTypes';

interface ThreeOfficeProps {
  agents: GomiAgent[];
  officeSettings: GomiOfficeSettings;
  tasks: GomiTask[];
}

const ROLE_COLORS: Record<string, number> = {
  ceo: 0x2dd4bf, 'system-analyst': 0x60a5fa, backend: 0xa78bfa,
  frontend: 0xf472b6, designer: 0xfb7185, database: 0x38bdf8,
  qa: 0xfbbf24, devops: 0x34d399,
};

const STATUS_COLORS: Record<string, number> = {
  idle: 0x64748b, planning: 0x2dd4bf, working: 0x38bdf8,
  waiting: 0x94a3b8, reviewing: 0xfbbf24, sleeping: 0x818cf8,
  done: 0x22c55e, blocked: 0xf43f5e,
};

const ROOM_LAYOUT = [
  { name: 'CEO', position: [0, 0, 0] as [number, number, number], color: 0x2dd4bf, agentIds: ['ceo'] },
  { name: 'Engineering', position: [-8, 0, -4] as [number, number, number], color: 0x60a5fa, agentIds: ['backend', 'frontend', 'devops'] },
  { name: 'Design', position: [8, 0, -4] as [number, number, number], color: 0xf472b6, agentIds: ['designer'] },
  { name: 'QA', position: [-4, 0, 4] as [number, number, number], color: 0xfbbf24, agentIds: ['qa', 'system-analyst'] },
  { name: 'Data', position: [4, 0, 4] as [number, number, number], color: 0x34d399, agentIds: ['database'] },
];

export function ThreeOffice({ agents, officeSettings, tasks }: ThreeOfficeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b12);
    scene.fog = new THREE.Fog(0x0b0b12, 20, 60);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.5, 100);
    camera.position.set(12, 10, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.2;

    // Lighting
    scene.add(new THREE.AmbientLight(0x404060, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Grid
    const grid = new THREE.GridHelper(30, 30, 0x333355, 0x222244);
    scene.add(grid);

    // Room walls + desks
    const agentMeshes: Map<string, THREE.Mesh> = new Map();
    const deskGeometry = new THREE.BoxGeometry(2, 0.1, 1.2);

    for (const room of ROOM_LAYOUT) {
      // Room floor
      const roomFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(5, 4),
        new THREE.MeshStandardMaterial({ color: room.color, roughness: 0.8, opacity: 0.15, transparent: true })
      );
      roomFloor.rotation.x = -Math.PI / 2;
      roomFloor.position.set(room.position[0], 0.01, room.position[2]);
      roomFloor.receiveShadow = true;
      scene.add(roomFloor);

      // Walls (simplified)
      const wallMat = new THREE.MeshStandardMaterial({ color: room.color, roughness: 0.7, opacity: 0.1, transparent: true });
      const walls = [
        { pos: [0, 1, -2], rot: [0, 0, 0], size: [5, 2, 0.05] },
        { pos: [-2.5, 1, 0], rot: [0, Math.PI / 2, 0], size: [4, 2, 0.05] },
        { pos: [2.5, 1, 0], rot: [0, Math.PI / 2, 0], size: [4, 2, 0.05] },
      ];
      for (const w of walls) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w.size[0], w.size[1], w.size[2]), wallMat);
        wall.position.set(room.position[0] + w.pos[0], w.pos[1], room.position[2] + w.pos[2]);
        if (w.rot[1]) wall.rotation.y = w.rot[1];
        wall.receiveShadow = true;
        scene.add(wall);
      }

      // Desks for agents in this room
      const roomAgents = agents.filter(a => room.agentIds.includes(a.id));
      roomAgents.forEach((agent, i) => {
        const desk = new THREE.Mesh(deskGeometry, new THREE.MeshStandardMaterial({ color: 0x334, roughness: 0.6 }));
        const offset = (i - (roomAgents.length - 1) / 2) * 1.5;
        desk.position.set(room.position[0] + offset, 0.05, room.position[2] + 0.5);
        desk.castShadow = true; desk.receiveShadow = true;
        scene.add(desk);

        // Agent avatar (sphere)
        const agentColor = ROLE_COLORS[agent.id] ?? 0x64748b;
        const agentMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 16, 16),
          new THREE.MeshStandardMaterial({ color: agentColor, roughness: 0.3, metalness: 0.1 })
        );
        agentMesh.position.copy(desk.position).add(new THREE.Vector3(0, 0.55, 0));
        agentMesh.castShadow = true;
        scene.add(agentMesh);
        agentMeshes.set(agent.id, agentMesh);
      });
    }

    // Animate
    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Agent animations
      for (const agent of agents) {
        const mesh = agentMeshes.get(agent.id);
        if (!mesh) continue;
        const statusColor = STATUS_COLORS[agent.status] ?? 0x64748b;
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(statusColor);
        if (agent.status === 'working') mesh.position.y += Math.sin(Date.now() * 0.003) * 0.002;
      }

      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [agents, officeSettings, tasks]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative' }}
    />
  );
}

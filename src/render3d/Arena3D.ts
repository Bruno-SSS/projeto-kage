import * as THREE from 'three';
import type { NinjaTemplate, TeamId } from '../core/types';
import { CELL_3D, easeInOut, gridToWorld, ndcToScreen } from './layout';
import { NinjaModel } from './NinjaModel';

interface Anim {
  start: number;
  duration: number;
  step: (t: number) => void;
  resolve: () => void;
}

/**
 * Arena de batalha em 3D (Three.js), desenhada num canvas atrás do canvas do
 * Phaser, que fica transparente na batalha e cuida do HUD. Uma instância só,
 * reaproveitada entre batalhas.
 */
export class Arena3D {
  private static instance?: Arena3D;

  static get(): Arena3D {
    return (this.instance ??= new Arena3D());
  }

  /** Multiplicador de velocidade das animações (2 = duas vezes mais rápido). */
  speed = 1;

  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 200);
  private readonly units = new Map<string, NinjaModel>();
  private anims: Anim[] = [];
  private host?: HTMLElement;
  private running = false;
  private last = 0;
  private size = '';

  private constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'arena3d';
    this.canvas.style.display = 'none';
    document.body.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.scene.background = new THREE.Color(0x101826);
    this.scene.fog = new THREE.Fog(0x101826, 26, 48);

    this.camera.position.set(0, 8.6, 12.6);
    this.camera.lookAt(0, 0.6, 0.4);

    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x2a2016, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    sun.position.set(-6, 12, 8);
    this.scene.add(sun);

    this.buildGround();
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshToonMaterial({ color: 0x2f4a2b }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);

    // casas dos dois grids
    for (const team of ['A', 'B'] as const) {
      const edge = team === 'A' ? 0x4ea8de : 0xe05263;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const { x, z } = gridToWorld(team, row, col);
          const tile = new THREE.Mesh(
            new THREE.BoxGeometry(CELL_3D - 0.25, 0.06, CELL_3D - 0.25),
            new THREE.MeshToonMaterial({ color: col === 0 ? 0x5b5238 : 0x4a4430 }),
          );
          tile.position.set(x, 0.03, z);
          this.scene.add(tile);
          const border = new THREE.LineSegments(
            new THREE.EdgesGeometry(tile.geometry),
            new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.45 }),
          );
          border.position.copy(tile.position);
          this.scene.add(border);
        }
      }
    }

    // árvores low-poly ao redor
    const trunk = new THREE.MeshToonMaterial({ color: 0x5a3d26 });
    const leaves = [0x2f6b35, 0x3d7d3a, 0x26592c].map(
      (c) => new THREE.MeshToonMaterial({ color: c }),
    );
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + (i % 3) * 0.2;
      const r = 15 + (i % 4) * 2.5;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r * 0.75 - 3;
      if (z > 6) continue; // não tapar a câmera
      const tree = new THREE.Group();
      const h = 1.2 + (i % 3) * 0.5;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, h, 6), trunk);
      t.position.y = h / 2;
      tree.add(t);
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(1.4 - k * 0.35, 1.6, 7),
          leaves[(i + k) % leaves.length],
        );
        cone.position.y = h + 0.6 + k * 0.8;
        tree.add(cone);
      }
      tree.position.set(x, 0, z);
      tree.scale.setScalar(1 + (i % 5) * 0.12);
      this.scene.add(tree);
    }
  }

  // ------------------------------------------------------------ ciclo

  /** Mostra a arena alinhada ao canvas do Phaser e começa a desenhar. */
  show(host: HTMLElement): void {
    this.host = host;
    this.canvas.style.display = 'block';
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      requestAnimationFrame(this.loop);
    }
  }

  /** Esconde a arena e remove os ninjas. */
  hide(): void {
    this.canvas.style.display = 'none';
    this.running = false;
    for (const a of this.anims) a.resolve();
    this.anims = [];
    for (const u of this.units.values()) {
      this.scene.remove(u.root);
      u.dispose();
    }
    this.units.clear();
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.syncSize();

    for (const a of [...this.anims]) {
      const t = Math.min(1, (now - a.start) / a.duration);
      a.step(t);
      if (t >= 1) {
        this.anims.splice(this.anims.indexOf(a), 1);
        a.resolve();
      }
    }
    for (const u of this.units.values()) u.update(dt, now);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };

  /** Mantém o canvas 3D exatamente sob o canvas do Phaser. */
  private syncSize(): void {
    if (!this.host) return;
    const r = this.host.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height}`;
    if (key === this.size) return;
    this.size = key;
    Object.assign(this.canvas.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    this.renderer.setSize(r.width, r.height, false);
  }

  /** Anima por `ms` (dividido pela velocidade); `step` recebe 0..1. */
  animate(ms: number, step: (t: number) => void): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) {
        step(1);
        resolve();
        return;
      }
      this.anims.push({ start: performance.now(), duration: ms / this.speed, step, resolve });
    });
  }

  // ------------------------------------------------------------ ninjas

  addUnit(uid: string, ninja: NinjaTemplate, team: TeamId, row: number, col: number): void {
    const model = new NinjaModel(ninja, team);
    const { x, z } = gridToWorld(team, row, col);
    model.home.set(x, 0, z);
    model.root.position.copy(model.home);
    this.scene.add(model.root);
    this.units.set(uid, model);
    const file = ninja.visual?.modelo;
    if (file) model.loadModel(`${import.meta.env.BASE_URL}${file}`);
  }

  private unit(uid: string): NinjaModel {
    const u = this.units.get(uid);
    if (!u) throw new Error(`Ninja 3D desconhecido: ${uid}`);
    return u;
  }

  /** Posição na tela do Phaser (960×540) de um ponto acima do ninja. */
  screenPos(uid: string, height = 2.4): { x: number; y: number } {
    const u = this.unit(uid);
    const p = new THREE.Vector3(u.root.position.x, u.root.position.y + height, u.root.position.z);
    p.project(this.camera);
    return ndcToScreen(p.x, p.y);
  }

  highlight(uid: string | null): void {
    for (const [id, u] of this.units) u.setHighlighted(id === uid);
  }

  setStunned(uid: string, on: boolean): void {
    this.unit(uid).setStunned(on);
  }

  /** Avança na direção dos alvos, golpeia e volta (a volta não é aguardada). */
  async lunge(actorUid: string, targetUids: string[]): Promise<void> {
    const actor = this.unit(actorUid);
    if (targetUids.length === 0) return;
    const center = new THREE.Vector3();
    for (const t of targetUids) center.add(this.unit(t).root.position);
    center.divideScalar(targetUids.length);
    const from = actor.home.clone();
    const to = from.clone().lerp(center, 0.55);
    to.y = 0;
    actor.playClip('attack');
    await this.animate(170, (t) => {
      const e = easeInOut(t);
      actor.root.position.lerpVectors(from, to, e);
      actor.setStrike(e);
    });
    void this.animate(220, (t) => {
      actor.root.position.lerpVectors(to, from, easeInOut(t));
      actor.setStrike(1 - t);
    });
  }

  async hit(uid: string): Promise<void> {
    const u = this.unit(uid);
    if (!u.playClip('hit')) {
      /* sem clipe: só o brilho e o tremor */
    }
    const base = u.root.position.clone();
    await this.animate(160, (t) => {
      u.setFlash(1 - t);
      u.root.position.x = base.x + Math.sin(t * Math.PI * 6) * 0.08 * (1 - t);
    });
    u.root.position.x = base.x;
  }

  /** Cai de costas e levanta. */
  async knockdown(uid: string): Promise<void> {
    const u = this.unit(uid);
    if (u.playClip('knockdown')) return this.animate(400, () => {});
    await this.animate(180, (t) => (u.body.rotation.z = u.forward.x * 1.2 * easeInOut(t)));
    await this.animate(220, (t) => (u.body.rotation.z = u.forward.x * 1.2 * (1 - easeInOut(t))));
  }

  /** Sobe girando e cai. */
  async air(uid: string): Promise<void> {
    const u = this.unit(uid);
    u.playClip('air');
    await this.animate(420, (t) => {
      u.root.position.y = Math.sin(t * Math.PI) * 1.6;
      u.body.rotation.z = u.forward.x * Math.sin(t * Math.PI) * 0.6;
    });
    u.root.position.y = 0;
    u.body.rotation.z = 0;
  }

  /** Desliza para trás e volta para a casa. */
  async pushed(uid: string): Promise<void> {
    const u = this.unit(uid);
    u.playClip('pushed');
    const back = u.home.clone().addScaledVector(u.forward, -0.9);
    await this.animate(150, (t) => u.root.position.lerpVectors(u.home, back, easeInOut(t)));
    await this.animate(220, (t) => u.root.position.lerpVectors(back, u.home, easeInOut(t)));
  }

  async die(uid: string): Promise<void> {
    const u = this.unit(uid);
    u.dead = true;
    u.setHighlighted(false);
    u.setStunned(false);
    if (!u.playClip('death')) {
      await this.animate(380, (t) => {
        u.body.rotation.z = u.forward.x * (Math.PI / 2) * easeInOut(t);
      });
    }
    await this.animate(300, (t) => u.setOpacity(1 - 0.75 * t));
  }
}

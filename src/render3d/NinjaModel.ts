import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NinjaTemplate, TeamId } from '../core/types';
import { ELEMENT_COLORS } from '../ui/theme';

const TEAM_COLORS: Record<TeamId, number> = { A: 0x4ea8de, B: 0xe05263 };
const SKIN_TONES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const MODEL_HEIGHT = 1.9;

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function darken(color: number, f: number): number {
  return new THREE.Color(color).multiplyScalar(f).getHex();
}

/**
 * Ninja em 3D. Sem arquivo de modelo, monta um boneco low-poly original
 * (corpo, braços, cabeça, faixa na cor do time, lenço na cor do elemento). Com
 * `visual.modelo` (.glb), carrega o arquivo e usa as animações dele.
 *
 * `root` fica na casa do grid e é movido nas animações de deslocamento;
 * `body` recebe balanço, inclinação e o modelo em si.
 */
export class NinjaModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly home = new THREE.Vector3();
  /** Direção para onde o ninja olha (time A → +x, time B → −x). */
  readonly forward: THREE.Vector3;
  readonly team: TeamId;
  dead = false;

  private readonly procedural = new THREE.Group();
  private readonly materials: THREE.MeshToonMaterial[] = [];
  private readonly ring: THREE.Mesh;
  private readonly stars = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly scarfTail: THREE.Mesh;
  private mixer?: THREE.AnimationMixer;
  private clips = new Map<string, THREE.AnimationAction>();
  private readonly clipNames: Record<string, string>;
  private highlighted = false;
  private phase: number;

  constructor(ninja: NinjaTemplate, team: TeamId) {
    this.team = team;
    this.phase = (hash(ninja.id) % 100) / 10;
    this.forward = new THREE.Vector3(team === 'A' ? 1 : -1, 0, 0);
    this.clipNames = ninja.visual?.animacoes ?? {};
    this.root.add(this.body);
    this.body.add(this.procedural);
    // o boneco é montado olhando para +z; vira para o inimigo
    this.body.rotation.y = team === 'A' ? Math.PI / 2 : -Math.PI / 2;

    const element = ninja.visual?.cor
      ? new THREE.Color(ninja.visual.cor).getHex()
      : ELEMENT_COLORS[ninja.element];
    const skin = SKIN_TONES[hash(ninja.id) % SKIN_TONES.length];
    const outfit = darken(element, 0.55);
    const pants = 0x2a2f3a;
    const hair = darken(element, 0.3);

    const mesh = (
      geo: THREE.BufferGeometry,
      color: number,
      parent: THREE.Object3D = this.procedural,
    ) => {
      const mat = new THREE.MeshToonMaterial({ color });
      this.materials.push(mat);
      const m = new THREE.Mesh(geo, mat);
      parent.add(m);
      return m;
    };

    // pernas
    for (const x of [-0.15, 0.15]) {
      mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), pants).position.set(x, 0.4, 0);
    }
    // tronco
    mesh(new THREE.CapsuleGeometry(0.29, 0.42, 4, 12), outfit).position.set(0, 1.04, 0);
    // cinto
    const belt = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16), darken(outfit, 0.6));
    belt.position.set(0, 0.8, 0);
    // braços (com pivô no ombro, para o golpe)
    const armL = new THREE.Group();
    for (const [pivot, x] of [
      [armL, -0.38],
      [this.armR, 0.38],
    ] as const) {
      pivot.position.set(x, 1.3, 0);
      this.procedural.add(pivot);
      mesh(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), outfit, pivot).position.set(0, -0.28, 0);
      mesh(new THREE.SphereGeometry(0.1, 10, 8), skin, pivot).position.set(0, -0.58, 0);
    }
    armL.rotation.z = 0.12;
    this.armR.rotation.z = -0.12;
    // cabeça
    mesh(new THREE.SphereGeometry(0.27, 18, 14), skin).position.set(0, 1.63, 0);
    // cabelo: calota lisa com coque no alto
    const cap = mesh(
      new THREE.SphereGeometry(0.29, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1),
      hair,
    );
    cap.position.set(0, 1.66, -0.02);
    mesh(new THREE.SphereGeometry(0.12, 12, 10), hair).position.set(0, 1.98, -0.08);
    // olhos
    for (const x of [-0.09, 0.09]) {
      mesh(new THREE.SphereGeometry(0.035, 8, 6), 0x111111).position.set(x, 1.65, 0.24);
    }
    // faixa de pano na testa (cor do time), com nó e duas pontas atrás
    const band = mesh(new THREE.TorusGeometry(0.275, 0.045, 6, 20), TEAM_COLORS[team]);
    band.position.set(0, 1.74, 0);
    band.rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.06, 8, 6), TEAM_COLORS[team]).position.set(0, 1.74, -0.28);
    for (const x of [-0.05, 0.05]) {
      const tail = mesh(new THREE.BoxGeometry(0.06, 0.02, 0.24), TEAM_COLORS[team]);
      tail.position.set(x, 1.68, -0.38);
      tail.rotation.x = 0.5;
    }
    // lenço (cor do elemento) com ponta solta atrás
    const scarf = mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 16), element);
    scarf.position.set(0, 1.36, 0);
    scarf.rotation.x = Math.PI / 2;
    this.scarfTail = mesh(new THREE.BoxGeometry(0.12, 0.04, 0.55), element);
    this.scarfTail.geometry.translate(0, 0, -0.27);
    this.scarfTail.position.set(0.08, 1.34, -0.15);

    // sombra simples
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.root.add(shadow);

    // anel de destaque (vez de agir)
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xf2a541, transparent: true, opacity: 0.9 }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.root.add(this.ring);

    // estrelas de atordoado
    for (let i = 0; i < 3; i++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08),
        new THREE.MeshBasicMaterial({ color: 0xffd166 }),
      );
      const a = (i / 3) * Math.PI * 2;
      star.position.set(Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35);
      this.stars.add(star);
    }
    this.stars.position.y = 2.15;
    this.stars.visible = false;
    this.root.add(this.stars);
  }

  /** Troca o boneco por um modelo .glb. Em caso de erro, mantém o boneco. */
  loadModel(url: string): void {
    new GLTFLoader().load(
      url,
      (gltf) => {
        const model = gltf.scene;
        const box = new THREE.Box3().setFromObject(model);
        const height = box.max.y - box.min.y || 1;
        model.scale.setScalar(MODEL_HEIGHT / height);
        model.position.y = -box.min.y * (MODEL_HEIGHT / height);
        this.procedural.visible = false;
        this.body.add(model);
        this.mixer = new THREE.AnimationMixer(model);
        for (const clip of gltf.animations) {
          this.clips.set(clip.name, this.mixer.clipAction(clip));
        }
        this.playClip('idle', true);
      },
      undefined,
      (err) => console.warn(`[3D] não foi possível carregar ${url}; usando o boneco.`, err),
    );
  }

  /** Toca um clipe do modelo, se existir. `name` é o clipe do jogo (idle, attack...). */
  playClip(name: string, loop = false): boolean {
    const action = this.clips.get(this.clipNames[name] ?? name);
    if (!action) return false;
    for (const a of this.clips.values()) if (a !== action) a.fadeOut(0.12);
    action.reset();
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.fadeIn(0.12).play();
    if (!loop && name !== 'death') {
      const back = () => {
        this.mixer?.removeEventListener('finished', back);
        if (!this.dead) this.playClip('idle', true);
      };
      this.mixer?.addEventListener('finished', back);
    }
    return true;
  }

  setHighlighted(on: boolean): void {
    this.highlighted = on;
    this.ring.visible = on;
  }

  setStunned(on: boolean): void {
    this.stars.visible = on;
  }

  /** Brilho branco ao levar dano (0..1). */
  setFlash(amount: number): void {
    for (const m of this.materials) m.emissive.setScalar(amount * 0.8);
  }

  setOpacity(alpha: number): void {
    for (const m of this.materials) {
      m.transparent = alpha < 1;
      m.opacity = alpha;
    }
  }

  /** Pose de golpe: braço direito sobe à frente (0..1). */
  setStrike(amount: number): void {
    this.armR.rotation.x = -1.7 * amount;
  }

  update(dt: number, now: number): void {
    this.mixer?.update(dt);
    const t = now / 1000 + this.phase;
    if (!this.dead) {
      this.procedural.position.y = Math.sin(t * 3) * 0.03;
      this.scarfTail.rotation.y = Math.sin(t * 4) * 0.35;
      this.scarfTail.rotation.x = -0.2 + Math.sin(t * 2.3) * 0.15;
    }
    if (this.highlighted) {
      const s = 1 + Math.sin(t * 6) * 0.08;
      this.ring.scale.set(s, s, s);
    }
    if (this.stars.visible) this.stars.rotation.y = t * 4;
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.dispose();
      }
    });
  }
}

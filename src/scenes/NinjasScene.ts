import Phaser from 'phaser';
import { feed, feedBlocker, ninjaProgress, starUp, starUpCost } from '../core/evolution';
import { ninjaLevelCap, xpToNext } from '../core/progression';
import { ROSTER } from '../data/ninjas';
import { PROGRESSAO as cfg } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader, fmt } from '../ui/header';
import { evolved, getSave, tick, updateSave } from '../ui/session';
import { COLORS, TEXT, textStyle } from '../ui/theme';

/** Evolução: nível dos ninjas (comida) e estrelas (fragmentos). */
export class NinjasScene extends Phaser.Scene {
  private message = '';

  constructor() {
    super('Ninjas');
  }

  init(data: { message?: string }): void {
    this.message = data.message ?? '';
  }

  create(): void {
    tick();
    drawHeader(this, 'Ninjas', 'Hub');
    const { player } = getSave();
    const foods = Object.entries(cfg.ninjas.comida);
    const cap = ninjaLevelCap(player, cfg);

    this.add.text(
      24,
      70,
      `Comida: ${foods.map(([id, f]) => `${f.nome} ${player.food[id] ?? 0} (+${fmt(f.xp)} XP)`).join(' · ')}   Limite de nível: ${cap}`,
      textStyle(14, TEXT.muted),
    );
    this.add.text(24, 92, this.message, textStyle(14, TEXT.accent, true));

    const owned = ROSTER.filter((n) => player.owned[n.id]);
    const rowH = Math.min(70, 420 / Math.max(1, owned.length));
    owned.forEach((base, i) => {
      const y = 140 + i * rowH;
      const p = ninjaProgress(player, base.id, cfg);
      const n = evolved(base.id);
      this.add.rectangle(480, y, 912, rowH - 6, COLORS.panel).setStrokeStyle(1, COLORS.border);
      this.add.text(
        36,
        y - 20,
        `${base.name}  ${'★'.repeat(p.stars)}${'☆'.repeat(cfg.ninjas.estrelaMaxima - p.stars)}  Nível ${p.level}`,
        textStyle(16, TEXT.main, true),
      );
      const need = xpToNext(p.level, cfg);
      this.add.text(
        36,
        y + 2,
        `XP ${fmt(p.xp)}/${fmt(need)} · VIDA ${n.stats.hp} ATQ ${n.stats.atk} DEF ${n.stats.def} VEL ${n.stats.spd}`,
        textStyle(13, TEXT.muted),
      );

      foods.forEach(([foodId, food], j) => {
        const btn = new Button(
          this,
          520 + j * 92,
          y,
          86,
          36,
          food.nome,
          () => {
            let levels = 0;
            updateSave((s) => {
              const r = feed(s.player, base.id, foodId, cfg);
              levels = r.levels;
              return { ...s, player: r.state };
            });
            this.scene.restart({
              message:
                levels > 0
                  ? `${base.name} subiu ${levels} nível(is)!`
                  : `${base.name} comeu ${food.nome}.`,
            });
          },
          { fontSize: 13 },
        );
        btn.setEnabled(feedBlocker(player, base.id, foodId, cfg) === null);
      });

      const cost = starUpCost(p, cfg);
      const frags = player.fragments[base.id] ?? 0;
      const label = cost === null ? 'Estrela máx.' : `★ ${frags}/${cost}`;
      new Button(
        this,
        868,
        y,
        110,
        36,
        label,
        () => {
          updateSave((s) => ({ ...s, player: starUp(s.player, base.id, cfg) }));
          this.scene.restart({ message: `${base.name} ganhou uma estrela!` });
        },
        { fontSize: 13 },
      ).setEnabled(cost !== null && frags >= cost);
    });
  }
}

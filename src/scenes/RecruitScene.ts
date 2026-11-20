import Phaser from 'phaser';
import { FRAGMENTS_TO_RECRUIT, getSchedule, HARD_PITY, pullMany, type Banner } from '../core/gacha';
import { grant, grantFromRewards, recordActivity, recruitWithFragments } from '../core/progression';
import { GACHA } from '../data/gacha';
import { NINJAS, ROSTER } from '../data/ninjas';
import { PROGRESSAO } from '../data/progressao';
import { Button } from '../ui/Button';
import { drawHeader } from '../ui/header';
import { getSave, tick, updateSave } from '../ui/session';
import { COLORS, TEXT, textStyle } from '../ui/theme';

const KIND_LABEL = {
  destaque: 'Destaque da semana',
  permanente: 'Permanente',
  iniciante: 'Iniciante',
};

/** Recrutamento: banners da semana, tiragens e troca de fragmentos. */
export class RecruitScene extends Phaser.Scene {
  private selected = 0;
  private lastResult: string[] = [];

  constructor() {
    super('Recruit');
  }

  init(data: { selected?: number; lastResult?: string[] }): void {
    this.selected = data.selected ?? 0;
    this.lastResult = data.lastResult ?? [];
  }

  create(): void {
    tick();
    drawHeader(this, 'Recrutar', 'Hub');
    const save = getSave();
    const now = new Date();
    const schedule = getSchedule(GACHA, now, new Date(save.createdAt));
    const banners = schedule.banners;
    const banner = banners[Math.min(this.selected, banners.length - 1)];

    // Banners
    banners.forEach((b, i) => {
      const label = `${KIND_LABEL[b.kind]}\n${b.name}`;
      const btn = new Button(
        this,
        150 + i * 250,
        110,
        230,
        56,
        label,
        () => this.scene.restart({ selected: i }),
        { fontSize: 14, stroke: i === this.selected ? COLORS.accent : COLORS.border },
      );
      if (i !== this.selected) btn.setAlpha(0.7);
    });

    const featured = banner.featured ? NINJAS[banner.featured]?.name : undefined;
    const ends = schedule.endsAt.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo',
    });
    this.add.text(
      24,
      152,
      [
        featured
          ? `Destaque: ${featured} (50% dos lendários; perdeu, o próximo é garantido)`
          : 'Sem destaque.',
        `Chances: 3% lendário · 15% épico · 82% fragmentos · épico garantido a cada 10.`,
        `Garantia de lendário: ${HARD_PITY - save.pity.sinceLegendary} tiragens no máximo. Semana termina em ${ends} (Brasília).`,
        `Eventos da semana: ${schedule.events.map((e) => e.name).join(', ')}.`,
      ],
      { ...textStyle(14, TEXT.muted), lineSpacing: 4 },
    );

    const scrolls = save.player.wallet.pergaminho;
    const { single, multi10 } = banner.cost;
    new Button(
      this,
      160,
      272,
      240,
      50,
      `Recrutar 1x (${single} perg.)`,
      () => this.pull(banner, 1, single),
      {
        fontSize: 16,
      },
    ).setEnabled(scrolls >= single);
    new Button(
      this,
      420,
      272,
      240,
      50,
      `Recrutar 10x (${multi10} perg.)`,
      () => this.pull(banner, 10, multi10),
      {
        fontSize: 16,
      },
    ).setEnabled(scrolls >= multi10);

    this.add.text(
      24,
      310,
      this.lastResult.length ? 'Resultado:' : '',
      textStyle(15, TEXT.main, true),
    );
    this.add.text(24, 334, this.lastResult.join('\n'), {
      ...textStyle(13, TEXT.main),
      lineSpacing: 2,
    });

    // Fragmentos
    this.add.text(600, 300, 'Fragmentos', textStyle(16, TEXT.main, true));
    const missing = ROSTER.filter((n) => !save.player.owned[n.id]);
    if (missing.length === 0) {
      this.add.text(600, 326, 'Você já tem todos os ninjas.', textStyle(14, TEXT.muted));
    }
    missing.forEach((n, i) => {
      const y = 340 + i * 44;
      const have = save.player.fragments[n.id] ?? 0;
      this.add.text(
        600,
        y - 9,
        `${n.name}: ${have}/${FRAGMENTS_TO_RECRUIT}`,
        textStyle(15, TEXT.main),
      );
      new Button(
        this,
        870,
        y,
        120,
        34,
        'Recrutar',
        () => {
          updateSave((s) => ({ ...s, player: recruitWithFragments(s.player, n.id) }));
          this.scene.restart({
            selected: this.selected,
            lastResult: [`${n.name} entrou para o time!`],
          });
        },
        { fontSize: 14 },
      ).setEnabled(have >= FRAGMENTS_TO_RECRUIT);
    });
  }

  private pull(banner: Banner, count: number, cost: number): void {
    const lines: string[] = [];
    updateSave((s) => {
      if (s.player.wallet.pergaminho < cost) return s;
      // o gacha precisa saber quem o jogador já tem para converter repetidos em fragmentos
      const pity = { ...s.pity, owned: { ...s.player.owned } };
      const { results, state } = pullMany(GACHA, banner, pity, count, Math.random);
      let player = {
        ...s.player,
        wallet: { ...s.player.wallet, pergaminho: s.player.wallet.pergaminho - cost },
      };
      for (const r of results) {
        player = grant(player, grantFromRewards(r.rewards), PROGRESSAO).state;
        for (const rw of r.rewards) {
          if (rw.type === 'ninja')
            lines.push(`★ NOVO NINJA: ${NINJAS[rw.ninjaId]?.name} (${rw.rarity})`);
          else if (rw.type === 'fragmentos')
            lines.push(`+${rw.amount} fragmentos de ${NINJAS[rw.ninjaId]?.name}`);
          else lines.push(`+${rw.amount} ${rw.currency}`);
        }
      }
      player = recordActivity(player, 'recrutamento', count);
      return { ...s, player, pity: state };
    });
    this.scene.restart({ selected: this.selected, lastResult: lines.slice(0, 14) });
  }
}

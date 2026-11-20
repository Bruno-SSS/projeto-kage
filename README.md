# Projeto Kage

Jogo de táticas ninja em turnos para navegador: monte uma formação 3×3, encadeie combos
de perseguição entre seus ninjas e vença batalhas cada vez mais difíceis.

**Jogar:** https://bruno-sss.github.io/projeto-kage/

## Stack

- [Phaser](https://phaser.io/) + TypeScript, empacotado com [Vite](https://vite.dev/)
- Testes com [Vitest](https://vitest.dev/), lint com ESLint, formatação com Prettier
- CI e deploy automático no GitHub Pages via GitHub Actions

## Rodando localmente

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm test           # testes
npm run lint       # lint
npm run build      # build de produção em dist/
```

## Estrutura

```
src/
  core/      regras do combate, sem gráficos (100% testável)
  data/      ninjas e outros dados do jogo
  scenes/    telas do Phaser
tests/       testes do core
```

## Fluxo de trabalho

- `main` é protegida: todo trabalho entra por Pull Request a partir de uma branch `feat/*`.
- O CI roda formatação, lint, testes e build em cada PR.
- Cada merge na `main` publica o jogo automaticamente.

## Roteiro

| Fase | Objetivo                                                          |
| ---- | ----------------------------------------------------------------- |
| 0    | Infraestrutura, CI e deploy ✅                                    |
| 1    | Motor de combate (formação, turnos, combos, chakra, elementos) ✅ |
| 2    | Visual e jogabilidade da batalha                                  |
| 3    | Ninjas e arte originais                                           |
| 4    | Campanha e progressão                                             |
| 5    | Polimento e lançamento v1.0                                       |
| 6    | Online (login, ranking, PvP assíncrono)                           |

Todo o conteúdo (personagens, nomes, arte) é original.

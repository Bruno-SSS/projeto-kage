# Modo história: como editar

Tudo fica em **`src/data/historia.json`**; a lógica em `src/core/story.ts`. Depois de editar, rode
`npm test` (valida as formações inimigas e checa se o time inicial vence cada fase).

## `energia`

Valores da pesquisa (regeneração, teto, energia diária e máximo).

| Campo          | O que é                                                        |
| -------------- | -------------------------------------------------------------- |
| `inicial`      | Energia de um jogador novo.                                    |
| `regenMinutos` | Ganha 1 de energia a cada N minutos.                           |
| `tetoRegen`    | A regeneração natural para aqui.                               |
| `diaria`       | Energia extra no primeiro acesso do dia (pode passar do teto). |
| `maximo`       | Ninguém acumula mais que isso.                                 |
| `custoFase`    | Energia por fase vencida. Derrota não gasta.                   |

## `premioPorEnergia`

XP e ryo por ponto de energia gasto (`xp`: 150, da pesquisa). Segunda-feira dobra o XP da
história (`bonusSemanal` em `progressao.json`). Os ninjas do time ganham o mesmo XP da conta.

## `estrelas`, `varredura` e `limiteRodadas` (regras da pesquisa)

- **Estrelas (máx. 3):** ★ vencer o objetivo (última luta) · ★ no máximo `maxMortes` (3) baixas
  somando todas as lutas de uma passagem · ★ vencer o desafio opcional. Vale a melhor passagem.
- **Desafio:** luta opcional mais forte de cada fase (o "círculo azul"), feita para voltar depois.
  Abre depois de vencer o objetivo e não gasta energia.
- **Varredura:** com 3★, repete a fase sem lutar; mesma energia e mesmo XP/ryo por passagem, sem
  limite diário, até `maxPorVez` (5) de uma vez. Segunda-feira dobra o XP também na varredura.
- **Limite de rodadas:** 10 por luta; empate conta como derrota.

## `capitulos`

| Campo                 | O que é                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `id`, `nome`, `texto` | Identificador, título e texto de abertura.                                               |
| `nivelMinimo`         | Nível da conta para abrir. O capítulo anterior também precisa estar concluído.           |
| `conclusao`           | Prêmio ao vencer todas as fases pela primeira vez.                                       |
| `bonus3Estrelas`      | Prêmio ao ter 3★ em todas as fases (regra da pesquisa: 20 + 10 × (capítulo − 1) cupons). |
| `fases`               | Lista em ordem; cada fase abre quando a anterior é vencida.                              |

Cada fase: `id`, `nome`, `nivelMinimo` (nível da conta para jogar), `nivelInimigo`, `chefe`,
`forca` (multiplicador extra para todas as lutas), `lutas` (lista em ordem; a última é o objetivo;
cada uma com `inimigos` e `forca` opcional), `desafio` (`forca` e `inimigos`) e `primeiraVez`
(prêmio da primeira vitória). Não repita ninja dentro da mesma luta.

Prêmios aceitam `ryo`, `cupom`, `pergaminho`, `comida` (`{ "pao": 1 }`) e `fragmentos`
(`{ "iara": 20 }`).

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

## `estrelas`

1★ vencer · 2★ vencer com até `maxMortesPara2` ninjas caídos · 3★ vencer sem perder ninguém.
Vale a melhor marca de cada fase. **Provisório** até a pesquisa trazer o critério do original.

## `capitulos`

| Campo                 | O que é                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `id`, `nome`, `texto` | Identificador, título e texto de abertura.                                               |
| `nivelMinimo`         | Nível da conta para abrir. O capítulo anterior também precisa estar concluído.           |
| `conclusao`           | Prêmio ao vencer todas as fases pela primeira vez.                                       |
| `bonus3Estrelas`      | Prêmio ao ter 3★ em todas as fases (regra da pesquisa: 20 + 10 × (capítulo − 1) cupons). |
| `fases`               | Lista em ordem; cada fase abre quando a anterior é vencida.                              |

Cada fase: `id`, `nome`, `nivelInimigo` (nível dos inimigos), `inimigos` (`id` do ninja, `row`,
`col`; sem repetir ninja na mesma fase), `chefe` e `forca` (multiplicador extra de vida, ataque e
defesa) e `primeiraVez` (prêmio da primeira vitória).

Prêmios aceitam `ryo`, `cupom`, `pergaminho`, `comida` (`{ "pao": 1 }`) e `fragmentos`
(`{ "iara": 20 }`).

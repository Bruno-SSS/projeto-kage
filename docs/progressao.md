# Progressão: como editar

Os números ficam em **`src/data/progressao.json`**; a lógica em `src/core/progression.ts`.
Depois de editar, rode `npm test`.

## `nivel`

| Campo                   | O que é                                                                                                                                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maximo`                | Nível máximo da conta.                                                                                                                                                                                           |
| `tabelaXp`              | XP para passar de cada nível: `{ "1": 2000, "10": 13000, ... }`. Níveis que faltam são preenchidos com crescimento percentual constante entre os vizinhos. Valores da pesquisa (tabela de 2017–18, níveis 1–65). |
| `crescimentoAposTabela` | Crescimento por nível depois do último nível da tabela (0.076 = +7,6%).                                                                                                                                          |
| `presentes`             | Recompensa ao chegar em cada nível (`ryo`, `cupom`, `pergaminho`).                                                                                                                                               |

## `dia`

| Campo       | O que é                                                       |
| ----------- | ------------------------------------------------------------- |
| `horaReset` | Hora (Brasília) em que o dia de jogo vira e as diárias zeram. |
| `loginRyo`  | Ryo dado no primeiro acesso de cada dia.                      |

## `quadro` (missões D–S)

| Campo                             | O que é                                                                    |
| --------------------------------- | -------------------------------------------------------------------------- |
| `tamanho`                         | Missões no quadro.                                                         |
| `renovaMinutos`                   | O quadro inteiro é sorteado de novo a cada N minutos.                      |
| `maxPorDia`, `maxRankSPorDia`     | Limites diários.                                                           |
| `ranks.X.chance`                  | Chance do rank aparecer (a soma dos 5 deve ser 1).                         |
| `ranks.X.xp`, `ryo`, `fragmentos` | Recompensa da vitória. Fragmentos são de um ninja sorteado do elenco.      |
| `ranks.X.inimigos`                | Tamanho do time inimigo (até 4).                                           |
| `ranks.X.forcaInimigo`            | Multiplicador de vida, ataque e defesa dos inimigos (1 = igual ao elenco). |

## `diarias`

Lista de tarefas do dia: `id`, `nome`, `atividade` (`vitoria`, `missao`, `recrutamento`, `historia`),
`quantidade` e a recompensa (`xp`, `ryo`, `cupom`, `pergaminho`).

## `bonusSemanal`

Por dia da semana do dia de jogo (`"0"` = domingo ... `"6"` = sábado): lista de
`{ "atividade", "recurso": "xp" | "ryo", "multiplicador" }`. Hoje: terça XP de missões ×2,
sexta ryo de missões ×2, segunda XP de história ×2 (a história ainda não existe).

## `ninjas` (evolução)

Valores calibrados com a pesquisa de evolução (guias de 2026 baseados nos arquivos do jogo).
Inferidos por nós: multiplicador de 2★ e 5★ e o custo de 1★ → 2★.

| Campo                  | O que é                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crescimentoPorNivel`  | Vida, ataque e defesa +N da base por nível acima do 1 (0.0044 = +0,44%; nível 30 ≈ +13%). Os inimigos das missões usam o nível da conta com o mesmo crescimento. |
| `folgaSobreNivelConta` | Quantos níveis o ninja pode passar do nível da conta (0 = no máximo o nível da conta).                                                                           |
| `estrelaInicial`       | Estrelas com que o ninja chega (a maioria do original começa com 3★).                                                                                            |
| `estrelaMaxima`        | Estrela máxima.                                                                                                                                                  |
| `multiplicadorEstrela` | Multiplicador de vida, ataque e defesa por estrela: `{ "3": 1.1, "4": 1.15, "5": 1.2 }`.                                                                         |
| `custoEstrela`         | Fragmentos do próprio ninja para chegar a cada estrela: `{ "4": 100, "5": 200, ... }`.                                                                           |
| `comida`               | Itens que dão XP ao ninja: `{ "pao": { "nome": "Pão", "xp": 50000 } }`.                                                                                          |

Recrutar um ninja com fragmentos custa 80 (constante `FRAGMENTS_TO_RECRUIT` em `src/core/gacha.ts`).

Ninjas ganham XP lutando: ao vencer uma missão, cada ninja do time recebe o mesmo XP da conta.
Comida vem das missões (campo `comida` de cada rank) e das diárias (campo `comida` da tarefa).

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

# Elenco: como editar os ninjas

Todos os ninjas ficam em **`src/data/ninjas.json`**. O código não tem nenhum nome de
personagem: para mudar o elenco, edite só esse arquivo.

No VS Code, o arquivo tem autocompletar e validação enquanto você digita (pelo
`ninjas.schema.json` ao lado dele).

## Depois de editar

```bash
npm test
```

Os testes validam o arquivo e mostram mensagens como:

```
Ninja "saci": campo desconhecido "stats.atack" (permitidos: hp, atk, def, spd).
Ninja "cuca": "special.chakraCost" deve ser um número entre 1 e 100.
```

Com o arquivo inválido o jogo também não abre e mostra o mesmo erro no console do navegador.
Avisos (por exemplo, uma perseguição que nenhum golpe consegue disparar) não bloqueiam.

## Campos

| Campo        | Obrigatório | O que é                                                                                                             |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------- |
| `id`         | sim         | Identificador único: minúsculas sem acento, números e hífen (`boitata`). Usado nas formações.                       |
| `name`       | sim         | Nome exibido no jogo.                                                                                               |
| `element`    | sim         | `fogo`, `vento`, `raio`, `terra` ou `agua`. Ciclo: fogo > vento > raio > terra > água > fogo (+25% / −20% de dano). |
| `rarity`     | não         | `raro`, `epico` ou `lendario` (para o recrutamento).                                                                |
| `observacao` | não         | Texto livre para suas anotações. O jogo ignora.                                                                     |
| `stats.hp`   | sim         | Vida (inteiro).                                                                                                     |
| `stats.atk`  | sim         | Ataque.                                                                                                             |
| `stats.def`  | sim         | Defesa. Dano recebido × 100 / (100 + DEF): com 100 de DEF, metade do dano.                                          |
| `stats.spd`  | sim         | Velocidade. Quem tem mais age primeiro e persegue primeiro.                                                         |
| `basic`      | sim         | Golpe básico (ver Golpe abaixo). Não custa chakra.                                                                  |
| `special`    | sim         | Especial: um Golpe com `chakraCost` (1 a 100). O chakra é do time: começa em 50, +25 por rodada, máximo 100.        |
| `chase`      | não         | Perseguição (ver abaixo). Sem ela o ninja não participa de combos.                                                  |
| `visual`     | não         | Arte: `cor` (`#RRGGBB`), `modelo` (.glb), `retrato` (cut-in), `animacoes` ({ "idle": "arquivo" }).                  |

### Golpe (`basic` e `special`)

| Campo     | O que é                                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`      | Único no arquivo inteiro (`boitata-mordida`).                                                                                                        |
| `name`    | Nome exibido.                                                                                                                                        |
| `power`   | Multiplicador do ATQ (1.0 = 100% do ataque).                                                                                                         |
| `pattern` | `single` (um alvo da frente, mesma linha se der), `row` (linha inteira), `column` (coluna da frente), `back` (um alvo da retaguarda), `all` (todos). |
| `applies` | Estado que abre combo: `derrubado`, `no_ar` ou `repelido`.                                                                                           |
| `stuns`   | `true` = o alvo perde a próxima ação.                                                                                                                |

### Perseguição (`chase`)

| Campo                 | O que é                                                                      |
| --------------------- | ---------------------------------------------------------------------------- |
| `id`, `name`, `power` | Como no golpe.                                                               |
| `trigger`             | Estado no alvo que faz este ninja perseguir.                                 |
| `applies`             | Novo estado aplicado, para o combo continuar. Sem ele, o combo termina aqui. |

Cada ninja persegue no máximo uma vez por rodada, e uma ação encadeia até 4 perseguições.
Quando mais de um aliado pode perseguir, vai o mais rápido.

## Exemplo de combo do elenco atual

Boitatá usa o básico (aplica `derrubado`) → Saci persegue (`derrubado` → `no_ar`) → Boitatá
persegue (`no_ar` → `derrubado`) → Curupira persegue e finaliza.

## Modelos 3D

A batalha é desenhada em 3D (Three.js). Sem `visual.modelo`, cada ninja aparece como um boneco
low-poly original, montado em código: lenço na cor do elemento (ou `visual.cor`) e faixa na cor do
time.

Para usar um modelo próprio:

1. Coloque o arquivo `.glb` em `public/modelos/` (ex.: `public/modelos/saci.glb`). Use só modelos
   que vocês têm direito de usar.
2. No ninja, preencha `"visual": { "modelo": "modelos/saci.glb" }`.
3. Se o modelo tiver animações, mapeie os clipes do jogo para os nomes dentro do arquivo:
   `"animacoes": { "idle": "Parado", "attack": "Soco", "hit": "Dano", "death": "Morte" }`.
   Clipes usados: `idle` (em loop), `attack`, `hit`, `knockdown`, `air`, `pushed`, `death`.
   Clipe que faltar é substituído pelo movimento padrão.

O modelo é redimensionado para a altura padrão e deve estar olhando para a frente (+Z). Se o
arquivo não carregar, o jogo usa o boneco e avisa no console.

## Formações

As formações (a sugerida para o jogador e a do inimigo) ficam em `src/data/formations.ts` e
usam os `id` dos ninjas. Se você mudar um `id`, atualize lá também; os testes avisam se algo
ficar inválido.

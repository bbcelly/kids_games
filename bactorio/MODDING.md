# Biofilm — jak napsat mod

Mod je složka se dvěma soubory. Může přidat suroviny, recepty, stavby (i s úplně novým
chováním), mutace, imunitní buňky, mise a překlady, nebo změnit cokoli ze základní hry.
Základní hra je sama mod (`public/base/`) a používá přesně stejné API, takže nejlepší
referencí je `public/base/data.js` a `public/base/missions.js`. Hotový malý příklad je
`mods/example-kvasinky/`.

## 1. Nejmenší mod

```
mods/muj-mod/
  mod.json
  main.js
```

`mod.json`:

```json
{
  "id": "muj-mod",
  "name": "Můj mod",
  "version": "1.0.0",
  "description": "Co mod dělá.",
  "dependencies": ["base"]
}
```

| pole | význam |
| --- | --- |
| `id` | povinné, 2–41 znaků `a-z 0-9 - _`, musí být jedinečné |
| `name`, `version` | povinné |
| `description` | text ve správci modů |
| `dependencies` | id modů, které se musí načíst dřív (`base` se přidá samo) |
| `main` | jiný název souboru než `main.js` |
| `enabledByDefault` | `false` = mod je po instalaci vypnutý, dokud ho hráč nezapne |

`main.js`:

```js
export function data(api) {
  api.item('med', { icon: { shape: 'drop', color: '#ffb300' }, fuel: 200 });
  api.recipe('med', { category: 'ferment', time: 4, in: { glucose: 3 }, out: { med: 1 }, enabled: true });
  api.locale('cs', { 'item.med': 'Med' });
  api.locale('en', { 'item.med': 'Honey' });
}
```

Volitelně může exportovat i `control(api)` pro háčky za běhu (kapitola 6).

## 2. Instalace

- **Na serveru:** zkopíruj složku do `bactorio/mods/` (v Dockeru do připojené složky
  `/mods`) a znovu načti stránku hry. Mod se objeví v menu **Mody**. Tyto mody mohou mít
  víc souborů a používat `import` mezi nimi.
- **V prohlížeči:** menu **Mody → Přidat mod**. Jde nahrát `.zip` se složkou modu, celá
  složka, nebo jediný soubor `.js`, který navíc exportuje `manifest`
  (`export const manifest = { id, name, version }`). Takový mod se uloží jen v tomto
  prohlížeči a musí být v jednom souboru `main.js` (bez relativních `import`).

Po zapnutí, vypnutí nebo přidání modu klikni na **Použít změny**. Mody se načítají při
startu stránky.

Mod je program a běží ve hře s plnými právy stránky. Instaluj jen mody, kterým věříš.

## 3. Co se stane, když je v modu chyba

- Když `data()` nebo `control()` vyhodí výjimku, nebo data nejsou konzistentní (recept
  s neznámou položkou, stavba, kterou nic neodemyká, neznámá závislost…), mod se **celý
  vrátí zpět**, hra běží dál bez něj a chyba je vidět ve správci modů.
- Háček za běhu, který vyhodí výjimku, se vypne a nahlásí. Simulace pokračuje.
- Uložená hra si pamatuje mody a jejich verze. Když ji otevřeš bez některého modu, hra
  varuje, jeho stavby, položky a mutace z kolonie odstraní a pokračuje. Mise, která
  existuje jen v modu, bez něj otevřít nejde.

Zkontrolovat si mod bez prohlížeče:

```js
// node kontrola.mjs   (spouštěj ze složky bactorio/)
import { Registry } from './public/engine/registry.js';
import { applyMods } from './public/engine/modloader.js';
import * as base from './public/base/main.js';
import * as mod from './mods/muj-mod/main.js';
import { readFileSync } from 'node:fs';

const reg = new Registry();
applyMods(reg, [
  { manifest: base.manifest, module: base },
  { manifest: JSON.parse(readFileSync('./mods/muj-mod/mod.json', 'utf8')), module: mod },
]);
console.log(reg.errors.length ? reg.errors : 'v pořádku', reg.mods.map(m => m.id));
```

## 4. API pro `data(api)`

| volání | co dělá |
| --- | --- |
| `api.item(id, def)` | položka |
| `api.fluid(id, def)` | kapalina |
| `api.resource(id, def)` | ložisko na mapě |
| `api.recipe(id, def)` | recept |
| `api.entity(id, def)` | stavba |
| `api.tech(id, def)` | mutace |
| `api.enemy(id, def)` | imunitní buňka |
| `api.mission(id, def)` | mise |
| `api.kind(id, handlers)` | nové chování stavby (kapitola 5) |
| `api.locale(lang, texty)` | překlady; jazyk může být i nový |
| `api.get(typ, id)`, `api.all(typ)` | čtení prototypů (`typ` = `item`, `recipe`, `entity`, …) |
| `api.modify(typ, id, změna)` | úprava existujícího prototypu; `změna` je objekt nebo funkce |
| `api.remove(typ, id)` | odstranění prototypu |
| `api.on(událost, fn)` | háček (používej v `control`) |
| `api.sim` | pomocné funkce simulace pro vlastní druhy staveb |

### Položka

```js
api.item('med', { icon: { shape: 'drop', color: '#ffb300' }, fuel: 200, calm: 0 });
```

- `icon.shape`: `hex chain crystal bolt knot rod pac ring drop cube wave spiral diamond
  strand helix loop spike pill orb seq`, jinak kolečko. `icon.glyph` přidá znak,
  `icon.draw(ctx, r)` kreslí vlastní ikonu kolem bodu (0, 0) s poloměrem `r`.
- `fuel`: kolik ATP dá spálení v generátoru (glukóza 60, ATP kapsle 300).
- `calm`: o kolik doručení do Jádra uklidní imunitní uzliny (vitamín 3).

Každá položka musí jít získat: z ložiska, nebo jako výstup nějakého receptu.

### Kapalina a ložisko

```js
api.fluid('sirup', { color: '#d98c4a' });
api.resource('med', { item: 'med', color: '#ffb300' });   // volná hra ho rozmístí sama
api.resource('vzacny', { item: 'vzacny', color: '#fff', free: false }); // jen v misích
```

### Recept

```js
api.recipe('sirup', {
  category: 'react',            // kdo ho umí: ferment / assemble / react / spore / vlastní
  time: 3,                      // sekundy při rychlosti stavby 1
  in: { med: 2 }, out: {},      // položky
  fin: { water: 10 }, fout: { sirup: 10 },  // kapaliny (stavba musí mít fluidUser: true)
  enabled: true,                // dostupný od začátku; jinak ho musí odemknout mutace
});
```

Název receptu se bere z první výstupní položky. Když recept položku nevyrábí (nebo se
jmenuje jinak), přidej text `recipe.<id>`.

### Stavba

```js
api.entity('ul', {
  kind: 'crafter',          // chování, viz tabulka
  size: [2, 2],             // jen čtverce
  group: 'production',      // záložka: logistics production colony energy fluids research defense (jinak „Ostatní“)
  hp: 150, cost: { fiber: 10 }, color: '#e8c36a',
  power: 5,                 // spotřeba ATP za sekundu při práci
  pollution: 0.05,          // toxiny za sekundu práce
  category: 'brew', speed: 1,
});
```

Společná pole: `enabled: true` (postavitelné bez mutace), `buildable: false` (není ve
stavební liště), `film` (poloměr biofilmu, který stavba šíří), `needsWater` (musí stát
na břehu), `icon` (symbol do lišty), `draw(ctx, e, S, t, world)` (vlastní kreslení do
čtverce `S`×`S` pixelů, `t` je čas v sekundách), `sprite` (kresli jako jiný druh),
`inspect(world, e, ui)` (vrátí HTML řádky do panelu stavby; `ui = { ic, t, esc }`).

| `kind` | co dělá | vlastní pole |
| --- | --- | --- |
| `belt` | pás | `speed` (políčka/s), `tunnel: true`, `reach` |
| `splitter` | rozbočka | |
| `pilus` | podavač | `swing` (kroky na pohyb), `reach`, `filter: true` |
| `storage` | sklad | `capacity` |
| `miner` | těží ložisko pod sebou | `speed` (kusy/s) |
| `crafter` | vyrábí podle receptu | `category`, `speed`, `fluidUser`, `launch` (položka, která po výrobě odletí) |
| `generator` | pálí palivo | `power`, `efficiency`, `pollution` |
| `solar` | ATP ze světla | `power`, `dim` (podíl mimo světlo) |
| `accumulator` | zásobník ATP | `store` |
| `node` | šíří biofilm | `film` |
| `lab` | výzkum | `speed`, `power` |
| `turret` | obrana | `range`, `damage`, `cooldown` (kroky), `ammo`, `splash`, `power` |
| `wall` | zeď | |
| `pipe` | kanálek / nádrž | `fluidCap` |
| `pump` | čerpadlo | `fluidCap`, `fluid`, `speed` (jednotky/s), `needsWater` |
| `cleaner` | pohlcuje toxiny | `clean`, `power` |
| `core`, `nest` | Jádro, imunitní uzlina | `basePower`, `enemy: true` |

Každou stavbu musí něco odemykat: `enabled: true`, nebo mutace.

### Mutace

```js
api.tech('vcelarstvi', {
  tier: 1,                       // sloupec ve stromu
  prereq: ['genomics'],
  packs: ['seqA'], units: 15, time: 5,   // 15× (1 Sekvence α, 5 s)
  unlock: { entities: ['ul'], recipes: ['med'] },
  bonus: { craftSpeed: 0.1 },    // sčítá se: minerSpeed craftSpeed pilusSpeed beltSpeed labSpeed
});                              //            turretDamage turretRange filmRadius hp resist
```

Mutace s `units: 0` se dokončí hned po výběru.

### Imunitní buňka

```js
api.enemy('trombocyt', { hp: 60, speed: 1.2, damage: 8, cooldown: 1, size: 0.9, color: '#ffd9d9' });
```

`infect: 8` znamená, že buňka místo kousání stavbu na 8 s vyřadí a sama zanikne.
Do vln ji přidáš v misi: `threat.types: [{ id: 'trombocyt', from: 3 }]`.

### Mise

```js
api.mission('vcelin', {
  size: [64, 64], seed: 5,
  setup(w, h) {                  // postav mapu
    h.core(30, 30);
    h.deposit('glucose', 41, 31, 3, 800);   // ložisko: střed, poloměr, množství na políčko
    h.water(22, 40, 3); h.rock(45, 20, 3); h.light(32, 32, 10);
    h.nest(55, 30);                          // v mírumilovném režimu se nepostaví
  },
  start: { items: { glucose: 60 }, techs: ['basics', 'proteins'] },
  techs: ['basics', 'proteins', 'vcelarstvi'],   // co jde v misi zkoumat (bez pole = vše)
  threat: { first: 180, interval: 90, base: 2, growth: 1, max: 12,
            types: [{ id: 'neutrophil', from: 0 }],
            antibiotic: { first: 300, interval: 150, duration: 40 } },
  objectives: [
    { id: 'ul', type: 'build', entity: 'ul', count: 1 },
    { id: 'med', type: 'deliver', item: 'med', count: 20 },
    { id: 'vlastni', type: 'custom', text: 'mission.vcelin.obj.vlastni', check: (w) => [w.stats.killed, 10] },
  ],
  bonus: { type: 'time', minutes: 15 },
});
```

Typy cílů: `deliver` (do Jádra), `produce` (vyrobeno), `build`, `research` (`tech`),
`film` (políčka biofilmu), `power` (výkon sítě), `survive` (odražené vlny), `kill`,
`launch` (spóry), `custom` (`check(world)` vrací `[teď, cíl]`). `threatOnly: true` /
`peacefulOnly: true` omezí cíl na jeden režim hrozeb.

Mise s `campaign: <číslo>` se zařadí do kampaně, ostatní jsou v menu pod „Mise z modů“.
`free: true` je volná hra.

### Texty

```js
api.locale('cs', {
  'item.med': 'Med', 'fluid.sirup': 'Sirup', 'recipe.sirup': 'Vaření sirupu',
  'entity.ul': 'Úl', 'entity.ul.desc': 'Popis v nápovědě.',
  'tech.vcelarstvi': 'Včelařství', 'tech.vcelarstvi.desc': 'Co mutace dá.',
  'enemy.trombocyt': 'Trombocyt',
  'mission.vcelin.name': 'Včelín', 'mission.vcelin.intro': 'Úvodní text.',
  'mission.vcelin.hint.ul': 'Rada zobrazená, dokud není cíl „ul“ splněný.',
});
```

Chybějící text se nahradí anglickým, a když není ani ten, zobrazí se klíč.

## 5. Vlastní chování stavby: `api.kind`

```js
api.kind('composter', {
  init(w, e, p) { e.n = 0; e.out = {}; },             // nová stavba
  wants(w, e, item) { return e.n < 12; },             // hodí se mi tahle položka? (ptá se pilus)
  put(w, e, item, dir, src) { if (e.n >= 12) return false; e.n++; return true; },
  take(w, e, pred) { /* vydej položku, pro kterou pred(item) platí, nebo null */ },
  tick(w, e, p) {                                     // 60× za sekundu, když stojí na biofilmu
    if (e.n >= 3 && w.tick % 90 === 0) { e.n -= 3; e.out.glucose = (e.out.glucose || 0) + 1; }
    if (w.tick % 6 === 0) api.sim.eject(w, e);        // vysuň výrobek ve směru šipky
  },
  removed(w, e, p, o) { if (o.refund) w.give('glucose', e.out.glucose || 0); },
});
```

- `e` je obyčejný objekt (`id, type, x, y, dir, hp` + tvoje pole). Ukládá se celý do
  JSON, kromě polí začínajících podtržítkem. `p` je prototyp stavby.
- `api.sim`: `give(w, cíl, item, dir, src)`, `wants(w, cíl, item)`, `take(w, zdroj, pred)`,
  `eject(w, e)` (z `e.out`), `outTile(e)`, `request(w, atpZaSekundu)` (vrátí 0–1, jak moc
  je síť nasycená), `fluidAvail / fluidDraw / fluidRoom / fluidPush(e, kapalina, n)`,
  `setRecipe(w, e, id)`, `DX`, `DY` (směry 0 = východ, 1 = jih, 2 = západ, 3 = sever).
- Užitečné na světě `w`: `w.inv`, `w.give(item, n)`, `w.deliver(item, n)` (počítá se do
  cílů), `w.has(cost)`, `w.pay(cost)`, `w.entAt(x, y)`, `w.build(type, x, y, dir)`,
  `w.remove(e, { refund })`, `w.damage(e, n)`, `w.pollute(x, y, n)`, `w.stats`,
  `w.counts[type]`, `w.lists[kind]`, `w.enemies`, `w.tick`, `w.rng` (jen ten používej pro
  náhodu, aby hra zůstala opakovatelná) a `w.custom` (volné místo pro mody, ukládá se).

## 6. Háčky za běhu: `control(api)`

```js
export function control(api) {
  api.on('crafted', (w, e, recipe) => { if (recipe.id === 'med') w.custom.medu = (w.custom.medu || 0) + 1; });
}
```

| událost | argumenty |
| --- | --- |
| `init` | `(w)` po vytvoření nové hry |
| `tick` | `(w)` každý krok simulace |
| `built`, `removed` | `(w, e)`, `(w, e, o)` |
| `crafted` | `(w, e, recipe)` |
| `researched` | `(w, techId)` |
| `objectiveDone`, `missionWon` | `(w, objective)`, `(w)` |
| `wave`, `enemyKilled` | `(w, počet)`, `(w, buňka)` |

`init` se nevolá při načtení uložené hry, takže si stav v `w.custom` zakládej líně
(`w.custom.muj ||= {…}`).

## 7. Rady

- Dej svým id předponu, ať se nesrazí s jiným modem.
- Simulace musí být opakovatelná: žádné `Math.random()` ani `Date.now()` v `tick`.
- Vyzkoušej, že mise jde dohrát. Vzor je `test/mods.test.js`, kde testovací bot
  (`test/bot.js`) dohraje misi ukázkového modu bez prohlížeče.

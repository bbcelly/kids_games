# Biofilm

Automatizační hra o bakteriální kolonii. Těžíš živiny, vedeš je řasinkovými pásy do
fermentorů a ribozomů, rozšiřuješ biofilm, zkoumáš mutace a bráníš se imunitnímu systému
hostitele. Cílem je postavit Sporangium a vypustit spóry do světa.

Hra běží v prohlížeči (počítač, myš a klávesnice), je česky i anglicky, má kampaň o osmi
misích, volnou hru a podporu modů. Vše je čistý JavaScript bez build kroku; grafika se
kreslí kódem a zvuky se syntetizují, takže hra nemá žádné stažené soubory.

## Spuštění

```
cd bactorio
npm start            # http://localhost:8081/
```

Server nemá žádné závislosti (Node 20+). Port změníš proměnnou `PORT`, složku s mody
proměnnou `MODS_DIR` (výchozí `bactorio/mods`).

### Docker / Komodo

```
docker compose up -d --build     # http://<host>:8081/
```

`compose.yaml` funguje i jako Komodo Stack (run directory `bactorio`). Nastavení:
`BIOFILM_PORT` (8081), `BIOFILM_MODS_DIR` (`/srv/biofilm/mods`, složka na hostiteli pro
mody), `PUID`/`PGID`. Uložené hry a nastavení jsou v prohlížeči hráče, server si nic
nepamatuje.

## Ovládání

| akce | ovládání |
| --- | --- |
| posun mapy | W A S D / šipky, tažení prostředním tlačítkem, klik do minimapy |
| zoom | kolečko myši |
| stavění | vyber stavbu dole (nebo 1–9), klikni; pásy a zdi jdou táhnout |
| otočení | R (Shift+R opačně) |
| bourání | pravé tlačítko, jde táhnout; suroviny se vrátí do Jádra |
| pipeta / odložit nástroj | Q, Esc |
| detail stavby, recept, filtr | klik na stavbu bez nástroje |
| ruční sběr | drž levé tlačítko na ložisku |
| strom mutací | T |
| pauza, rychlost | mezerník, + a − |
| mapa toxinů | O |
| uložit | Ctrl+S (hra se také sama ukládá každé 2 minuty) |

## Jak hra funguje

- **Jádro** je sklad kolonie. Stavby se platí z jeho zásob a dává 40 ATP/s zdarma.
- **Biofilm:** stavět se dá jen na slizu. Rozšiřují ho Slizové buňky.
- **Pásy** nesou položky ve směru šipky a samy je vkládají do stavby, u které končí.
  **Absorbéry** a výrobní stavby vysouvají výrobky ve směru své šipky.
- **Pilus** bere z políčka za sebou a pokládá před sebe, a to jen to, co cíl potřebuje.
  Pilus mezi Jádrem a strojem tak stroj sám zásobuje.
- **ATP síť** je společná pro celou kolonii. Když spotřeba převýší výkon, stroje zpomalí.
- **Kapaliny:** propojené kanálky a nádrže tvoří jednu nádobu na jednu kapalinu.
- **Mutace** zkoumá Genomové centrum ze Sekvencí α, β, γ a δ.
- **Toxiny** z výroby se šíří po mapě. Imunitní uzliny je vstřebávají a posílají vlny
  neutrofilů, makrofágů a bakteriofágů. Věže si berou munici z Jádra samy. Mírumilovný
  režim (zaškrtávátko při startu) hrozby vypne.

Kampaň: První kapka, Stavební kameny, Slizové město, Kód života, Tekutiny, Imunitní
odpověď, Symbióza, Sporulace. Každá mise má úkoly s radami a bonus za rychlé dohrání.
Volná hra má mapu ze seedu, celý strom mutací a cíl 100 spór.

## Mody

Mod je složka s `mod.json` a `main.js` ve složce `mods/`, nebo soubor nahraný v menu
**Mody** (`.zip`, složka, jeden `.js`). Základní hra je napsaná stejným API jako mody.
Návod je v [MODDING.md](MODDING.md), příklad v `mods/example-kvasinky/` (ve hře je
vypnutý, zapneš ho v menu Mody).

## Testy

```
npm test               # simulace, kampaň, mody (bez prohlížeče, pár sekund)
npm run test:browser   # skutečná stránka v headless Chromiu, snímky do test/shots/
```

- `test/sim.test.js`: pravidla simulace, uložení a načtení, opakovatelnost, výkon, texty.
- `test/campaign.test.js`: skriptovaný hráč (`test/bot.js`) dohraje všech 8 misí
  s imunitním systémem i v mírumilovném režimu a ve volné hře projde celý strom mutací
  až k prvním spórám. Používá jen tahy, které má skutečný hráč.
- `test/mods.test.js`: ukázkový mod, jeho mise, chybné mody, hra uložená s modem.
- `tools/playtest.js`: menu, stavění myší, tažení pásů, ukládání, strom mutací, mody.
  Potřebuje Chromium (`CHROME=/cesta`, výchozí `/usr/bin/chromium`) a `npm install`.

## Struktura

```
server/server.js      statický server, /api/mods, /health
public/engine/        registr prototypů, načítání modů, generátor náhody
public/sim/           simulace bez DOM (běží i v Node): svět, pásy, stavby, kapaliny,
                      ATP, imunitní systém, cíle, mapy, ukládání
public/render/        vykreslování na canvas, ikony a stavby kreslené kódem
public/ui/, input/    rozhraní, menu, strom mutací, ovládání, úložiště
public/base/          základní hra jako mod: obsah, mise, texty
mods/                 mody ze serveru
test/, tools/         testy
```

## Odchylky od plánu (`PLAN.md`)

- Položek je 24 a mutací 33 (plán odhadoval asi 35 a 30).
- Pásy mají jeden pruh a vkládají přímo do staveb; stroje vysouvají výrobky samy.
- Věže na biofilmu si berou munici z Jádra, není potřeba ji k nim vozit.
- Mody nahrané v prohlížeči musí být v jednom souboru `main.js`; vícesouborové patří do
  složky `mods/` na serveru.
- Docker image se na vývojovém stroji nedal sestavit (není tam Docker), soubory jsou
  napsané podle fungujícího vzoru z `cells/`.

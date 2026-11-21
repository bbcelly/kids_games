# Biofilm — automatizační hra o bakteriální kolonii (`bactorio/`)

## Kontext
Chceš hru v žánru automatizace továren, ale na motivy živých organismů a bakterií, s hratelnou kampaní a cestou pro uživatelské mody. Složka `bactorio/` je prázdná, staví se od nuly.

Tvoje rozhodnutí:
- **Název:** Biofilm (složka zůstává `bactorio/`). Obsah je originální: vlastní mechaniky, grafika, recepty i kampaň.
- **Složitost:** pozvolná kampaň s tutoriálem, postupně plná hloubka (dlouhé řetězce, kapaliny, logistika).
- **Ovládání:** počítač, myš a klávesnice.
- **Hrozby:** imunitní systém útočí, při zakládání hry lze zapnout mírumilovný režim.

Co jsem zvolil sám (řekni, pokud chceš jinak):
- Hra pro jednoho hráče v prohlížeči, čistý JavaScript (ES moduly) bez build kroku, Canvas 2D, veškerá grafika kreslená kódem a zvuky syntetizované přes WebAudio. Žádné stažené assety.
- Čeština jako výchozí jazyk, angličtina druhá, texty přes překladové tabulky (mody mohou přidat jazyk).
- Konvence podle `cells/`: testy v čistém Node, `Dockerfile` + `compose.yaml` pro Komodo, port 8081 (8080 drží Primordial).
- Commity po milnících rovnou do `master` s prefixem `Biofilm:`, stejně jako dosavadní historie. Schválením plánu to bereš jako odsouhlasené.

## Herní návrh

**Princip.** Pohled shora na dlaždicovou mapu. Nehraješ za postavičku, řídíš kolonii z **Jádra**. Stavět se dá jen na **biofilmu** (sliz, který kolonie rozšiřuje), takže růst území je součást logistiky. Stavby se platí ze zásob Jádra, kam musí suroviny dojet po pásech; na rozjezd jde suroviny sbírat klikáním.

**Suroviny na mapě:** glukóza, aminokyseliny, železo, fosfát, voda (dlaždice), světlé zóny (pro fotosyntézu).

**Stavby (cca 25):**
- Těžba a doprava: Absorbér, Řasinkový pás (2 rychlosti), Pilus (podavač; dlouhý, filtrační), Vezikulární tunel, Rozbočka, Zásobní vakuola.
- Výroba: Fermentor (jednoduché přeměny), Ribozom (skládání), Enzymový reaktor (kapaliny), Sporangium (cíl hry).
- Kapaliny: Osmotická pumpa, Kanálek, Nádrž. Síť kanálků je jedna sdílená nádrž.
- Energie (ATP, jedna společná síť kolonie): Fermentační generátor, Fotosyntetická buňka, Dýchací řetězec, ATP zásobník. Nedostatek ATP stroje zpomaluje.
- Území: Slizová buňka (rozšiřuje biofilm).
- Výzkum: Genomové centrum, spotřebovává Sekvence α/β/γ/δ.
- Obrana: Bakteriocinová věž (munice), Slizová bariéra, Enzymový rozprašovač, Čisticí buňka (pohlcuje toxiny).

**Výrobní strom:** asi 35 položek (glukóza → ATP kapsle, proteiny, lipidy, membrány, enzymy, RNA, DNA, plazmidy, bakteriocin, spóry, čtyři druhy sekvencí) a asi 30 technologií („mutací“) ve čtyřech úrovních.

**Hrozby.** Výroba vypouští toxiny, které se šíří po mapě. Imunitní uzliny je vstřebávají a posílají vlny: Neutrofil (rychlý), Makrofág (pomalý, odolný), Bakteriofág (vyřadí stavbu z provozu). Nepřátelé jdou po poli vzdáleností k nejbližší stavbě. Mírumilovný režim uzliny a vlny vypne a obranné mise dostanou výrobní cíl.

**Kampaň (8 misí, odemykají se postupně, každá má cíle a volitelný bonus):**
1. První kapka — tutoriál: sběr, Absorbér, pás, Fermentor.
2. Stavební kameny — Pilus, Ribozom, automatická výroba proteinů.
3. Slizové město — rozšiřování biofilmu, ATP síť, sklady.
4. Kód života — Genomové centrum, Sekvence α, první mutace.
5. Tekutiny — pumpy, kanálky, lipidy a membrány.
6. Imunitní odpověď — toxiny, obrana, první vlny.
7. Symbióza — kolonie ve střevě hostitele, pokročilé řetězce, antibiotické události.
8. Sporulace — Sporangium a vypuštění spór, závěr kampaně.

Vedle kampaně **volná hra**: procedurální mapa ze seedu, celý strom, cíl vypustit 100 spór.

## Mody
Základní hra je sama mod (`public/base/`) a používá stejné API jako uživatelské mody, takže API prokazatelně stačí na celou hru.

- **Formát:** složka s `mod.json` (id, název, verze, závislosti) a `main.js`. Ten exportuje `data(api)` pro přidání nebo úpravu položek, receptů, staveb, technologií, nepřátel, misí a překladů, a volitelně `control(api)` s háčky za běhu (`onTick`, `onBuilt`, `onResearched`, vlastní chování stavby). Ikony a sprity se kreslí funkcí nad canvasem nebo se popíšou deklarativně (tvar, barva, znak).
- **Instalace dvěma cestami:** složka v `bactorio/mods/` na serveru (server je vypíše přes `/api/mods`), nebo import v prohlížeči (`.zip`, složka či jeden `.js`), uložený v IndexedDB.
- **Správce modů** v menu: zapnout/vypnout, pořadí podle závislostí, zobrazení chyb. Uložená hra si pamatuje mody a verze a při neshodě varuje.
- Mody v JS běží s plnými právy stránky; import z prohlížeče na to upozorní.
- **Dokumentace** `MODDING.md` a ukázkový mod `mods/example-kvasinky/` (nová surovina, recept, stavba, technologie a mise).

## Architektura
```
bactorio/
  package.json            "type": "module", skripty start / test / test:browser
  server/server.js        statický server bez závislostí, /api/mods, /health
  public/
    index.html, style.css, main.js
    engine/   registry.js (prototypy + validace), modloader.js, events.js, rng.js
    sim/      world.js, mapgen.js, belts.js, inserters.js, crafting.js, fluids.js,
              power.js, territory.js, research.js, toxins.js, enemies.js, combat.js,
              objectives.js, save.js, sim.js
    render/   renderer.js (kamera, vrstvy, ořez na výřez), sprites.js, effects.js
    ui/       hud, stavební menu, inspektor stavby, strom mutací, cíle mise,
              hlavní menu, mapa kampaně, uložené hry, nastavení, správce modů,
              tutoriál, minimapa, i18n
    input/controls.js     stavění tažením, otáčení, pipeta, bourání, zkratky
    audio/sfx.js
    base/                 základní hra jako mod: data, mise, cs/en překlady
  mods/example-kvasinky/
  test/                   testy simulace a kampaně
  tools/playtest.js       test v Chromiu
  Dockerfile, compose.yaml, .dockerignore, README.md, MODDING.md
```
- `sim/` je čistá logika bez DOM s pevným krokem 60 za sekundu a seedovaným generátorem. Stejný kód běží v prohlížeči i v Node testech.
- Vše herní je v registru prototypů, simulace nezná konkrétní položky ani stavby.
- Ukládání do IndexedDB: sloty, automatické ukládání, export a import souboru, verze formátu s migrací. Postup kampaní zvlášť.

## Postup (milníky, po každém testy a commit)
1. Kostra: server, registr, načítání modů, svět, kamera, vykreslování, stavění a bourání.
2. Logistika: těžba, pásy, pily, tunely, rozbočky, sklady, Jádro a placení staveb.
3. Výroba, ATP síť, biofilm, kapaliny.
4. Výzkum a strom mutací, kompletní obsah základní hry.
5. Toxiny, nepřátelé, obrana, mírumilovný režim.
6. Mise 1–8, tutoriál, cíle, mapa kampaně, volná hra, závěr.
7. Menu, ukládání, nastavení, zvuky, čeština a angličtina.
8. Správce modů, import v prohlížeči, ukázkový mod, `MODDING.md`.
9. Vyvážení, výkon, Docker soubory, `README.md`.

## Ověření
- `npm test`: jednotkové testy pásů, podavačů, výroby, kapalin, ATP, výzkumu, toxinů a boje; uložení a načtení dá shodný stav; stejný seed dá stejný průběh; validace registru (každý recept je vyrobitelný a každá technologie dosažitelná).
- **Průchodnost kampaně:** pro každou z 8 misí skript, který bez prohlížeče postaví kolonii přes API simulace a doběhne do splnění cílů, v obou režimech hrozeb. Tím je doloženo, že kampaň jde dohrát.
- **Mody:** test načte ukázkový mod, ověří nový obsah v registru a jeho misi dohraje; test chybného modu ověří, že hru neshodí.
- **Prohlížeč:** `tools/playtest.js` přes `puppeteer-core` a `/usr/bin/chromium` projde menu, spustí misi 1, postaví linku, uloží a načte hru, importuje mod, hlídá chyby v konzoli a pořídí snímky, které si prohlédnu.
- **Výkon:** zátěžový test s tisíci staveb musí držet 60 kroků za sekundu.
- Docker na tomto stroji není, takže `Dockerfile` a `compose.yaml` napíšu podle fungujícího vzoru z `cells/`, ale sestavení image tady neověřím. Hru spustím lokálně přes `npm start` na portu 8081 a pošlu LAN adresu.

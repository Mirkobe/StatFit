# Diario Upper/Lower — app di allenamento offline

Web app installabile su Android che contiene già il programma Upper/Lower a 4 giorni:
registra carichi e ripetizioni, cronometra i recuperi e applica la doppia progressione.

Non ha dipendenze esterne: nessuna libreria, nessun font remoto, nessuna chiamata di rete.
Dopo la prima apertura funziona **completamente offline**.

## Contenuto

| File | Ruolo |
|---|---|
| `index.html` | struttura dell'app |
| `styles.css` | stile (tema chiaro e scuro automatici) |
| `app.js` | logica: programma, log, timer, progressione, backup |
| `sw.js` | service worker: mette in cache l'app per l'uso offline |
| `manifest.webmanifest` | dati di installazione (nome, icone, avvio a schermo intero) |
| `icons/` | icone dell'app (192, 512, maskable) |

## Pubblicazione

Un service worker si registra **solo su HTTPS** (o su `localhost`). Aprire `index.html`
con un doppio clic dal disco **non** funziona: serve un indirizzo web. Tre modi, tutti gratuiti.

### GitHub Pages
1. Crea un repository nuovo su github.com (può essere privato solo con account a pagamento; per Pages gratuito serve pubblico).
2. Carica il contenuto di questa cartella nella radice del repository.
3. Settings → Pages → Source: `Deploy from a branch`, branch `main`, cartella `/root`.
4. Dopo un minuto l'app è su `https://<utente>.github.io/<repo>/`.

### Cloudflare Pages
1. Accedi a dash.cloudflare.com → Workers & Pages → Create → Pages → Upload assets.
2. Trascina questa cartella, dai un nome al progetto, pubblica.
3. Ottieni un indirizzo `https://<nome>.pages.dev`.

### Netlify
1. Accedi a app.netlify.com → Add new site → Deploy manually.
2. Trascina la cartella. (Serve l'account: i deploy anonimi scadono.)

## Installazione su Android

1. Apri l'indirizzo HTTPS in **Chrome** sul telefono.
2. Compare il riquadro "Installa" dentro l'app: toccalo.
   In alternativa: menu ⋮ → *Installa app* / *Aggiungi a schermata Home*.
3. L'app appare nel cassetto delle applicazioni con la sua icona e si apre a schermo intero,
   senza barra del browser.

Da quel momento funziona anche in modalità aereo.

## Aggiornare l'app

Il service worker serve la copia in cache. Dopo aver modificato i file:

1. cambia la versione in `sw.js` (`var CACHE = "diario-ul-v2";`);
2. ripubblica la cartella.

Alla successiva apertura online l'app scarica la versione nuova e cancella la vecchia cache.

## Dati e backup

I dati restano **su quel telefono** (`localStorage` del browser), non su un server:
nessuno li vede, ma nessuno li salva al posto tuo.

- **Esporta dati** scarica un file `.json` con tutto lo storico → mettilo su Drive ogni tanto.
- **Importa** ripristina un backup (sostituisce i dati presenti).
- L'app chiede al browser l'archiviazione persistente e ti ricorda il backup ogni 12 allenamenti.

Disinstallare l'app o cancellare i dati del browser cancella lo storico: **esporta prima**.

## Modificare il programma

Gli esercizi stanno all'inizio di `app.js`, nella costante `PROGRAM`. Ogni esercizio ha:

```js
{ slug: "panca-piana", name: "Panca piana (bilanciere)", sets: 4, min: 6, max: 8, rest: 120 }
```

`min`/`max` sono il range di ripetizioni (guidano la doppia progressione), `rest` è il
recupero in secondi. `slug` è l'identificativo con cui viene salvato lo storico di quell'esercizio:
se lo cambi, quell'esercizio riparte senza storico.

Altre due costanti regolabili: `DELOAD_AFTER` (sedute prima del promemoria di scarico, default 20)
e `BACKUP_NUDGE` (sedute prima del promemoria di backup, default 12).

## Prova in locale (facoltativo)

Con node installato, dalla cartella:

```
npx --yes serve -l 8080
```

poi apri `http://localhost:8080` — su localhost il service worker funziona.

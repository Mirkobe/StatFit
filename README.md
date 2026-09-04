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

Il service worker serve la copia in cache. Dopo aver modificato i file, cambia **entrambi**
questi valori, tenendoli allineati:

1. `var CACHE = "diario-ul-v4";` in `sw.js` — è ciò che fa scattare l'aggiornamento;
2. `var APP_VERSION = "4";` e `APP_DATE` in cima ad `app.js` — è ciò che l'app mostra.

Poi ripubblica la cartella. Alla successiva apertura online l'app scarica la versione nuova
e cancella la vecchia cache.

In fondo alla schermata iniziale l'app scrive la versione del codice **realmente in
esecuzione**: se il telefono sta ancora servendo una copia vecchia dalla cache, lì compare
il numero vecchio. È il modo più rapido per capire se un aggiornamento è arrivato davvero.

Accanto c'è **cerca aggiornamenti**, che forza il controllo: se trova un service worker
nuovo lo attiva e ricarica la pagina, altrimenti dice che sei già aggiornato. Ricarica
**solo** quando un worker nuovo esiste davvero — una ricarica incondizionata non
servirebbe a nulla, perché la pagina tornerebbe dalla stessa cache.

GitHub Pages serve gli asset con `max-age=600`: se cerchi aggiornamenti entro pochi minuti
dalla pubblicazione, il worker nuovo potrebbe archiviare file ancora vecchi. In quel caso
la riga della versione lo mostra e basta ripetere il controllo più tardi.

### Nota per chi tocca `sw.js`

Il precaching deve restare una **singola `cache.addAll(ASSETS)`**. Scritture separate sulla
stessa cache — in parallelo o in sequenza, con `cache.put` o `cache.add`, e `addAll` con
richieste in modalità `reload` — falliscono con `InvalidAccessError: Entry already exists`:
l'installazione salta, il worker non attiva mai e l'app resta senza modalità offline **senza
alcun errore visibile**, perché la registrazione risulta comunque riuscita.

## Dati e backup

I dati restano **su quel telefono** (`localStorage` del browser), non su un server:
nessuno li vede, ma nessuno li salva al posto tuo.

- **Esporta dati** scarica un file `.json` con tutto lo storico → mettilo su Drive ogni tanto.
- **Importa** ripristina un backup (sostituisce i dati presenti).
- L'app chiede al browser l'archiviazione persistente e ti ricorda il backup ogni 12 allenamenti.

Disinstallare l'app o cancellare i dati del browser cancella lo storico: **esporta prima**.

## Peso corporeo

La sezione peso registra una pesata al giorno (reinserirla lo stesso giorno la corregge,
non la duplica) e la mostra su un grafico.

**Registrazione.** Il campo `Giorno` è impostato su oggi, quindi registrare la pesata odierna
resta di due tocchi: scrivi il numero e premi *Registra*. Per recuperare un giorno passato
cambi la data: il pulsante diventa *"Registra il 30 ago"*, e se quel giorno era già stato
registrato l'app te lo dice prima di sovrascriverlo. Dopo il salvataggio la data torna da sola
su oggi. Le date future sono rifiutate (romperebbero il calcolo del trend).

I campi numerici accettano **sia la virgola sia il punto** (`75,8` e `75.8`): sono campi di
testo con tastierino decimale, non `input type=number`, che scarta la virgola prodotta dalla
tastiera italiana.

**Perché il grafico mostra due cose diverse.** Il peso giornaliero oscilla di 1-2 kg per
acqua, glicogeno e contenuto intestinale: la singola pesata non dice quasi nulla. Quindi:

- i **punti grigi** sono le misurazioni grezze, tenute volutamente in secondo piano;
- la **linea** è la media mobile a 7 giorni — il segnale su cui decidere.

**Il ritmo settimanale** non è la differenza fra due pesate (amplificherebbe il rumore) ma la
pendenza di una regressione ai minimi quadrati sugli ultimi 21 giorni, espressa in kg/settimana
e in %/settimana. Servono almeno 4 pesate distribuite su 2 settimane perché abbia senso: sotto
quella soglia l'app mostra `—` invece di un numero inventato.

L'etichetta accanto al ritmo valuta il valore rispetto a una fase di **definizione**
(target: −0,5% / −0,75% del peso a settimana). Le soglie stanno in `renderWeightStats()`
dentro `app.js`: se passi a una fase di massa vanno cambiate lì.

Le pesate sono incluse nell'export/import del backup.

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

// Importăm Express — pachetul care ne ajută să facem site-ul (rute, pagini, middleware)
const express = require('express');
const sharp = require('sharp');
const sass = require('sass');
// Importăm fs (file system) — pentru citire/scriere fișiere și foldere pe disc
const fs = require('fs');
// Importăm path — pentru căi corecte la fișiere (path.join), indiferent de Windows/Linux
const path = require('path');
// Creăm aplicația web: obiectul „app” pe care îl configurăm (rute, setări) și îl pornim cu listen
const app = express();
// Portul pe care ascultă serverul în browser: http://localhost:8080
const PORT = 8080;

console.log('__dirname:', __dirname); //folderul curent
console.log('__filename:', __filename); //numele fișierului curent
console.log('process.cwd():', process.cwd()); //Folderul din care ai pornit comanda node (current working directory).

// Obiect global — căi resurse + erori
let obGlobal = {
    obErori: null,
    folderScss: path.join(__dirname, 'resurse', 'css'),
    folderCss: path.join(__dirname, 'resurse', 'css')
};

// ==========================================
// CERINȚA 20: Crearea folderelor și folosirea path.join()
// ==========================================
const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];
for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder); 
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
        console.log("Am creat folderul: " + folder);
    }
}

// Setăm EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// Compilare automată SCSS
// ==========================================
/** Înlocuiește doar sufixul .scss (funcționează și pentru stil.frumos.scss). */
function inlocuiesteExtensieScss(cale) {
    if (/\.scss$/i.test(cale)) {
        return cale.replace(/\.scss$/i, '.css');
    }
    return `${cale}.css`;
}

function caleAbsolutaCssDinScss(caleScssAbs, caleCssRel) {
    if (caleCssRel) {
        return path.isAbsolute(caleCssRel)
            ? caleCssRel
            : path.join(obGlobal.folderCss, caleCssRel);
    }
    let caleRelScss = path.relative(obGlobal.folderScss, caleScssAbs);
    return path.join(obGlobal.folderCss, inlocuiesteExtensieScss(caleRelScss));
}

function caleBackupPentruCss(caleCssAbs) {
    let caleRelativa = path.relative(path.join(__dirname, 'resurse'), caleCssAbs);
    let ext = path.extname(caleRelativa);
    let numeFaraExt = path.basename(caleRelativa, ext);
    let dir = path.dirname(caleRelativa);
    let numeCuTimestamp = `${numeFaraExt}_${Date.now()}${ext}`;
    return path.join(__dirname, 'backup', 'resurse', dir, numeCuTimestamp);
}

function compileazaScss(caleScss, caleCss) {
    let caleScssAbs = path.isAbsolute(caleScss)
        ? caleScss
        : path.join(obGlobal.folderScss, caleScss);

    let caleCssAbs = caleAbsolutaCssDinScss(caleScssAbs, caleCss);

    if (!fs.existsSync(caleScssAbs)) {
        console.error('EROARE SCSS: Fișierul sursă nu există:', caleScssAbs);
        return;
    }

    if (fs.existsSync(caleCssAbs)) {
        let caleBackup = caleBackupPentruCss(caleCssAbs);
        let folderBackup = path.dirname(caleBackup);
        if (!fs.existsSync(folderBackup)) {
            fs.mkdirSync(folderBackup, { recursive: true });
        }
        try {
            fs.copyFileSync(caleCssAbs, caleBackup);
            console.log('Backup CSS:', caleBackup);
        } catch (err) {
            console.error('EROARE: Copierea CSS în backup a eșuat:', err.message);
        }
    }

    try {
        let rezultat = sass.compile(caleScssAbs, {
            loadPaths: [
                obGlobal.folderScss,
                path.dirname(caleScssAbs),
                path.join(__dirname, 'node_modules')
            ],
            style: 'expanded',
            quietDeps: true,
            silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function']
        });
        let folderDest = path.dirname(caleCssAbs);
        if (!fs.existsSync(folderDest)) {
            fs.mkdirSync(folderDest, { recursive: true });
        }
        fs.writeFileSync(caleCssAbs, rezultat.css);
        console.log('SCSS compilat:', caleScssAbs, '->', caleCssAbs);
    } catch (err) {
        console.error('EROARE compilare SCSS:', caleScssAbs, '-', err.message);
    }
}

function compileazaToateFisiereleScss(dir = obGlobal.folderScss) {
    if (!fs.existsSync(dir)) return;

    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
        let caleCompleta = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            compileazaToateFisiereleScss(caleCompleta);
            continue;
        }

        if (!entry.name.endsWith('.scss') || entry.name.startsWith('_')) {
            continue;
        }

        let caleRelScss = path.relative(obGlobal.folderScss, caleCompleta);
        compileazaScss(caleRelScss, inlocuiesteExtensieScss(caleRelScss));
    }
}

let timeoutWatchScss = {};

function pornesteWatchScss() {
    if (!fs.existsSync(obGlobal.folderScss)) {
        console.warn('Watch SCSS: folderul nu există:', obGlobal.folderScss);
        return;
    }

    fs.watch(obGlobal.folderScss, { recursive: true }, (tipEveniment, numeFisier) => {
        if (!numeFisier || !numeFisier.endsWith('.scss')) return;
        if (path.basename(numeFisier).startsWith('_')) return;

        let caleScssAbs = path.join(obGlobal.folderScss, numeFisier);
        if (!fs.existsSync(caleScssAbs)) return;

        clearTimeout(timeoutWatchScss[numeFisier]);
        timeoutWatchScss[numeFisier] = setTimeout(() => {
            console.log('Modificare SCSS detectată:', numeFisier);
            compileazaScss(numeFisier);
        }, 200);
    });

    console.log('Watch SCSS activ pe:', obGlobal.folderScss);
}

compileazaToateFisiereleScss();
pornesteWatchScss();

// Pentru testare sfert de oră: setează o dată fixă sau lasă null (ora reală).
// Exemplu sfert 2 (minute 15–29): new Date(2025, 0, 1, 8, 20, 0)
const DATA_ORA_TEST_GALERIE = null;

const DIM_GALERIE_MARE = 450;
const DIM_GALERIE_MEDIU = 300;
const DIM_GALERIE_MIC = 150;

function obtineDataOraGalerie() {
    return DATA_ORA_TEST_GALERIE instanceof Date ? DATA_ORA_TEST_GALERIE : new Date();
}

function calculeazaSfertOra(minut) {
    if (minut < 15) return 1;
    if (minut < 30) return 2;
    if (minut < 45) return 3;
    return 4;
}

function urlImagineGalerie(caleBaza, numeFisier) {
    return caleBaza + numeFisier.replace(/ /g, '%20');
}

async function genereazaVariantaGalerie(caleSursa, caleDestinatie, latime, inaltime) {
    await sharp(caleSursa)
        .resize(latime, inaltime, { fit: 'cover', position: 'centre' })
        .toFile(caleDestinatie);
}

async function trebuieRegenerata(caleSursa, caleDestinatie, latime, inaltime) {
    if (!fs.existsSync(caleSursa)) return false;
    if (!fs.existsSync(caleDestinatie)) return true;
    if (fs.statSync(caleDestinatie).mtimeMs < fs.statSync(caleSursa).mtimeMs) return true;
    try {
        const meta = await sharp(caleDestinatie).metadata();
        return meta.width !== latime || meta.height !== inaltime;
    } catch {
        return true;
    }
}

async function asiguraVariantaGalerie(caleSursa, caleDestinatie, latime, inaltime) {
    if (await trebuieRegenerata(caleSursa, caleDestinatie, latime, inaltime)) {
        await genereazaVariantaGalerie(caleSursa, caleDestinatie, latime, inaltime);
    }
}

async function prelucreazaGalerie() {
    let rawData = fs.readFileSync(path.join(__dirname, 'galerie.json'), 'utf8');
    let dateGalerie = JSON.parse(rawData);

    // Sfert de oră: 1 = :00–:14, 2 = :15–:29, 3 = :30–:44, 4 = :45–:59
    let minutCurent = obtineDataOraGalerie().getMinutes();
    let sfertCurent = calculeazaSfertOra(minutCurent);

    let pozeSfert = dateGalerie.imagini.filter(img => img.sfert_ora === sfertCurent);
    // Max. 10 imagini afișate, chiar dacă în JSON sunt mai multe pentru sfertul curent
    let pozeAlese = pozeSfert.slice(0, 10);

    let caleAbsolutaGalerie = path.join(__dirname, 'resurse', 'imagini', 'galerie');

    for (let img of pozeAlese) {
        let extensie = path.extname(img.cale_imagine);
        let numeFaraExtensie = path.basename(img.cale_imagine, extensie);

        img.fisier_mare = `${numeFaraExtensie}-mare${extensie}`;
        img.fisier_mediu = `${numeFaraExtensie}-mediu${extensie}`;
        img.fisier_mic = `${numeFaraExtensie}-mic${extensie}`;

        let caleaOriginala = path.join(caleAbsolutaGalerie, img.cale_imagine);
        let caleMare = path.join(caleAbsolutaGalerie, img.fisier_mare);
        let caleMediu = path.join(caleAbsolutaGalerie, img.fisier_mediu);
        let caleMic = path.join(caleAbsolutaGalerie, img.fisier_mic);

        if (fs.existsSync(caleaOriginala)) {
            await asiguraVariantaGalerie(caleaOriginala, caleMare, DIM_GALERIE_MARE, DIM_GALERIE_MARE);
            await asiguraVariantaGalerie(caleaOriginala, caleMediu, DIM_GALERIE_MEDIU, DIM_GALERIE_MEDIU);
            await asiguraVariantaGalerie(caleaOriginala, caleMic, DIM_GALERIE_MIC, DIM_GALERIE_MIC);
        }

        img.cale_absoluta = urlImagineGalerie(dateGalerie.cale_galerie, img.fisier_mare);
        img.cale_mediu_abs = urlImagineGalerie(dateGalerie.cale_galerie, img.fisier_mediu);
        img.cale_mic_abs = urlImagineGalerie(dateGalerie.cale_galerie, img.fisier_mic);
        img.alt_text = (img.alt != null && String(img.alt).trim() !== '')
            ? img.alt
            : numeFaraExtensie;
        img.sfert_afisat = sfertCurent;
    }

    return pozeAlese;
}

// ==========================================
// BONUS 5: Validare galerie.json la pornirea serverului
// ==========================================
function caleAbsolutaDinCaleGalerie(caleGalerie) {
    let segmente = String(caleGalerie).replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    return path.join(__dirname, ...segmente);
}

function verificaDateGalerie() {
    const caleJson = path.join(__dirname, 'galerie.json');

    if (!fs.existsSync(caleJson)) {
        console.error(
            'EROARE GALERIE: Fișierul „galerie.json” lipsește din rădăcina proiectului. ' +
            'Creați fișierul sau verificați calea de pornire a serverului (process.cwd).'
        );
        return;
    }

    let dateGalerie;
    try {
        dateGalerie = JSON.parse(fs.readFileSync(caleJson, 'utf8'));
    } catch (err) {
        console.error(
            'EROARE GALERIE: „galerie.json” nu poate fi citit (JSON invalid). ' +
            `Detalii: ${err.message}`
        );
        return;
    }

    if (!dateGalerie.cale_galerie || typeof dateGalerie.cale_galerie !== 'string') {
        console.error(
            'EROARE GALERIE: Proprietatea „cale_galerie” lipsește sau nu este un șir de caractere. ' +
            'Exemplu valid: "/resurse/imagini/galerie/"'
        );
        return;
    }

    const caleFolderAbs = caleAbsolutaDinCaleGalerie(dateGalerie.cale_galerie);
    if (!fs.existsSync(caleFolderAbs)) {
        console.error(
            'EROARE GALERIE (folder): Folderul indicat în „cale_galerie” nu există în sistemul de fișiere.\n' +
            `  • Valoare JSON: "${dateGalerie.cale_galerie}"\n` +
            `  • Cale absolută verificată: ${caleFolderAbs}\n` +
            '  • Remediere: creați folderul sau corectați „cale_galerie” în galerie.json.'
        );
    } else if (!fs.statSync(caleFolderAbs).isDirectory()) {
        console.error(
            'EROARE GALERIE (folder): „cale_galerie” indică un fișier, nu un director.\n' +
            `  • Cale: ${caleFolderAbs}`
        );
    }

    if (!Array.isArray(dateGalerie.imagini)) {
        console.error(
            'EROARE GALERIE: Proprietatea „imagini” lipsește sau nu este un array în galerie.json.'
        );
        return;
    }

    if (!fs.existsSync(caleFolderAbs)) {
        return;
    }

    dateGalerie.imagini.forEach((img, index) => {
        const pozitie = index + 1;
        const titlu = img && img.titlu ? img.titlu : '(fără titlu)';

        if (!img || !img.cale_imagine) {
            console.error(
                `EROARE GALERIE (imagine #${pozitie}): Lipsește proprietatea „cale_imagine” ` +
                `(titlu în JSON: "${titlu}").`
            );
            return;
        }

        const caleFisierAbs = path.join(caleFolderAbs, img.cale_imagine);
        if (!fs.existsSync(caleFisierAbs)) {
            console.error(
                'EROARE GALERIE (fișier lipsă): Imaginea din listă nu există pe disc.\n' +
                `  • Poziție în JSON: #${pozitie}\n` +
                `  • Titlu: "${titlu}"\n` +
                `  • cale_imagine: "${img.cale_imagine}"\n` +
                `  • Cale absolută verificată: ${caleFisierAbs}\n` +
                '  • Remediere: adăugați fișierul în folderul galeriei sau corectați numele din JSON.'
            );
        }
    });

    console.log('=== Validare galerie.json finalizată ===');
}

// ==========================================
// BONUS: Funcția de validare a datelor JSON
// ==========================================
function valideazaErori() {
    const caleJson = path.join(__dirname, 'erori.json');

    if (!fs.existsSync(caleJson)) {
        console.error("ERRORE CRITICĂ: Fișierul 'erori.json' lipsește!");
        process.exit(1); 
    }

    const textJson = fs.readFileSync(caleJson, 'utf8');

    // F. Verificare proprietăți duplicate (PE STRING)
    const regexDuplicate = /"([^"]+)"\s*:\s*[^,}]+\s*,\s*"\1"\s*:/g; 
    if (regexDuplicate.test(textJson)) {
        console.warn("ATENȚIE (F): S-au detectat proprietăți duplicate în interiorul aceluiași obiect în JSON.");
    }

    let date;
    try {
        date = JSON.parse(textJson);
    } catch (e) {
        console.error("EROARE: JSON-ul are erori de sintaxă.");
        return;
    }

    const propObligatorii = ['info_erori', 'cale_baza', 'eroare_default'];
    propObligatorii.forEach(prop => {
        if (!date.hasOwnProperty(prop)) console.error(`EROARE JSON (B): Lipsește "${prop}".`);
    });

    if (date.eroare_default) {
        ['titlu', 'text', 'imagine'].forEach(prop => {
            if (!date.eroare_default.hasOwnProperty(prop)) console.error(`EROARE JSON (C): În default lipsește "${prop}".`);
        });
    }

    if (date.cale_baza) {
        const caleAbsolutaBaza = path.join(__dirname, date.cale_baza);
        if (!fs.existsSync(caleAbsolutaBaza)) {
            console.error(`EROARE SISTEM (D): Folderul ${date.cale_baza} nu există.`);
        } else {
            const verificaImagine = (img, context) => {
                if(!img) return;
                const caleImg = path.join(caleAbsolutaBaza, img);
                if (!fs.existsSync(caleImg)) console.error(`EROARE IMAGINE (E): Fișierul "${img}" (${context}) nu există.`);
            };
            if(date.eroare_default) verificaImagine(date.eroare_default.imagine, "eroare_default");
            if(date.info_erori) date.info_erori.forEach(err => verificaImagine(err.imagine, `ID: ${err.identificator}`));
        }
    }

    if (date.info_erori) {
        let idsSeen = {};
        date.info_erori.forEach(err => {
            if (idsSeen[err.identificator]) console.error(`EROARE JSON (G): Identificatorul ${err.identificator} este duplicat!`);
            idsSeen[err.identificator] = true;
        });
    }
    console.log("=== Validare JSON erori finalizată ===");
}

// ==========================================
// CERINȚA 13 & 14: Logica Erorilor
// ==========================================
function initErori() {
    valideazaErori(); 
    
    let continut = fs.readFileSync(path.join(__dirname, 'erori.json'), 'utf8');
    obGlobal.obErori = JSON.parse(continut);
    
    let cale_baza = obGlobal.obErori.cale_baza;
    obGlobal.obErori.eroare_default.imagine = path.join(cale_baza, obGlobal.obErori.eroare_default.imagine);
    
    for (let eroare of obGlobal.obErori.info_erori) {
        eroare.imagine = path.join(cale_baza, eroare.imagine);
    }
}
initErori();
verificaDateGalerie();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let eroareSelectata = obGlobal.obErori.eroare_default;
    if (identificator) {
        let eroareGasita = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
        if (eroareGasita) { eroareSelectata = eroareGasita; }
    }

    res.render(path.join('pagini', 'eroare'), {
        titlu: titlu || eroareSelectata.titlu, 
        text: text || eroareSelectata.text, 
        imagine: imagine || eroareSelectata.imagine
    });
}

// ==========================================
// RUTE ȘI SECURITATE
// ==========================================

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'ico', 'favicon.ico'));
});

// Cerința 18: Blocare .ejs
app.use((req, res, next) => {
    if (req.url.includes('.ejs')) return afisareEroare(res, 400);
    next();
});

// Cerința 17: Blocare explorare directoare
app.get(/^\/resurse(\/.*)*\/$/, (req, res) => {
    afisareEroare(res, 403);
});

//cerinta 6 - folosim express.static pentru a servi fișierele statice din folderul resurse
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

//cerinta 8 — pagina principală (include fragmentul galerie.ejs)
app.get(['/', '/index', '/home'], async (req, res) => {
    try {
        res.render(path.join('pagini', 'index'), {
            ip_utilizator: req.ip,
            imagini: await prelucreazaGalerie()
        });
    } catch (err) {
        console.error('Eroare galerie (index):', err);
        afisareEroare(res, 500);
    }
});

// Galerie statică — pagină separată, același fragment, fără duplicare HTML
app.get('/statica', async (req, res) => {
    try {
        res.render(path.join('pagini', 'statica'), {
            imagini: await prelucreazaGalerie()
        });
    } catch (err) {
        console.error('Eroare galerie (statica):', err);
        afisareEroare(res, 500);
    }
});

//cerinta 9
//cautam pagina in folderul pagini si o randam daca exista, daca nu, afisam eroarea 404
app.get('/*cale', (req, res) => { ///* ruta dinamica
    let numePagina = path.join('pagini', req.url);
    res.render(numePagina, function(err, rezultatRandare) {
        if (err) {
            if (err.message.startsWith("Failed to lookup view")) afisareEroare(res, 404);
            else afisareEroare(res, 500);
        } else {
            res.send(rezultatRandare);
        }
    });
});

app.listen(PORT, () => {
    console.log(`Serverul a pornit la http://localhost:${PORT}`);
});
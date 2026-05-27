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
const PORT = process.env.PORT || 8080;
const { Pool } = require('pg');

// La `node index.js` — doar mesajul serverului. Detalii (SCSS, validări): set LOG_DETALII=1 node index.js
const LOG_DETALII = process.env.LOG_DETALII === '1';
function logDetalii(...args) {
    if (LOG_DETALII) console.log(...args);
}

//etapa 5 - variabilă globală pentru erori și căi foldere - compilare-automata-scss a)
let obGlobal = {
    obErori: null,
    folderScss: path.join(__dirname, 'resurse', 'css'),
    folderCss: path.join(__dirname, 'resurse', 'css')
};


// ==========================================
// Conexiunea la Baza de Date MABFragrance
// ==========================================
const db = new Pool({
    user: 'user_mab',
    host: 'localhost',
    database: 'mab_fragrance_db',
    password: 'parola_mab123',
    port: 5432, // Acesta este portul standard pentru Postgres
});

// Testăm dacă funcționează conexiunea
db.connect((err) => {
    if (err) {
        console.error('EROARE CRITICĂ: Nu mă pot conecta la baza de date!', err.message);
    } else {
        logDetalii('✅ Succes! Node.js a deschis seiful bazei de date!');
    }
});
// ==========================================
// CERINȚA 20: Crearea folderelor și folosirea path.join() - etapa 4
// ==========================================
const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];
for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder); 
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder);
        logDetalii('Am creat folderul: ' + folder);
    }
}

// Setăm EJS - etapa 4
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// Compilare automată SCSS
// ==========================================

function inlocuiesteExtensieScss(cale) { //etapa 5 - bonus 4)
    if (/\.scss$/i.test(cale)) {
        return cale.replace(/\.scss$/i, '.css');
    }
    return `${cale}.css`;
}

function caleAbsolutaCssDinScss(caleScssAbs, caleCssRel) {//etapa 5 - compilare-automata-scss b) 
    if (caleCssRel) {
        return path.isAbsolute(caleCssRel)
            ? caleCssRel
            : path.join(obGlobal.folderCss, caleCssRel);
    }
    let caleRelScss = path.relative(obGlobal.folderScss, caleScssAbs);
    return path.join(obGlobal.folderCss, inlocuiesteExtensieScss(caleRelScss));
}

// Etapa 5 - bonus 3) backup pentru CSS existent înainte de compilare c)
function caleBackupPentruCss(caleCssAbs) {
    let caleRelativa = path.relative(path.join(__dirname, 'resurse'), caleCssAbs);
    let ext = path.extname(caleRelativa);
    let numeFaraExt = path.basename(caleRelativa, ext);
    let dir = path.dirname(caleRelativa);
    let numeCuTimestamp = `${numeFaraExt}_${Date.now()}${ext}`;
    return path.join(__dirname, 'backup', 'resurse', dir, numeCuTimestamp);
}

// Etapa 6 — curățare backup (fișiere mai vechi de T minute, verificare repetată)
const FOLDER_BACKUP = path.join(__dirname, 'backup');
const BACKUP_T_MINUTE = 30;
const BACKUP_VERIFICARE_MS = 2 * 60 * 1000;

function stergeDirectoareGoale(dir) {
    if (!fs.existsSync(dir)) return;
    for (const intrare of fs.readdirSync(dir, { withFileTypes: true })) {
        if (intrare.isDirectory()) {
            stergeDirectoareGoale(path.join(dir, intrare.name));
        }
    }
    if (dir !== FOLDER_BACKUP && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        logDetalii('Folder backup gol șters:', dir);
    }
}

function curataFisiereBackupVechi() {
    if (!fs.existsSync(FOLDER_BACKUP)) return;

    const limitaTimp = Date.now() - BACKUP_T_MINUTE * 60 * 1000;

    function parcurgeFolder(caleDir) {
        for (const intrare of fs.readdirSync(caleDir, { withFileTypes: true })) {
            const cale = path.join(caleDir, intrare.name);
            if (intrare.isDirectory()) {
                parcurgeFolder(cale);
            } else if (intrare.isFile()) {
                const { mtimeMs } = fs.statSync(cale);
                if (mtimeMs < limitaTimp) {
                    fs.unlinkSync(cale);
                    logDetalii('Backup expirat șters:', cale);
                }
            }
        }
    }

    try {
        parcurgeFolder(FOLDER_BACKUP);
        stergeDirectoareGoale(FOLDER_BACKUP);
    } catch (err) {
        console.error('Curățare backup:', err.message);
    }
}

function initCuratareBackup() {
    curataFisiereBackupVechi();
    setInterval(curataFisiereBackupVechi, BACKUP_VERIFICARE_MS);
}

initCuratareBackup();

 // TASK SCSS: Compilare automată la modificare și backup pentru CSS existent-b) etapa 5
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
            logDetalii('Backup CSS:', caleBackup);
        } catch (err) {
            console.error('EROARE: Copierea CSS în backup a eșuat:', err.message);
        }
    }

    try { //motorul sass poate arunca erori dacă SCSS-ul e scris greșit, de exemplu dacă ai uitat o acoladă sau o paranteză. Blocul try-catch prinde acele erori și le afișează frumos în consolă, fără să oprească tot serverul.
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
        logDetalii('SCSS compilat:', caleScssAbs, '->', caleCssAbs);
    } catch (err) {
        console.error('EROARE compilare SCSS:', caleScssAbs, '-', err.message);
    }
}

function compileazaToateFisiereleScss(dir = obGlobal.folderScss) { //etapa 5 - compilare-automata-scss d)
    if (!fs.existsSync(dir)) return;

    for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {//Această setare este crucială. Dacă nu o puneai, funcția îți dădea doar o listă de texte (ex: ["stil.scss", "folder_nou"]). Punând setarea asta pe true, funcția îți dă niște obiecte inteligente, care știu singure despre ele dacă sunt fișiere normale sau foldere!
        let caleCompleta = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            compileazaToateFisiereleScss(caleCompleta);
            continue;
        }

        if (!entry.name.endsWith('.scss') || entry.name.startsWith('_')) { //(În limbajul SCSS, fișierele care încep cu _, cum ar fi _culori.scss, se numesc „parțiale”. Ele conțin doar variabile și sunt importate în alte fișiere. Nu trebuie traduse individual în CSS!).
            continue;
        }

        let caleRelScss = path.relative(obGlobal.folderScss, caleCompleta);
        compileazaScss(caleRelScss, inlocuiesteExtensieScss(caleRelScss));
    }
}

let timeoutWatchScss = {};

function pornesteWatchScss() { //etapa 5 - compilare-automata-scss e)
    if (!fs.existsSync(obGlobal.folderScss)) {
        console.warn('Watch SCSS: folderul nu există:', obGlobal.folderScss);
        return;
    }

    fs.watch(obGlobal.folderScss, { recursive: true }, (tipEveniment, numeFisier) => { 
        if (!numeFisier || !numeFisier.endsWith('.scss')) return; //
        if (path.basename(numeFisier).startsWith('_')) return; 

        let caleScssAbs = path.join(obGlobal.folderScss, numeFisier);
        if (!fs.existsSync(caleScssAbs)) return;

        clearTimeout(timeoutWatchScss[numeFisier]); //debouncing - dacă ai făcut mai multe modificări rapid la același fișier, să nu pornească de fiecare dată compilarea, ci doar după ce te-ai oprit din modificat pentru 200ms.
        timeoutWatchScss[numeFisier] = setTimeout(() => {
            logDetalii('Modificare SCSS detectată:', numeFisier);
            compileazaScss(numeFisier);
        }, 200);
    });

    logDetalii('Watch SCSS activ pe:', obGlobal.folderScss);
}

compileazaToateFisiereleScss();
pornesteWatchScss();



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
        .resize(latime, inaltime, { fit: 'cover', position: 'centre' }) //setari sub forma de obiect pentru a nu se confunda ordinea parametrilor, pentru a fi mai usor de citit si pentru a putea adauga usor alte setari in viitor (ex: calitatea imaginii)
        .toFile(caleDestinatie);
}

async function trebuieRegenerata(caleSursa, caleDestinatie, latime, inaltime) {
    if (!fs.existsSync(caleSursa)) return false;
    if (!fs.existsSync(caleDestinatie)) return true;
    if (fs.statSync(caleDestinatie).mtimeMs < fs.statSync(caleSursa).mtimeMs) return true;
    try {
        const meta = await sharp(caleDestinatie).metadata(); //Citește informațiile despre varianta deja procesată (cât de lată și înaltă e).
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

//task galerie statica - etapa 5- pas 1
async function prelucreazaGalerie() {
    let rawData = fs.readFileSync(path.join(__dirname, 'galerie.json'), 'utf8');
    let dateGalerie = JSON.parse(rawData);

    // Sfert de oră: 1 = :00–:14, 2 = :15–:29, 3 = :30–:44, 4 = :45–:59
    let minutCurent = obtineDataOraGalerie().getMinutes();
    let sfertCurent = calculeazaSfertOra(minutCurent);

    let pozeSfert = dateGalerie.imagini.filter(img => img.sfert_ora === sfertCurent);
    
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

//bonus-etapa 5 - galerie animată
async function prelucreazaGalerieAnimata() {
    const puteri = [2, 4, 8];
    const N = puteri[Math.floor(Math.random() * puteri.length)];

    const rawData = fs.readFileSync(path.join(__dirname, 'galerie.json'), 'utf8');
    const dateJson = JSON.parse(rawData);

    const imaginiAnimate = [];
    for (let i = 0; i < dateJson.imagini.length; i += 2) {
        imaginiAnimate.push(dateJson.imagini[i]);
        if (imaginiAnimate.length === N) {
            break;
        }
    }

    const caleScss = path.join(__dirname, 'resurse', 'scss', 'galerie-animata.scss');
    const caleCss = path.join(__dirname, 'resurse', 'css', 'galerie-animata.css');
    let continutScss = fs.readFileSync(caleScss, 'utf8');
    continutScss = `$nr-imagini: ${N};\n` + continutScss;

    try {
        const rezultat = sass.compileString(continutScss, {
            loadPaths: [path.join(__dirname, 'resurse', 'scss')],
            style: 'expanded',
            silenceDeprecations: ['slash-div', 'global-builtin']
        });
        fs.writeFileSync(caleCss, rezultat.css);
    } catch (err) {
        console.error('Eroare SCSS Galerie Animată:', err.message);
    }

    return { imagini_animata: imaginiAnimate, nr_imagini: N };
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
        dateGalerie = JSON.parse(fs.readFileSync(caleJson, 'utf8')); //Încearcă să citească fișierul JSON. Dacă ai uitat o virgulă sau o ghilimea în acel fișier, funcția internă JSON.parse va exploda. Blocul catch prinde explozia și îți explică politicos în consolă că ai scris JSON-ul greșit, arătându-ți fix detaliul (err.message).
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

    logDetalii('=== Validare galerie.json finalizată ===');
}

// ==========================================
// BONUS: Funcția de validare a datelor JSON // etapa 4
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
        logDetalii('ATENȚIE (F): S-au detectat proprietăți duplicate în interiorul aceluiași obiect în JSON.');
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
    logDetalii('=== Validare JSON erori finalizată ===');
}

// ==========================================
// CERINȚA 13 & 14: Logica Erorilor
// ==========================================
function initErori() { //etapa 4 - cerinta 13
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

function afisareEroare(res, identificator, titlu, text, imagine) { //etapa 4 - cerinta 13
    let eroareSelectata = obGlobal.obErori.eroare_default;
    if (identificator) {
        let eroareGasita = obGlobal.obErori.info_erori.find(e => e.identificator === identificator);
        if (eroareGasita) { eroareSelectata = eroareGasita; }
    }

    const statusHttp = Number(identificator);
    if (Number.isInteger(statusHttp) && statusHttp >= 400 && statusHttp < 600) {
        res.status(statusHttp);
    }

    res.render(path.join('pagini', 'eroare'), {
        titlu: titlu || eroareSelectata.titlu, 
        text: text || eroareSelectata.text, 
        imagine: imagine || eroareSelectata.imagine
    });
}

// ==========================================
// Produse — helpers și categorii meniu (din ENUM PostgreSQL)
// ==========================================
const LUNI_RO = [
    'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
    'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'
];
const ZILE_RO = [
    'Duminica', 'Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata'
];

function parseazaDataCalendaristica(data) {
    if (!data) return null;
    if (data instanceof Date && !Number.isNaN(data.getTime())) return data;
    const s = String(data);
    const doarData = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (doarData) {
        return new Date(Number(doarData[1]), Number(doarData[2]) - 1, Number(doarData[3]));
    }
    const d = new Date(data);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formataDataRo(data) {
    const d = parseazaDataCalendaristica(data);
    if (!d) return '';
    return `${ZILE_RO[d.getDay()]}, ${d.getDate()} ${LUNI_RO[d.getMonth()]} ${d.getFullYear()}`;
}

function dataIsoPentruTime(data) {
    const d = parseazaDataCalendaristica(data);
    if (!d) return '';
    const an = d.getFullYear();
    const luna = String(d.getMonth() + 1).padStart(2, '0');
    const zi = String(d.getDate()).padStart(2, '0');
    return `${an}-${luna}-${zi}`;
}

// Bonus 18 — produse noi (interval T de la data_lansare în catalog)
const PRODUS_NOU_T_MS = 90 * 24 * 60 * 60 * 1000; // 90 zile demo (producție: 365 * 24 * 60 * 60 * 1000)
const LIMITA_PRODUSE_NOI_INDEX = 6;

function pragProdusNouDate() {
    return new Date(Date.now() - PRODUS_NOU_T_MS);
}

function esteProdusNou(dataLansare) {
    const d = parseazaDataCalendaristica(dataLansare);
    if (!d) return false;
    const prag = pragProdusNouDate();
    prag.setHours(0, 0, 0, 0);
    const data = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return data.getTime() >= prag.getTime();
}

async function obtineProduseNoiPentruIndex(limita = LIMITA_PRODUSE_NOI_INDEX) {
    const pragIso = dataIsoPentruTime(pragProdusNouDate());
    if (!pragIso) return [];

    const rezultat = await db.query(
        `SELECT id, nume, imagine, pret, categorie, subcategorie, data_lansare
         FROM parfumuri
         WHERE data_lansare IS NOT NULL AND data_lansare::date >= $1::date
         ORDER BY data_lansare DESC, id DESC
         LIMIT $2`,
        [pragIso, limita]
    );
    return rezultat.rows;
}

function clasaDinCategorie(categorie) {
    return String(categorie || '')
        .trim()
        .replace(/\s+/g, '_');
}

function escapeAttr(valoare) {
    return String(valoare ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
}

// Etichete implicite pentru coloane (fallback dacă nu există comentariu în DB)
const ETICHETE_COLOANA_FILTRE = {
    descriere: 'Descriere',
    pret: 'Preț',
    subcategorie: 'Familie olfactivă',
    concentratie: 'Concentrație',
    note_parfum: 'Note olfactive',
    nume: 'Nume produs',
    categorie: 'Categorie (public țintă)',
    data_lansare: 'Data lansării în catalog',
    volum_ml: 'Volum (ml)'
};

function etichetaDinColoana(numeColoana, comentariuDb) {
    if (comentariuDb && String(comentariuDb).trim()) return String(comentariuDb).trim();
    if (ETICHETE_COLOANA_FILTRE[numeColoana]) return ETICHETE_COLOANA_FILTRE[numeColoana];
    return numeColoana.replace(/_/g, ' ');
}

function extrageNoteUniceDinRanduri(randuri) {
    const note = new Set();
    for (const r of randuri) {
        if (!r.note_parfum) continue;
        for (const nota of String(r.note_parfum).split(',')) {
            const n = nota.trim().toLowerCase();
            if (n) note.add(n);
        }
    }
    return [...note].sort((a, b) => a.localeCompare(b, 'ro'));
}

// Bonus: atribute + etichete generate din tabelul parfumuri (agregări SQL + metadate)
async function construiesteOptiuniFiltreDinDb(categorieFiltru = 'toate') {
    const params = [];
    let whereSql = '';
    if (categorieFiltru !== 'toate') {
        whereSql = ' WHERE categorie::text = $1';
        params.push(categorieFiltru);
    }

    const sqlWhereNotNull = (coloana) =>
        `${whereSql}${whereSql ? ' AND' : ' WHERE'} ${coloana} IS NOT NULL`;

    const [rezAgg, rezSub, rezConc, rezNume, rezNote, rezColoane] = await Promise.all([
        db.query(
            `SELECT
                MIN(pret::numeric) AS pret_min,
                MAX(pret::numeric) AS pret_max,
                MAX(data_lansare::date) AS data_max
             FROM parfumuri${whereSql}`,
            params
        ),
        db.query(
            `SELECT DISTINCT LOWER(TRIM(subcategorie::text)) AS val
             FROM parfumuri${sqlWhereNotNull('subcategorie')}
             ORDER BY val`,
            params
        ),
        db.query(
            `SELECT DISTINCT concentratie AS val FROM parfumuri${sqlWhereNotNull('concentratie')} ORDER BY val`,
            params
        ),
        db.query(
            `SELECT DISTINCT nume AS val FROM parfumuri${sqlWhereNotNull('nume')} ORDER BY val`,
            params
        ),
        db.query(`SELECT note_parfum FROM parfumuri${sqlWhereNotNull('note_parfum')}`, params),
        db.query(
            `SELECT column_name,
                    col_description('public.parfumuri'::regclass, ordinal_position) AS comentariu
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'parfumuri'
             ORDER BY ordinal_position`
        )
    ]);

    const agg = rezAgg.rows[0] || {};
    let pretMin = parseFloat(agg.pret_min);
    let pretMax = parseFloat(agg.pret_max);
    if (Number.isNaN(pretMin)) pretMin = 0;
    if (Number.isNaN(pretMax)) pretMax = 1000;

    let pragNoutati = null;
    if (agg.data_max) {
        pragNoutati = parseazaDataCalendaristica(agg.data_max);
        if (pragNoutati) pragNoutati.setFullYear(pragNoutati.getFullYear() - 1);
    }

    const etichete = {};
    for (const col of rezColoane.rows) {
        etichete[col.column_name] = etichetaDinColoana(col.column_name, col.comentariu);
    }

    return {
        pret_min: Math.floor(pretMin),
        pret_max: Math.ceil(pretMax),
        subcategorii: rezSub.rows.map((r) => r.val),
        concentratii: rezConc.rows.map((r) => r.val),
        nume_parfumuri: rezNume.rows.map((r) => r.val),
        note_olfactive: extrageNoteUniceDinRanduri(rezNote.rows),
        prag_noutati_iso: pragNoutati ? dataIsoPentruTime(pragNoutati) : '',
        prag_noutati_ro: pragNoutati ? formataDataRo(pragNoutati) : '',
        etichete
    };
}

function citesteOrarJson() {
    const cale = path.join(__dirname, 'orar.json');
    try {
        if (!fs.existsSync(cale)) return { auto_ascundere_sec: 20, program: [] };
        const data = JSON.parse(fs.readFileSync(cale, 'utf8'));
        if (!data || !Array.isArray(data.program)) return { auto_ascundere_sec: 20, program: [] };
        return data;
    } catch (err) {
        console.error('orar.json invalid:', err.message);
        return { auto_ascundere_sec: 20, program: [] };
    }
}

async function incarcaCategoriiMeniu(req, res, next) {
    try {
        const rezEnum = await db.query(`
            SELECT e.enumlabel AS valoare
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = (
                SELECT udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'parfumuri'
                  AND column_name = 'categorie'
                LIMIT 1
            )
            ORDER BY e.enumsortorder
        `);
        let categorii = rezEnum.rows.map((r) => r.valoare);
        if (categorii.length === 0) {
            const rezDistinct = await db.query(
                'SELECT DISTINCT categorie::text AS valoare FROM parfumuri ORDER BY valoare'
            );
            categorii = rezDistinct.rows.map((r) => r.valoare);
        }
        res.locals.categorii_produse = categorii;
    } catch (err) {
        console.error('Nu am putut încărca categoriile pentru meniu:', err.message);
        res.locals.categorii_produse = [];
    }
    res.locals.formataDataRo = formataDataRo;
    res.locals.dataIsoPentruTime = dataIsoPentruTime;
    res.locals.clasaDinCategorie = clasaDinCategorie;
    res.locals.escapeAttr = escapeAttr;
    res.locals.esteProdusNou = esteProdusNou;
    res.locals.prag_produs_nou_iso = dataIsoPentruTime(pragProdusNouDate());
    res.locals.orar = citesteOrarJson();
    next();
}

app.use(incarcaCategoriiMeniu);

// ==========================================
// Bonus 12 — sistem oferte (oferte.json, interval T, curățare T2)
// ==========================================
const FISIER_OFERTE = path.join(__dirname, 'oferte.json');
const OFERTA_INTERVAL_T_MS = 2 * 60 * 1000;
const OFERTA_INTERVAL_T2_MS = 10 * 60 * 1000;
const REDUCERI_OFERTA = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

let ultimaCategorieOferta = null;
let timerGenerareLaExpirare = null;
let generareOfertaInCurs = false;

function citesteOferteJson() {
    if (!fs.existsSync(FISIER_OFERTE)) {
        return { oferte: [] };
    }
    try {
        const data = JSON.parse(fs.readFileSync(FISIER_OFERTE, 'utf8'));
        if (!data || !Array.isArray(data.oferte)) return { oferte: [] };
        return data;
    } catch (err) {
        console.error('oferte.json invalid:', err.message);
        return { oferte: [] };
    }
}

function salveazaOferteJson(data) {
    fs.writeFileSync(FISIER_OFERTE, JSON.stringify(data, null, 2), 'utf8');
}

function ofertaEsteActiva(oferta, acum = Date.now()) {
    const start = new Date(oferta['data-incepere']).getTime();
    const end = new Date(oferta['data-finalizare']).getTime();
    return acum >= start && acum < end;
}

function curataOferteExpirateVechi(oferte) {
    const limita = Date.now() - OFERTA_INTERVAL_T2_MS;
    return oferte.filter((o) => new Date(o['data-finalizare']).getTime() >= limita);
}

function obtineOfertaActiva() {
    const data = citesteOferteJson();
    if (!data.oferte.length) return null;
    const prima = data.oferte[0];
    return ofertaEsteActiva(prima) ? prima : null;
}

function calculeazaPretCuReducere(pret, reducere) {
    const vechi = Number(pret);
    if (Number.isNaN(vechi)) return null;
    const nou = Math.round(vechi * (1 - reducere / 100) * 100) / 100;
    return { vechi, nou, reducere };
}

async function obtineCategoriiPentruOferte() {
    try {
        const rezEnum = await db.query(`
            SELECT e.enumlabel AS valoare
            FROM pg_type t
            JOIN pg_enum e ON e.enumtypid = t.oid
            WHERE t.typname = (
                SELECT udt_name FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'parfumuri' AND column_name = 'categorie'
                LIMIT 1
            )
            ORDER BY e.enumsortorder
        `);
        let categorii = rezEnum.rows.map((r) => r.valoare);
        if (categorii.length === 0) {
            const rez = await db.query('SELECT DISTINCT categorie::text AS valoare FROM parfumuri ORDER BY valoare');
            categorii = rez.rows.map((r) => r.valoare);
        }
        return categorii;
    } catch (err) {
        console.error('Categorii oferte:', err.message);
        return [];
    }
}

async function genereazaOfertaNoua() {
    if (generareOfertaInCurs) return null;
    generareOfertaInCurs = true;

    try {
        const categorii = await obtineCategoriiPentruOferte();
        if (!categorii.length) return null;

        let disponibile = categorii.filter((c) => c !== ultimaCategorieOferta);
        if (!disponibile.length) disponibile = [...categorii];

        const categorie = disponibile[Math.floor(Math.random() * disponibile.length)];
        const reducere = REDUCERI_OFERTA[Math.floor(Math.random() * REDUCERI_OFERTA.length)];
        const acum = new Date();
        const final = new Date(acum.getTime() + OFERTA_INTERVAL_T_MS);

        const oferta = {
            categorie,
            'data-incepere': acum.toISOString(),
            'data-finalizare': final.toISOString(),
            reducere
        };

        const data = citesteOferteJson();
        data.oferte.unshift(oferta);
        data.oferte = curataOferteExpirateVechi(data.oferte);
        salveazaOferteJson(data);

        ultimaCategorieOferta = categorie;
        programeazaGenerareLaExpirare(oferta);
        logDetalii(`Ofertă nouă: ${categorie} -${reducere}% până la ${final.toISOString()}`);
        return oferta;
    } finally {
        generareOfertaInCurs = false;
    }
}

function programeazaGenerareLaExpirare(oferta) {
    if (timerGenerareLaExpirare) clearTimeout(timerGenerareLaExpirare);
    const intarziere = new Date(oferta['data-finalizare']).getTime() - Date.now();
    if (intarziere <= 0) return;
    timerGenerareLaExpirare = setTimeout(() => {
        genereazaOfertaNoua().catch((err) => console.error('Generare ofertă la expirare:', err.message));
    }, intarziere);
}

async function initSistemOferte() {
    if (!obtineOfertaActiva()) {
        await genereazaOfertaNoua();
    } else {
        const data = citesteOferteJson();
        if (data.oferte[0]) {
            ultimaCategorieOferta = data.oferte[0].categorie;
            programeazaGenerareLaExpirare(data.oferte[0]);
        }
    }
}

function middlewareOfertaCurenta(req, res, next) {
    const oferta = obtineOfertaActiva();
    res.locals.oferta_curenta = oferta;
    res.locals.pretCuOferta = (pret, categorie) => {
        if (!oferta) return null;
        if (String(categorie).toLowerCase() !== String(oferta.categorie).toLowerCase()) return null;
        return calculeazaPretCuReducere(pret, oferta.reducere);
    };
    next();
}

app.use(middlewareOfertaCurenta);

initSistemOferte().catch((err) => console.error('Init oferte:', err.message));

// ==========================================
// RUTE ȘI SECURITATE
// ==========================================
// Cetinta 19: Favicon - etapa 4
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'resurse', 'ico', 'favicon.ico'));
});

// Cerința 18: Blocare .ejs  -etapa 4
app.use((req, res, next) => {
    if (req.url.includes('.ejs')) return afisareEroare(res, 400);
    next();
});

// Cerința 17: Blocare explorare directoare - etapa 4
app.get(/^\/resurse(\/.*)*\/$/, (req, res) => {
    afisareEroare(res, 403);
});

//cerinta 6 - etapa 4
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// Etapa 5 — Bonus 9) Bootstrap JS pentru carusel pe pagina produsului
app.use('/vendor/bootstrap', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist')));

// Bonus 12 — ofertă activă (pentru temporizator client)
app.get('/api/oferta-curenta', (req, res) => {
    res.json({
        ok: true,
        oferta: obtineOfertaActiva(),
        serverTime: new Date().toISOString()
    });
});

//cerinta 8 — pagina principală (galerie statică + galerie animată)
app.get(['/', '/index', '/home'], async (req, res) => {
    try {
        const imaginiGalerie = await prelucreazaGalerie();
        const { imagini_animata: imaginiAnimate } = await prelucreazaGalerieAnimata();
        const produse_noi = await obtineProduseNoiPentruIndex();

        res.render(path.join('pagini', 'index'), {
            ip_utilizator: req.ip,
            imagini: imaginiGalerie,
            imagini_animata: imaginiAnimate,
            oferta_curenta: res.locals.oferta_curenta,
            produse_noi
        });
    } catch (err) {
        console.error('Eroare galerie (index):', err);
        afisareEroare(res, 500);
    }
});

// Galerie statică — pagină separată - etapa 5
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

// Galerie dinamică (animată) — pagină separată-etapa 5
app.get('/dinamica', async (req, res) => {
    try {
        const { imagini_animata: imaginiAnimate, nr_imagini: nrImagini } =
            await prelucreazaGalerieAnimata();

        res.render(path.join('pagini', 'dinamica'), {
            imagini_animata: imaginiAnimate,
            nr_imagini: nrImagini
        });
    } catch (err) {
        console.error('Eroare galerie (dinamica):', err);
        afisareEroare(res, 500);
    }
});

// Etapa 5 — Bonus 10a/10b: filtrare + sortare produse pe server (formular / fetch)
const COLOANE_SORT_PRODUSE = {
    nume: 'nume',
    pret: 'pret::numeric',
    volum_ml: 'volum_ml::numeric',
    data_lansare: 'data_lansare',
    categorie: 'categorie::text',
    subcategorie: 'subcategorie::text',
    concentratie: 'concentratie',
    id: 'id'
};

const OPTIUNI_SORTARE_PRODUSE = [
    { cheie: 'nume', eticheta: 'Nume' },
    { cheie: 'pret', eticheta: 'Preț' },
    { cheie: 'volum_ml', eticheta: 'Volum (ml)' },
    { cheie: 'data_lansare', eticheta: 'Data lansării' },
    { cheie: 'categorie', eticheta: 'Categorie' },
    { cheie: 'subcategorie', eticheta: 'Subcategorie' },
    { cheie: 'concentratie', eticheta: 'Concentrație' },
    { cheie: 'id', eticheta: 'ID' }
];

function faraDiacriticeText(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ș/g, 's')
        .replace(/ş/g, 's')
        .replace(/ț/g, 't')
        .replace(/ţ/g, 't');
}

function coloanaFaraDiacriticeSql(numeColoana) {
    return `translate(lower(${numeColoana}::text), 'ăâîșşțţ', 'aaisstt')`;
}

function citesteFiltreServerDinQuery(query) {
    let note = query.note;
    if (note === undefined || note === null || note === '') {
        note = [];
    } else if (!Array.isArray(note)) {
        note = [note];
    }

    const pretRaw = query.pret_max;
    let pretMax = null;
    if (pretRaw !== undefined && pretRaw !== '') {
        const n = Number(pretRaw);
        if (!Number.isNaN(n)) pretMax = n;
    }

    const sort1 = String(query.sort1 || 'nume');
    const sort2 = String(query.sort2 || '').trim();
    const dir1 = String(query.dir1 || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
    const dir2 = String(query.dir2 || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';

    return {
        srv: query.srv === '1',
        descriere: String(query.descriere || '').trim(),
        subcategorie: String(query.subcategorie || '').trim(),
        pret_max: pretMax,
        concentratie: String(query.concentratie || '').trim(),
        note: note.map((n) => String(n).trim()).filter(Boolean),
        nume: String(query.nume || '').trim(),
        categorie: String(query.categorie || '').trim(),
        noutati: query.noutati === '1' || query.noutati === 'on',
        sort1: COLOANE_SORT_PRODUSE[sort1] ? sort1 : 'nume',
        dir1,
        sort2: COLOANE_SORT_PRODUSE[sort2] ? sort2 : '',
        dir2
    };
}

function construiesteSqlProduseServer(filtre, optiuni) {
    const conditii = [];
    const params = [];
    let p = 1;

    if (filtre.categorie) {
        conditii.push(`categorie::text = $${p++}`);
        params.push(filtre.categorie);
    }

    if (filtre.descriere) {
        conditii.push(`${coloanaFaraDiacriticeSql('descriere')} LIKE $${p++}`);
        params.push(`%${faraDiacriticeText(filtre.descriere)}%`);
    }

    if (filtre.subcategorie) {
        conditii.push(`${coloanaFaraDiacriticeSql('subcategorie')} = $${p++}`);
        params.push(faraDiacriticeText(filtre.subcategorie));
    }

    if (filtre.pret_max !== null) {
        conditii.push(`pret::numeric <= $${p++}`);
        params.push(filtre.pret_max);
    }

    if (filtre.concentratie) {
        conditii.push(`concentratie = $${p++}`);
        params.push(filtre.concentratie);
    }

    if (filtre.nume) {
        conditii.push(`${coloanaFaraDiacriticeSql('nume')} LIKE $${p++}`);
        params.push(`${faraDiacriticeText(filtre.nume)}%`);
    }

    if (filtre.note.length) {
        const parti = [];
        for (const nota of filtre.note) {
            parti.push(`LOWER(note_parfum::text) LIKE $${p++}`);
            params.push(`%${faraDiacriticeText(nota)}%`);
        }
        conditii.push(`(${parti.join(' OR ')})`);
    }

    if (filtre.noutati && optiuni.prag_noutati_iso) {
        conditii.push(`data_lansare::date >= $${p++}::date`);
        params.push(optiuni.prag_noutati_iso);
    }

    let sql = 'SELECT * FROM parfumuri';
    if (conditii.length) sql += ` WHERE ${conditii.join(' AND ')}`;

    const ordine = [];
    const adaugaSort = (cheie, directie) => {
        if (!cheie || !COLOANE_SORT_PRODUSE[cheie]) return;
        const dir = directie === 'desc' ? 'DESC' : 'ASC';
        ordine.push(`${COLOANE_SORT_PRODUSE[cheie]} ${dir} NULLS LAST`);
    };

    adaugaSort(filtre.sort1, filtre.dir1);
    if (filtre.sort2 && filtre.sort2 !== filtre.sort1) {
        adaugaSort(filtre.sort2, filtre.dir2);
    }
    if (!ordine.length) ordine.push('id ASC');
    sql += ` ORDER BY ${ordine.join(', ')}`;

    return { sql, params };
}

const K_PAGINARE_PRODUSE = 4;

// Bonus 14 — cel mai ieftin produs per categorie (din lista afișată)
function calculeazaIduriCelMaiIeftinPerCategorie(parfumuri) {
    const minimPerCategorie = new Map();

    for (const p of parfumuri) {
        const categorie = String(p.categorie || '').toLowerCase();
        const pret = Number(p.pret);
        if (!categorie || Number.isNaN(pret)) continue;

        const existent = minimPerCategorie.get(categorie);
        if (!existent || pret < existent.pret) {
            minimPerCategorie.set(categorie, { pret, ids: [p.id] });
        } else if (pret === existent.pret) {
            existent.ids.push(p.id);
        }
    }

    const ids = [];
    for (const { ids: idList } of minimPerCategorie.values()) {
        ids.push(...idList);
    }
    return ids;
}

// Produse — filtrare client (JS) + filtrare/sortare server (Bonus 10, ?srv=1)
app.get('/produse', async (req, res) => {
    try {
        const filtreServer = citesteFiltreServerDinQuery(req.query);
        const categorieFiltru = filtreServer.srv && filtreServer.categorie
            ? filtreServer.categorie
            : (() => {
                const q = (req.query.categorie || 'toate').toString().trim();
                return q.toLowerCase() === 'toate' ? 'toate' : q;
            })();

        const optiuni_filtre = await construiesteOptiuniFiltreDinDb(
            categorieFiltru === 'toate' ? 'toate' : categorieFiltru
        );

        let parfumuri;
        if (filtreServer.srv) {
            const { sql, params } = construiesteSqlProduseServer(filtreServer, optiuni_filtre);
            const rezultat = await db.query(sql, params);
            parfumuri = rezultat.rows;
        } else if (categorieFiltru === 'toate') {
            parfumuri = (await db.query('SELECT * FROM parfumuri ORDER BY id ASC')).rows;
        } else {
            parfumuri = (
                await db.query(
                    'SELECT * FROM parfumuri WHERE categorie::text = $1 ORDER BY id ASC',
                    [categorieFiltru]
                )
            ).rows;
        }

        const renderData = {
            parfumuri,
            categorie_filtru: categorieFiltru,
            optiuni_filtre,
            k_paginare: K_PAGINARE_PRODUSE,
            filtre_server: filtreServer,
            mod_server: filtreServer.srv,
            optiuni_sortare: OPTIUNI_SORTARE_PRODUSE,
            ids_cel_mai_ieftin: calculeazaIduriCelMaiIeftinPerCategorie(parfumuri)
        };

        if (req.query.format === 'partial') {
            return res.render('fragmente/catalog-produse-lista', renderData);
        }

        if (req.query.format === 'json') {
            return res.json({
                ok: true,
                total: parfumuri.length,
                parfumuri,
                filtre_server: filtreServer
            });
        }

        res.render(path.join('pagini', 'produse'), renderData);
    } catch (err) {
        console.error('Eroare la extragerea parfumurilor:', err.message);
        if (req.query.format === 'json') {
            return res.status(500).json({ ok: false, mesaj: err.message });
        }
        res.status(500).send('A apărut o eroare pe server când am încercat să încarc parfumurile.');
    }
});

// Etapa 5 — Bonus 9) imagini multiple: din folder_imagini (DB) sau din directorul imaginii principale
const EXTENSII_IMAGINI_PRODUS = /\.(jpe?g|png|webp|gif)$/i;

function normalizeazaCaleWebFolder(cale) {
    let folderWeb = String(cale || '').trim().replace(/\\/g, '/');
    if (!folderWeb) return '';
    if (!folderWeb.startsWith('/')) folderWeb = '/' + folderWeb;
    if (!folderWeb.endsWith('/')) folderWeb += '/';
    return folderWeb;
}

function folderAbsolutDinCaleWeb(caleWeb) {
    const segmente = caleWeb.split('/').filter(Boolean);
    return path.join(__dirname, ...segmente);
}

// Doar imaginea principală (Alien.jpg) + variante numerotate (Alien2, Alien3) — fără -mic, -mediu, -mare
function fisierApartineProdusului(numeFisier, prefix) {
    const stem = path.basename(numeFisier, path.extname(numeFisier));
    const p = prefix.toLowerCase();
    const s = stem.toLowerCase();
    if (s === p) return true;
    if (s.startsWith(p) && /^\d+$/.test(s.slice(p.length))) return true;
    return false;
}

function ordineImaginiProdus(a, b, numePrincipal, prefix) {
    if (a === numePrincipal) return -1;
    if (b === numePrincipal) return 1;

    const stemA = path.basename(a, path.extname(a)).toLowerCase();
    const stemB = path.basename(b, path.extname(b)).toLowerCase();
    const p = prefix.toLowerCase();
    const nrA = /^\d+$/.test(stemA.slice(p.length)) ? Number(stemA.slice(p.length)) : 0;
    const nrB = /^\d+$/.test(stemB.slice(p.length)) ? Number(stemB.slice(p.length)) : 0;
    if (nrA !== nrB) return nrA - nrB;
    return a.localeCompare(b, 'ro', { sensitivity: 'base' });
}

function obtineImaginiProdus(produs) {
    const imaginePrincipala = String(produs.imagine || '').trim();
    if (!imaginePrincipala) return [];

    let folderWeb = normalizeazaCaleWebFolder(produs.folder_imagini);
    if (!folderWeb) {
        folderWeb = normalizeazaCaleWebFolder(
            path.posix.dirname(imaginePrincipala.replace(/\\/g, '/'))
        );
    }

    const numePrincipal = path.basename(imaginePrincipala);
    const prefix = path.basename(numePrincipal, path.extname(numePrincipal));
    const folderAbs = folderAbsolutDinCaleWeb(folderWeb);

    let fisiere = [];
    try {
        if (fs.existsSync(folderAbs) && fs.statSync(folderAbs).isDirectory()) {
            fisiere = fs.readdirSync(folderAbs)
                .filter((f) => EXTENSII_IMAGINI_PRODUS.test(f) && !f.startsWith('.'))
                .filter((f) => fisierApartineProdusului(f, prefix))
                .sort((a, b) => ordineImaginiProdus(a, b, numePrincipal, prefix));
        }
    } catch (err) {
        console.error('Bonus 9 — citire folder imagini:', folderAbs, err.message);
    }

    if (fisiere.length === 0) return [imaginePrincipala];

    return fisiere.map((f) => folderWeb + f);
}

// Bonus 20 — comparare două produse
const CARACTERISTICI_COMPARARE = [
    { cheie: 'imagine', eticheta: 'Imagine', tip: 'imagine' },
    { cheie: 'nume', eticheta: 'Nume' },
    { cheie: 'categorie', eticheta: 'Categorie' },
    { cheie: 'subcategorie', eticheta: 'Familie olfactivă' },
    { cheie: 'pret', eticheta: 'Preț', tip: 'pret' },
    { cheie: 'volum_ml', eticheta: 'Volum (ml)' },
    { cheie: 'concentratie', eticheta: 'Concentrație' },
    { cheie: 'note_parfum', eticheta: 'Note olfactive' },
    { cheie: 'data_lansare', eticheta: 'Data lansării', tip: 'data' },
    { cheie: 'editie_limitata', eticheta: 'Ediție limitată', tip: 'boolean' },
    { cheie: 'descriere', eticheta: 'Descriere' }
];

function valoareCaracteristicaComparare(produs, spec) {
    const v = produs[spec.cheie];
    if (spec.tip === 'imagine') {
        const src = String(v || '').replace(/"/g, '&quot;').replace(/</g, '');
        return src ? `<img src="${src}" alt="" class="comparare-img" width="120" height="120">` : '—';
    }
    if (spec.tip === 'pret') return `${Number(v).toFixed(2)} RON`;
    if (spec.tip === 'data') return formataDataRo(v) || '—';
    if (spec.tip === 'boolean') return v ? 'Da' : 'Nu';
    if (spec.cheie === 'categorie' || spec.cheie === 'subcategorie') {
        return v ? `<span class="text-capitalize">${String(v)}</span>` : '—';
    }
    return v != null && v !== '' ? String(v) : '—';
}

async function handlerPaginaComparare(req, res) {
    try {
        const id1 = Number(req.query.p1);
        const id2 = Number(req.query.p2);
        if (!Number.isInteger(id1) || !Number.isInteger(id2) || id1 <= 0 || id2 <= 0 || id1 === id2) {
            return afisareEroare(res, 400, 'Comparare invalidă', 'Selectați două produse diferite (butonul „afișează”).');
        }

        const [rez1, rez2] = await Promise.all([
            db.query('SELECT * FROM parfumuri WHERE id = $1', [id1]),
            db.query('SELECT * FROM parfumuri WHERE id = $1', [id2])
        ]);

        if (!rez1.rows.length || !rez2.rows.length) {
            return afisareEroare(res, 404, 'Produs inexistent', 'Unul dintre produse nu a fost găsit.');
        }

        const produs1 = rez1.rows[0];
        const produs2 = rez2.rows[0];
        const randuri = CARACTERISTICI_COMPARARE.map((spec) => ({
            eticheta: spec.eticheta,
            valoare1: valoareCaracteristicaComparare(produs1, spec),
            valoare2: valoareCaracteristicaComparare(produs2, spec)
        }));

        res.render('pagini/comparare', {
            produs1,
            produs2,
            randuri
        }, (err, html) => {
            if (err) {
                console.error('Comparare render:', err.message);
                return afisareEroare(res, 500);
            }
            res.send(html);
        });
    } catch (err) {
        console.error('Comparare produse:', err.message);
        afisareEroare(res, 500);
    }
}

app.get('/comparare', handlerPaginaComparare);

// Pagină produs unic - detalii complete
app.get('/produs/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return afisareEroare(res, 400, 'Id invalid', 'Identificatorul produsului este invalid.');
        }

        const rezultat = await db.query('SELECT * FROM parfumuri WHERE id = $1', [id]);
        if (!rezultat.rows.length) {
            if (req.query.format === 'json') {
                return res.status(404).json({ ok: false, mesaj: 'Produsul cerut nu există.' });
            }
            return afisareEroare(res, 404, 'Produs inexistent', 'Produsul cerut nu există.');
        }

        const produs = rezultat.rows[0];
        const imagini_produs = obtineImaginiProdus(produs);
        if (req.query.format === 'json') {
            return res.json({
                ok: true,
                produs,
                imagini_produs,
                data_lansare_iso: dataIsoPentruTime(produs.data_lansare),
                data_lansare_ro: formataDataRo(produs.data_lansare)
            });
        }

        res.render('pagini/produs', {
            produs,
            imagini_produs,
            este_produs_nou: esteProdusNou(produs.data_lansare)
        });
    } catch (err) {
        console.error('Eroare la extragerea produsului:', err.message);
        if (req.query.format === 'json') {
            return res.status(500).json({ ok: false, mesaj: err.message });
        }
        afisareEroare(res, 500);
    }
});

//cerinta 9 - etapa 4
//cautam pagina in folderul pagini si o randam daca exista, daca nu, afisam eroarea 404
app.get('/*cale', (req, res) => {
    if (/\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|map|woff2?|ttf|eot)$/i.test(req.path)) {
        return afisareEroare(res, 404);
    }
    const caleRelativa = req.path.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!caleRelativa || caleRelativa.includes('..')) {
        return afisareEroare(res, 404);
    }
    if (caleRelativa === 'comparare') {
        return handlerPaginaComparare(req, res);
    }
    const numePagina = `pagini/${caleRelativa}`;
    res.render(numePagina, {
        ip_utilizator: req.ip,
        imagini_animata: []
    }, function(err, rezultatRandare) {
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
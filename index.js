const express = require('express');
const fs = require('fs');
const path = require('path'); 
const app = express();
const PORT = 8080;

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
let obGlobal = { obErori: null };

function initErori() {
    valideazaErori(); // <--- APELĂM VALIDAREA AICI (Important pentru Bonus!)
    
    let continut = fs.readFileSync(path.join(__dirname, 'erori.json'), 'utf8');
    obGlobal.obErori = JSON.parse(continut);
    
    let cale_baza = obGlobal.obErori.cale_baza;
    obGlobal.obErori.eroare_default.imagine = path.join(cale_baza, obGlobal.obErori.eroare_default.imagine);
    
    for (let eroare of obGlobal.obErori.info_erori) {
        eroare.imagine = path.join(cale_baza, eroare.imagine);
    }
}
initErori();

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

app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

app.get(['/', '/index', '/home'], (req, res) => {
    res.render(path.join('pagini', 'index'), { ip_utilizator: req.ip });
});

app.get('/*cale', (req, res) => {
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
// Etapa 5 — filtre produse (cerințe 6–7) + Bonus 4 (onchange) + Bonus 5 (paginare)

(function () {
    const sectiune = document.getElementById('filtre-produse');
    const lista = document.getElementById('lista-produse');
    const info = document.getElementById('filtre-rezultat-info');
    const mesajFaraRezultat = document.getElementById('produse-fara-rezultat-filtru');
    const navPaginare = document.getElementById('paginare-produse');
    if (!sectiune || !lista) return;

    function esteModServer() {
        return lista.dataset.modServer === '1';
    }

    // Etapa 5 — Bonus 5) K = elemente pe pagină; P = pagina curentă; indici produse de la 0
    const K = Math.max(
        1,
        Number(lista.dataset.k || navPaginare?.dataset.k) || 4
    );
    let paginaCurenta = 1;

    const pretMin = Number(sectiune.dataset.pretMin) || 0;
    const pretMax = Number(sectiune.dataset.pretMax) || 1000;
    const pragNoutati = sectiune.dataset.pragNoutati || '';

    const filtruDescriereText = document.getElementById('filtru-descriere-text');
    const filtruSubcategorieDatalist = document.getElementById('filtru-subcategorie-datalist');
    const filtruPretRange = document.getElementById('filtru-pret-range');
    const filtruConcentratie = document.getElementById('filtru-concentratie-select');
    const filtruNote = document.getElementById('filtru-note-select');
    const filtruNumeTextarea = document.getElementById('filtru-nume-textarea');
    const filtruNoutati = document.getElementById('filtru-noutati-checkbox');
    const btnReset = document.getElementById('filtre-reset');
    const btnFiltreaza = document.getElementById('filtreaza-produse');
    const btnSortAsc = document.getElementById('sort-asc');
    const btnSortDesc = document.getElementById('sort-desc');
    const btnCalculeaza = document.getElementById('calculeaza-preturi');
    const spanValoareRange = sectiune.querySelector('.filtru-range__selectat');

    const articole = () => Array.from(lista.querySelectorAll('.articol-produs'));

    const SESSION_KEY_ELIMINATE = 'mab-produse-eliminate-sesiune';
    const tempAscunsIds = new Set();

    function idProdus(art) {
        return String(art.dataset.id || '');
    }

    function citesteEliminateSesiune() {
        try {
            const raw = sessionStorage.getItem(SESSION_KEY_ELIMINATE);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.map(String) : [];
        } catch {
            return [];
        }
    }

    function salveazaEliminateSesiune() {
        const ids = articole()
            .filter((art) => art.classList.contains('eliminat-sesiune'))
            .map(idProdus);
        sessionStorage.setItem(SESSION_KEY_ELIMINATE, JSON.stringify(ids));
    }

    function esteEliminatSesiune(art) {
        return art.classList.contains('eliminat-sesiune');
    }

    function esteFixat(art) {
        return art.classList.contains('produs-fixat');
    }

    function esteAscunsTemporar(art) {
        return tempAscunsIds.has(idProdus(art));
    }

    function treceToateFiltrele(art) {
        return (
            treceFiltruDescriere(art) &&
            treceFiltruSubcategorie(art) &&
            treceFiltruPret(art) &&
            treceFiltruConcentratie(art) &&
            treceFiltruNote(art) &&
            treceFiltruNumePrefix(art) &&
            treceFiltruCategorie(art) &&
            treceFiltruNoutati(art)
        );
    }

    function golesteAscunsTemporar() {
        tempAscunsIds.clear();
        articole().forEach((art) => art.classList.remove('ascuns-temporar'));
    }

    function initEliminateDinSessionStorage() {
        const ids = new Set(citesteEliminateSesiune());
        articole().forEach((art) => {
            if (ids.has(idProdus(art))) {
                art.classList.add('eliminat-sesiune');
            }
        });
    }

    function actualizeazaStareButonFixare(art) {
        const btn = art.querySelector('.btn-produs-fixeaza');
        const icon = btn && btn.querySelector('i');
        if (!btn) return;
        const fixat = esteFixat(art);
        btn.classList.toggle('activ', fixat);
        btn.setAttribute('aria-pressed', fixat ? 'true' : 'false');
        if (icon) {
            icon.classList.toggle('bi-pin-angle-fill', fixat);
            icon.classList.toggle('bi-pin-angle', !fixat);
        }
    }

    // Comparare text fără sensibilitate la diacritice (ex: „briose” găsește „brioșe”)
    function faraDiacritice(text) {
        return String(text)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ș/g, 's')
            .replace(/ş/g, 's')
            .replace(/ț/g, 't')
            .replace(/ţ/g, 't');
    }

    function normalizeaza(text) {
        return faraDiacritice(String(text || '').trim().toLowerCase());
    }

    function citesteRadioCategorie() {
        const bifat = sectiune.querySelector('input[name="filtru-categorie-radio"]:checked');
        return bifat ? normalizeaza(bifat.value) : '';
    }

    function citesteNoteSelectate() {
        return Array.from(filtruNote.selectedOptions).map((opt) => normalizeaza(opt.value));
    }

    function treceFiltruDescriere(art) {
        const q = normalizeaza(filtruDescriereText.value);
        if (!q) return true;
        return normalizeaza(art.dataset.descriere).includes(q);
    }

    function treceFiltruSubcategorie(art) {
        const q = normalizeaza(filtruSubcategorieDatalist.value);
        if (!q) return true;
        return normalizeaza(art.dataset.subcategorie) === q;
    }

    function treceFiltruPret(art) {
        const maxim = Number(filtruPretRange.value);
        const pret = parseFloat(art.dataset.pret);
        if (Number.isNaN(pret)) return true;
        return pret >= pretMin && pret <= maxim;
    }

    function treceFiltruConcentratie(art) {
        const val = filtruConcentratie.value;
        if (!val) return true;
        return art.dataset.concentratie === val;
    }

    function treceFiltruNote(art) {
        const selectate = citesteNoteSelectate();
        if (selectate.length === 0) return true;
        const noteProdus = normalizeaza(art.dataset.note)
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean);
        return selectate.some((n) => noteProdus.includes(n));
    }

    function treceFiltruNumePrefix(art) {
        const q = normalizeaza(filtruNumeTextarea.value);
        if (!q) return true;
        return normalizeaza(art.dataset.nume).startsWith(q);
    }

    function treceFiltruCategorie(art) {
        const cat = citesteRadioCategorie();
        if (!cat) return true;
        return normalizeaza(art.dataset.categorie) === cat;
    }

    function treceFiltruNoutati(art) {
        if (!filtruNoutati || !filtruNoutati.checked || !pragNoutati) return true;
        const dataProdus = art.dataset.dataLansare || '';
        return dataProdus >= pragNoutati;
    }

    function articoleVizibileDupaFiltru() {
        return articole().filter((art) => !art.classList.contains('ascuns'));
    }

    // Etapa 5 — Bonus 5) NRL = ⌈N/K⌉; pagina P afișează produsele cu indici (P-1)*K … P*K-1
    function aplicarePaginare() {
        const vizibile = articoleVizibileDupaFiltru();
        const N = vizibile.length;
        const NRL = N > 0 ? Math.ceil(N / K) : 0;

        if (NRL === 0) {
            paginaCurenta = 1;
        } else if (paginaCurenta > NRL) {
            paginaCurenta = NRL;
        } else if (paginaCurenta < 1) {
            paginaCurenta = 1;
        }

        const idxStart = (paginaCurenta - 1) * K;
        const idxEnd = paginaCurenta * K - 1;

        articole().forEach((art) => art.classList.remove('pagina-ascuns'));

        vizibile.forEach((art, i) => {
            const pePagina = i >= idxStart && i <= idxEnd;
            if (!pePagina) art.classList.add('pagina-ascuns');
        });

        if (navPaginare) {
            navPaginare.innerHTML = '';
            navPaginare.hidden = NRL <= 1;

            for (let p = 1; p <= NRL; p++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn btn-sm btn-outline-primary paginare-produse__btn';
                if (p === paginaCurenta) btn.classList.add('active');
                btn.textContent = String(p);
                btn.setAttribute('aria-label', `Pagina ${p}`);
                btn.setAttribute('aria-current', p === paginaCurenta ? 'page' : 'false');
                btn.addEventListener('click', () => {
                    paginaCurenta = p;
                    aplicarePaginare();
                    lista.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
                navPaginare.appendChild(btn);
            }
        }

        return { N, NRL, pePagina: vizibile.filter((_, i) => i >= idxStart && i <= idxEnd).length };
    }

    function aplicaFiltre(resetPagina = true, golesteTemp = false) {
        if (esteModServer()) {
            if (resetPagina) paginaCurenta = 1;
            aplicarePaginare();
            return;
        }

        if (golesteTemp || resetPagina) {
            golesteAscunsTemporar();
        }

        const toate = articole();
        let vizibile = 0;

        for (const art of toate) {
            art.classList.remove('pagina-ascuns');

            if (esteEliminatSesiune(art)) {
                art.classList.add('ascuns');
                continue;
            }

            if (esteAscunsTemporar(art)) {
                art.classList.add('ascuns');
                continue;
            }

            const okFiltru = treceToateFiltrele(art);
            const vizibil = okFiltru || esteFixat(art);
            art.classList.toggle('ascuns', !vizibil);
            if (vizibil) vizibile++;
        }

        if (resetPagina) paginaCurenta = 1;

        const pag = aplicarePaginare();

        if (info) {
            if (toate.length === 0) {
                info.textContent = '';
            } else if (vizibile === 0) {
                info.textContent = '0 produse după filtre.';
            } else if (pag.NRL <= 1) {
                info.textContent =
                    `${vizibile} produse după filtre (K=${K}, o singură pagină).`;
            } else {
                info.textContent =
                    `Pagina ${paginaCurenta}/${pag.NRL}: ${pag.pePagina} produse pe pagină ` +
                    `(indici ${(paginaCurenta - 1) * K}–${Math.min(paginaCurenta * K - 1, vizibile - 1)}; ` +
                    `${vizibile} după filtre din ${toate.length}).`;
            }
        }

        if (mesajFaraRezultat) {
            const ramaseInDom = toate.some((art) => !esteEliminatSesiune(art));
            mesajFaraRezultat.classList.toggle('ascuns', !(ramaseInDom && vizibile === 0));
        }
    }

    function handlerActiuniProdus(ev) {
        const btn = ev.target.closest('.btn-produs-actiune');
        if (!btn) return;

        ev.stopPropagation();
        ev.preventDefault();

        const art = btn.closest('.articol-produs');
        if (!art || esteEliminatSesiune(art)) return;

        if (btn.classList.contains('btn-produs-fixeaza')) {
            art.classList.toggle('produs-fixat');
            actualizeazaStareButonFixare(art);
            aplicaFiltre(false, false);
            return;
        }

        if (btn.classList.contains('btn-produs-ascunde-temp')) {
            tempAscunsIds.add(idProdus(art));
            art.classList.add('ascuns-temporar');
            aplicaFiltre(false, false);
            return;
        }

        if (btn.classList.contains('btn-produs-elimina-sesiune')) {
            art.classList.remove('produs-fixat');
            art.classList.add('eliminat-sesiune');
            tempAscunsIds.delete(idProdus(art));
            salveazaEliminateSesiune();
            aplicaFiltre(false, false);
        }
    }

    function actualizeazaAfisajRange() {
        if (spanValoareRange) spanValoareRange.textContent = `(${filtruPretRange.value})`;
    }

    function stergeInvalid() {
        [filtruNumeTextarea, filtruDescriereText, filtruSubcategorieDatalist].forEach((el) => {
            if (el) el.classList.remove('is-invalid');
        });
    }

    function numeTextareaValid() {
        const val = filtruNumeTextarea.value.trim();
        return !val || !/[0-9]/.test(val);
    }

    function valideazaInputs(optiuni = {}) {
        const silent = Boolean(optiuni.silent);
        stergeInvalid();

        const valNume = filtruNumeTextarea.value.trim();
        if (valNume && /[0-9]/.test(valNume)) {
            filtruNumeTextarea.classList.add('is-invalid');
            return { ok: false, mesaj: '„Numele produsului” nu poate conține cifre.' };
        }

        const valDescriere = filtruDescriereText.value.trim();
        if (valDescriere && /[0-9]/.test(valDescriere)) {
            filtruDescriereText.classList.add('is-invalid');
            return { ok: false, mesaj: '„Cuvântul cheie în descriere” nu poate conține cifre.' };
        }

        const valSubcat = filtruSubcategorieDatalist.value.trim();
        if (valSubcat) {
            const subNorm = normalizeaza(valSubcat);
            const dl = filtruSubcategorieDatalist.list;
            const optiuniDl = dl && dl.options ? Array.from(dl.options).map((o) => normalizeaza(o.value)) : [];
            if (!optiuniDl.includes(subNorm)) {
                filtruSubcategorieDatalist.classList.add('is-invalid');
                return { ok: false, mesaj: '„Familie olfactivă” trebuie aleasă din listă (sau lasă necompletat).' };
            }
        }

        return { ok: true };
    }

    // Etapa 5 — Bonus 4) filtrare imediată (fără click pe „filtreaza”), după validare
    function filtreazaLaSchimbare() {
        if (esteModServer()) return;
        const rez = valideazaInputs({ silent: true });
        if (!rez.ok) return;
        aplicaFiltre(true);
    }

    function reseteazaFiltre(resetareDom = true) {
        if (!resetareDom) return;
        if (!window.confirm('Sigur resetezi toate filtrele?')) return;

        filtruDescriereText.value = '';
        filtruSubcategorieDatalist.value = '';
        filtruPretRange.value = String(pretMax);
        filtruConcentratie.selectedIndex = 0;
        Array.from(filtruNote.options).forEach((o) => {
            o.selected = false;
        });
        filtruNumeTextarea.value = '';
        filtruNumeTextarea.classList.remove('is-invalid');
        if (filtruNoutati) filtruNoutati.checked = false;

        const radioOricare = document.getElementById('filtru-categorie-oricare');
        if (radioOricare) radioOricare.checked = true;

        // Reordonăm DOM-ul în ordinea inițială (resetarea anulează și sortarea)
        articole()
            .sort((a, b) => {
                const ia = Number(a.dataset.originalIdx ?? '0');
                const ib = Number(b.dataset.originalIdx ?? '0');
                return ia - ib;
            })
            .forEach((el) => lista.appendChild(el));

        actualizeazaAfisajRange();
        aplicaFiltre(true);
    }

    function calcRaportCaracteristicaSecondaraPret(art) {
        const volum = parseFloat(art.dataset.volum);
        const pret = parseFloat(art.dataset.pret);
        if (!Number.isFinite(volum) || !Number.isFinite(pret) || pret === 0) return 0;
        return volum / pret;
    }

    function sorteazaProduse(directie /* 1 = asc, -1 = desc */) {
        const toate = articole();
        toate.sort((a, b) => {
            const numeA = String(a.dataset.nume || '');
            const numeB = String(b.dataset.nume || '');

            // c1: nume
            let cmp = numeA.localeCompare(numeB, 'ro', { sensitivity: 'base' });
            if (cmp !== 0) return cmp * directie;

            // c2: volum/preț
            const rA = calcRaportCaracteristicaSecondaraPret(a);
            const rB = calcRaportCaracteristicaSecondaraPret(b);
            cmp = rA - rB;
            if (cmp !== 0) return cmp * directie;

            // stabile (fallback) cu ordinea inițială
            const ia = Number(a.dataset.originalIdx ?? '0');
            const ib = Number(b.dataset.originalIdx ?? '0');
            return ia - ib;
        });

        toate.forEach((el) => lista.appendChild(el));
    }

    function showCalcRezultat(text) {
        const box = document.createElement('div');
        box.setAttribute('role', 'status');
        box.className = 'calc-rezultat';
        box.textContent = text;
        box.style.position = 'fixed';
        box.style.right = '18px';
        box.style.bottom = '18px';
        box.style.zIndex = '10000';
        box.style.padding = '12px 14px';
        box.style.background = 'rgba(0, 0, 0, 0.78)';
        box.style.color = 'white';
        box.style.borderRadius = '12px';
        box.style.boxShadow = '0 8px 24px rgba(0,0,0,0.25)';
        box.style.maxWidth = '520px';
        box.style.fontSize = '0.95rem';
        document.body.appendChild(box);

        setTimeout(() => box.remove(), 2000);
    }

    function calculeazaPreturiSelectate() {
        const vizibile = articoleVizibileDupaFiltru();
        const preturi = vizibile
            .map((a) => parseFloat(a.dataset.pret))
            .filter((x) => Number.isFinite(x));

        if (preturi.length === 0) {
            showCalcRezultat('Nu există produse selectate pentru calcul.');
            return;
        }

        const sum = preturi.reduce((acc, x) => acc + x, 0);
        const min = Math.min(...preturi);
        const max = Math.max(...preturi);
        const avg = sum / preturi.length;

        showCalcRezultat(
            `Calcul prețuri (produse afișate): min=${min.toFixed(2)}, max=${max.toFixed(2)}, ` +
            `sum=${sum.toFixed(2)}, medie=${avg.toFixed(2)}`
        );
    }

    function ruleazaCuValidare(dupaValidare) {
        const rez = valideazaInputs();
        if (!rez.ok) {
            if (window && window.alert) window.alert(rez.mesaj);
            return false;
        }
        if (typeof dupaValidare === 'function') dupaValidare();
        return true;
    }

    filtruNumeTextarea.addEventListener('input', () => {
        if (numeTextareaValid()) filtruNumeTextarea.classList.remove('is-invalid');
    });

    filtruDescriereText.addEventListener('input', () => {
        const val = filtruDescriereText.value.trim();
        if (!val || !/[0-9]/.test(val)) filtruDescriereText.classList.remove('is-invalid');
    });

    // Etapa 5 — Bonus 4) cele 8 filtre: eveniment la schimbarea valorii → filtrare automată
    // 1) text — descriere
    filtruDescriereText.addEventListener('input', filtreazaLaSchimbare);
    filtruDescriereText.addEventListener('change', filtreazaLaSchimbare);

    // 2) datalist — subcategorie / familie olfactivă
    filtruSubcategorieDatalist.addEventListener('input', filtreazaLaSchimbare);
    filtruSubcategorieDatalist.addEventListener('change', filtreazaLaSchimbare);

    // 3) range — preț maxim
    filtruPretRange.addEventListener('input', () => {
        actualizeazaAfisajRange();
        filtreazaLaSchimbare();
    });
    filtruPretRange.addEventListener('change', filtreazaLaSchimbare);

    // 4) select — concentrație
    filtruConcentratie.addEventListener('change', filtreazaLaSchimbare);

    // 5) select multiple — note olfactive
    filtruNote.addEventListener('change', filtreazaLaSchimbare);

    // 6) textarea — nume (începe cu)
    filtruNumeTextarea.addEventListener('input', filtreazaLaSchimbare);
    filtruNumeTextarea.addEventListener('change', filtreazaLaSchimbare);

    // 7) radio — categorie
    sectiune.querySelectorAll('input[name="filtru-categorie-radio"]').forEach((radio) => {
        radio.addEventListener('change', filtreazaLaSchimbare);
    });

    // 8) checkbox — noutăți
    if (filtruNoutati) {
        filtruNoutati.addEventListener('change', filtreazaLaSchimbare);
    }

    if (btnFiltreaza) {
        btnFiltreaza.addEventListener('click', () => {
            if (esteModServer()) return;
            ruleazaCuValidare(() => aplicaFiltre(true));
        });
    }

    if (btnSortAsc) {
        btnSortAsc.addEventListener('click', () => {
            if (esteModServer()) return;
            ruleazaCuValidare(() => {
                golesteAscunsTemporar();
                aplicaFiltre(false, false);
                sorteazaProduse(1);
                paginaCurenta = 1;
                aplicarePaginare();
            });
        });
    }

    if (btnSortDesc) {
        btnSortDesc.addEventListener('click', () => {
            if (esteModServer()) return;
            ruleazaCuValidare(() => {
                golesteAscunsTemporar();
                aplicaFiltre(false, false);
                sorteazaProduse(-1);
                paginaCurenta = 1;
                aplicarePaginare();
            });
        });
    }

    if (btnCalculeaza) {
        btnCalculeaza.addEventListener('click', () => {
            ruleazaCuValidare(() => {
                aplicaFiltre(false);
                calculeazaPreturiSelectate();
            });
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', () => reseteazaFiltre(true));
    }

    lista.addEventListener('click', handlerActiuniProdus);

    initEliminateDinSessionStorage();
    articole().forEach(actualizeazaStareButonFixare);

    window.reinitCatalogProduse = function () {
        paginaCurenta = 1;
        initEliminateDinSessionStorage();
        articole().forEach(actualizeazaStareButonFixare);
        aplicarePaginare();
    };

    actualizeazaAfisajRange();
    if (esteModServer()) {
        aplicarePaginare();
    } else {
        aplicaFiltre(true, false);
    }
})();

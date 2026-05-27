// Bonus 20 — comparare două produse (localStorage, container fix)

(function () {
    const CHEIE_STORAGE = 'mab_comparare_produse';
    const EXPIRARE_MS = 24 * 60 * 60 * 1000;
    const MAX_PRODUSE = 2;
    const MESAJ_DEZACTIVAT = 'ștergeți un produs din lista de comparare';

    const container = document.getElementById('container-comparare');
    const lista = document.getElementById('lista-comparare-produse');
    const btnAfiseaza = document.getElementById('btn-afiseaza-comparare');
    const tooltip = document.getElementById('tooltip-compara-dezactivat');

    if (!container || !lista) return;

    function citesteStare() {
        try {
            const raw = localStorage.getItem(CHEIE_STORAGE);
            if (!raw) return { produse: [], ultimaActivitate: 0 };
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.produse)) return { produse: [], ultimaActivitate: 0 };
            return data;
        } catch {
            return { produse: [], ultimaActivitate: 0 };
        }
    }

    function salveazaStare(stare) {
        localStorage.setItem(CHEIE_STORAGE, JSON.stringify(stare));
    }

    function curataExpirat(stare) {
        if (!stare.produse.length) return { produse: [], ultimaActivitate: 0 };
        if (Date.now() - Number(stare.ultimaActivitate) > EXPIRARE_MS) {
            return { produse: [], ultimaActivitate: 0 };
        }
        return stare;
    }

    function escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function randareContainer(stare) {
        lista.innerHTML = '';

        if (!stare.produse.length) {
            container.hidden = true;
            if (btnAfiseaza) btnAfiseaza.hidden = true;
            return;
        }

        container.hidden = false;

        stare.produse.forEach((p) => {
            const li = document.createElement('li');
            li.className = 'lista-comparare-produse__item';
            li.dataset.id = String(p.id);
            li.innerHTML =
                `<span class="lista-comparare-produse__nume">${escapeHtml(p.nume)}</span>` +
                `<button type="button" class="btn-sterge-comparare" data-sterge-id="${p.id}" ` +
                `aria-label="Șterge ${escapeHtml(p.nume)} din comparare" title="Șterge">×</button>`;
            lista.appendChild(li);
        });

        if (btnAfiseaza) {
            btnAfiseaza.hidden = stare.produse.length < MAX_PRODUSE;
        }
    }

    function actualizeazaButoane(stare) {
        const plin = stare.produse.length >= MAX_PRODUSE;
        const idsSelectate = new Set(stare.produse.map((p) => String(p.id)));

        document.querySelectorAll('[data-compara-id]').forEach((btn) => {
            const id = btn.getAttribute('data-compara-id');
            const dejaSelectat = idsSelectate.has(String(id));

            if (plin && !dejaSelectat) {
                btn.disabled = true;
                btn.setAttribute('data-tooltip-compara', MESAJ_DEZACTIVAT);
                btn.classList.add('btn-compara--dezactivat');
            } else if (dejaSelectat) {
                btn.disabled = true;
                btn.removeAttribute('data-tooltip-compara');
                btn.classList.remove('btn-compara--dezactivat');
            } else {
                btn.disabled = false;
                btn.removeAttribute('data-tooltip-compara');
                btn.classList.remove('btn-compara--dezactivat');
            }
        });
    }

    function reincarcaUI() {
        let stare = curataExpirat(citesteStare());
        salveazaStare(stare);
        randareContainer(stare);
        actualizeazaButoane(stare);
        return stare;
    }

    function adaugaProdus(id, nume) {
        let stare = citesteStare();
        stare = curataExpirat(stare);

        if (stare.produse.length >= MAX_PRODUSE) return stare;
        if (stare.produse.some((p) => String(p.id) === String(id))) return stare;

        stare.produse.push({ id: Number(id), nume: String(nume) });
        stare.ultimaActivitate = Date.now();
        salveazaStare(stare);
        randareContainer(stare);
        actualizeazaButoane(stare);
        return stare;
    }

    function stergeProdus(id) {
        let stare = citesteStare();
        stare.produse = stare.produse.filter((p) => String(p.id) !== String(id));
        stare.ultimaActivitate = Date.now();
        if (!stare.produse.length) stare.ultimaActivitate = 0;
        salveazaStare(stare);
        randareContainer(stare);
        actualizeazaButoane(stare);
    }

    function deschidePaginaComparare() {
        const stare = citesteStare();
        if (stare.produse.length < MAX_PRODUSE) return;
        const [p1, p2] = stare.produse;
        const url = `/comparare?p1=${encodeURIComponent(p1.id)}&p2=${encodeURIComponent(p2.id)}`;
        window.open(url, '_blank', 'noopener,noreferrer,width=960,height=720');
    }

    function handlerClickComparare(ev) {
        const btnCompara = ev.target.closest('[data-compara-id]');
        if (btnCompara) {
            ev.preventDefault();
            ev.stopPropagation();
            if (btnCompara.disabled) return;
            adaugaProdus(btnCompara.getAttribute('data-compara-id'), btnCompara.getAttribute('data-compara-nume'));
            return;
        }

        const btnSterge = ev.target.closest('[data-sterge-id]');
        if (btnSterge) {
            ev.preventDefault();
            ev.stopPropagation();
            stergeProdus(btnSterge.getAttribute('data-sterge-id'));
        }
    }

    document.addEventListener('click', handlerClickComparare, true);

    if (btnAfiseaza) {
        btnAfiseaza.addEventListener('click', deschidePaginaComparare);
    }

    document.addEventListener('mousemove', (ev) => {
        if (!tooltip) return;
        const btn = ev.target.closest('.btn-compara--dezactivat');
        if (!btn || !btn.disabled) {
            tooltip.hidden = true;
            return;
        }
        tooltip.textContent = btn.getAttribute('data-tooltip-compara') || MESAJ_DEZACTIVAT;
        tooltip.hidden = false;
        tooltip.style.left = `${ev.clientX + 14}px`;
        tooltip.style.top = `${ev.clientY + 14}px`;
    });

    document.addEventListener('lista-produse-actualizata', () => {
        reincarcaUI();
    });

    reincarcaUI();
})();

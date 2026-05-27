// Modal detalii produs pe pagina /produse (click pe card)

(function () {
    const lista = document.getElementById('lista-produse');
    const modalEl = document.getElementById('modal-produs');
    const modalBody = document.getElementById('modal-produs-body');
    const modalTitlu = document.getElementById('modal-produs-titlu');

    if (!lista || !modalEl || !modalBody) return;

    let modalBs = null;
    let incarcareInCurs = false;

    function escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function obtineModal() {
        if (!modalBs && typeof bootstrap !== 'undefined') {
            modalBs = bootstrap.Modal.getOrCreateInstance(modalEl);
        }
        return modalBs;
    }

    function randareImagini(imagini, nume) {
        if (!imagini || imagini.length === 0) {
            return '<p class="text-muted">Fără imagine.</p>';
        }
        if (imagini.length === 1) {
            return `<img src="${escapeHtml(imagini[0])}" alt="${escapeHtml(nume)}" class="modal-produs-mab__img">`;
        }

        const id = 'modal-carusel-produs';
        const items = imagini
            .map(
                (url, i) =>
                    `<div class="carousel-item${i === 0 ? ' active' : ''}">` +
                    `<img src="${escapeHtml(url)}" class="d-block w-100 modal-produs-mab__img" alt="${escapeHtml(nume)} — ${i + 1}">` +
                    '</div>'
            )
            .join('');

        return (
            `<div id="${id}" class="carousel slide modal-produs-mab__carusel" data-bs-ride="false">` +
            `<div class="carousel-inner">${items}</div>` +
            `<button type="button" class="carousel-control-prev" data-bs-target="#${id}" data-bs-slide="prev" aria-label="Imagine anterioară">` +
            '<span class="carousel-control-prev-icon"></span></button>' +
            `<button type="button" class="carousel-control-next" data-bs-target="#${id}" data-bs-slide="next" aria-label="Imagine următoare">` +
            '<span class="carousel-control-next-icon"></span></button>' +
            '</div>'
        );
    }

    function randareContinut(data) {
        const p = data.produs || {};
        const imagini = data.imagini_produs || [p.imagine].filter(Boolean);

        return (
            '<div class="modal-produs-mab__grid">' +
            `<div class="modal-produs-mab__media">${randareImagini(imagini, p.nume)}</div>` +
            '<div class="modal-produs-mab__detalii">' +
            `<p><strong>ID:</strong> ${escapeHtml(p.id)}</p>` +
            `<p><strong>Categorie:</strong> <span class="text-capitalize">${escapeHtml(p.categorie)}</span></p>` +
            `<p><strong>Familie:</strong> <span class="text-capitalize">${escapeHtml(p.subcategorie)}</span></p>` +
            `<p><strong>Preț:</strong> ${escapeHtml(p.pret)} RON</p>` +
            `<p><strong>Volum:</strong> ${escapeHtml(p.volum_ml)} ml</p>` +
            `<p><strong>Concentrație:</strong> ${escapeHtml(p.concentratie)}</p>` +
            `<p><strong>Note:</strong> ${escapeHtml(p.note_parfum)}</p>` +
            `<p><strong>În catalog din:</strong> <time datetime="${escapeHtml(data.data_lansare_iso || '')}">${escapeHtml(data.data_lansare_ro || '')}</time></p>` +
            `<p><strong>Ediție limitată:</strong> ${p.editie_limitata ? 'Da' : 'Nu'}</p>` +
            '<section class="modal-produs-mab__descriere">' +
            '<h3 class="h6">Descriere</h3>' +
            `<p>${escapeHtml(p.descriere)}</p>` +
            '</section></div></div>'
        );
    }

    async function deschideModalProdus(id) {
        const modal = obtineModal();
        if (!modal || incarcareInCurs) return;

        incarcareInCurs = true;
        modalTitlu.textContent = 'Se încarcă…';
        modalBody.innerHTML = '<p class="text-muted">Se încarcă detaliile produsului…</p>';
        modal.show();

        try {
            const raspuns = await fetch(`/produs/${id}?format=json`, {
                headers: { Accept: 'application/json' }
            });
            const data = await raspuns.json();

            if (!raspuns.ok || !data.ok) {
                throw new Error(data.mesaj || `HTTP ${raspuns.status}`);
            }

            modalTitlu.textContent = data.produs.nume || 'Produs';
            modalBody.innerHTML = randareContinut(data);
        } catch (err) {
            modalTitlu.textContent = 'Eroare';
            modalBody.innerHTML = `<p class="text-danger">Nu am putut încărca produsul: ${escapeHtml(err.message)}</p>`;
        } finally {
            incarcareInCurs = false;
        }
    }

    function articolClickabil(art) {
        if (!art) return false;
        if (art.classList.contains('ascuns') || art.classList.contains('pagina-ascuns')) return false;
        if (art.classList.contains('eliminat-sesiune')) return false;
        return true;
    }

    lista.addEventListener('click', (ev) => {
        if (ev.target.closest('.btn-produs-actiune, .btn-compara, .articol-produs__toolbar, .articol-produs__actiuni, .carousel-control-prev, .carousel-control-next')) {
            return;
        }

        if (ev.target.closest('.articol-produs__link-pagina, .articol-produs__link-detaliu a')) {
            return;
        }

        const art = ev.target.closest('.articol-produs');
        if (!articolClickabil(art)) return;

        const id = art.dataset.id;
        if (!id) return;

        ev.preventDefault();
        deschideModalProdus(id);
    });

    lista.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        const art = ev.target.closest('.articol-produs');
        if (!articolClickabil(art) || ev.target.closest('button, a, input, textarea, select')) return;
        ev.preventDefault();
        deschideModalProdus(art.dataset.id);
    });
})();

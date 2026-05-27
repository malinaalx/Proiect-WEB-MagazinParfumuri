// Etapa 5 — Bonus 10b) filtrare/sortare server cu fetch(), fără reîncărcare pagină

(function () {
    const form = document.getElementById('form-filtre-server');
    const lista = document.getElementById('lista-produse');
    const info = document.getElementById('filtre-server-info');
    const btnFetch = document.getElementById('btn-filtre-server-fetch');

    if (!form || !lista) return;

    function parametriDinFormular() {
        const params = new URLSearchParams();
        params.set('srv', '1');

        for (const [cheie, valoare] of new FormData(form).entries()) {
            if (cheie === 'srv') continue;
            if (valoare === '' && cheie !== 'noutati') continue;
            params.append(cheie, valoare);
        }

        if (!form.querySelector('#srv-noutati:checked')) {
            params.delete('noutati');
        }

        return params;
    }

    async function aplicaCuFetch() {
        const params = parametriDinFormular();
        params.set('format', 'partial');

        if (info) info.textContent = 'Se încarcă lista de la server…';

        try {
            const raspuns = await fetch(`/produse?${params.toString()}`, {
                headers: { Accept: 'text/html' }
            });

            if (!raspuns.ok) throw new Error(`HTTP ${raspuns.status}`);

            const html = await raspuns.text();
            lista.innerHTML = html;
            document.dispatchEvent(new CustomEvent('lista-produse-actualizata'));
            lista.dataset.modServer = '1';

            if (!lista.querySelector('.articol-produs')) {
                const gol = document.createElement('p');
                gol.className = 'produse-gol';
                gol.textContent = 'Nu există produse conform filtrării server.';
                lista.appendChild(gol);
            }

            const url = `/produse?${parametriDinFormular().toString()}`;
            history.replaceState(null, '', url);

            if (info) {
                const nr = lista.querySelectorAll('.articol-produs').length;
                info.textContent = `${nr} produse încărcate cu fetch() (filtrare/sortare server).`;
            }

            if (typeof window.reinitCatalogProduse === 'function') {
                window.reinitCatalogProduse();
            }
        } catch (err) {
            if (info) info.textContent = `Eroare fetch: ${err.message}`;
        }
    }

    if (btnFetch) {
        btnFetch.addEventListener('click', (ev) => {
            ev.preventDefault();
            aplicaCuFetch();
        });
    }

    // Submit clasic (Bonus 10a) — navigare GET; nu interceptăm formularul
})();

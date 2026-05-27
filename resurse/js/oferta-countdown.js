// Bonus 12 — temporizator ofertă (actualizare la 1s, alertă ultimele 10s)

(function () {
    const anunt = document.getElementById('anunt-oferta');
    const countdownEl = document.getElementById('oferta-countdown');
    if (!anunt || !countdownEl) return;

    let sunetUltim10s = false;
    let intervalId = null;

    function formateazaTimp(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }

    function redaSunetScurt() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            osc.start();
            osc.stop(ctx.currentTime + 0.12);
        } catch {
            /* ignorat dacă browserul blochează audio */
        }
    }

    function afiseazaOferta(oferta) {
        if (!oferta) {
            anunt.hidden = true;
            return;
        }

        anunt.hidden = false;
        anunt.dataset.expira = oferta['data-finalizare'];
        anunt.dataset.categorie = oferta.categorie;
        anunt.dataset.reducere = String(oferta.reducere);

        const titlu = anunt.querySelector('.anunt-oferta__titlu');
        if (titlu) {
            titlu.innerHTML =
                `Ofertă <strong>${oferta.reducere}%</strong> reducere la categoria ` +
                `<span class="text-capitalize">${oferta.categorie}</span>`;
        }
    }

    function actualizeazaCountdown() {
        const expira = anunt.dataset.expira;
        if (!expira) return;

        const ramas = new Date(expira).getTime() - Date.now();

        if (ramas <= 0) {
            countdownEl.textContent = 'Oferta a expirat — urmează una nouă…';
            anunt.classList.add('anunt-oferta--expirata');
            countdownEl.classList.remove('oferta-countdown--urgent');
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
            return;
        }

        anunt.classList.remove('anunt-oferta--expirata');
        countdownEl.textContent = `Mai rămân: ${formateazaTimp(ramas)}`;

        if (ramas <= 10000) {
            countdownEl.classList.add('oferta-countdown--urgent');
            if (!sunetUltim10s) {
                sunetUltim10s = true;
                redaSunetScurt();
            }
        } else {
            countdownEl.classList.remove('oferta-countdown--urgent');
            sunetUltim10s = false;
        }
    }

    async function reincarcaOferta() {
        try {
            const rasp = await fetch('/api/oferta-curenta', { headers: { Accept: 'application/json' } });
            const data = await rasp.json();
            if (data.ok && data.oferta) {
                sunetUltim10s = false;
                afiseazaOferta(data.oferta);
                actualizeazaCountdown();
                if (!intervalId) {
                    intervalId = setInterval(actualizeazaCountdown, 1000);
                }
            } else if (!data.oferta) {
                anunt.hidden = true;
            }
        } catch {
            /* reîncearcă la următorul poll */
        }
    }

    const expiraInitial = anunt.dataset.expira;
    if (expiraInitial) {
        afiseazaOferta({
            categorie: anunt.dataset.categorie,
            reducere: Number(anunt.dataset.reducere),
            'data-finalizare': expiraInitial
        });
        actualizeazaCountdown();
        intervalId = setInterval(actualizeazaCountdown, 1000);
    }

    setInterval(reincarcaOferta, 3000);
    reincarcaOferta();
})();

// Bonus 19 — panou orar (deschidere/închidere, auto-ascundere, deschis/închis acum)

(function () {
    const panou = document.getElementById('panou-orar');
    const statusEl = document.getElementById('orar-status');
    const dateEl = document.getElementById('date-orar');
    if (!panou || !dateEl) return;

    let dateOrar;
    try {
        dateOrar = JSON.parse(dateEl.textContent);
    } catch {
        return;
    }

    const program = dateOrar.program || [];
    const autoSec = Number(dateOrar.auto_ascundere_sec) > 0 ? Number(dateOrar.auto_ascundere_sec) : 20;
    let timerAscundere = null;

    function minuteDinOra(hhmm) {
        const parti = String(hhmm).split(':');
        const h = Number(parti[0]);
        const m = Number(parti[1] || 0);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        return h * 60 + m;
    }

    function esteDeschisAcum() {
        const acum = new Date();
        const idxZi = acum.getDay();
        const zi = program[idxZi];
        if (!zi || !zi.intervale || !zi.intervale.length) return false;

        const minutCurent = acum.getHours() * 60 + acum.getMinutes();
        return zi.intervale.some((iv) => {
            const start = minuteDinOra(iv.start);
            const end = minuteDinOra(iv.end);
            if (start === null || end === null) return false;
            return minutCurent >= start && minutCurent < end;
        });
    }

    function formateazaOraAcum() {
        const d = new Date();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    function marcheazaZiCurenta() {
        panou.querySelectorAll('.tabel-orar__rand').forEach((rand) => {
            rand.classList.remove('tabel-orar__rand--azi');
        });
        const randAzi = panou.querySelector(`.tabel-orar__rand[data-zi-index="${new Date().getDay()}"]`);
        if (randAzi) randAzi.classList.add('tabel-orar__rand--azi');
    }

    function actualizeazaStatus() {
        if (!statusEl) return;
        const deschis = esteDeschisAcum();
        statusEl.classList.remove('orar-status--deschis', 'orar-status--inchis');
        if (deschis) {
            statusEl.textContent = `Acum (${formateazaOraAcum()}) suntem DESCHIȘI.`;
            statusEl.classList.add('orar-status--deschis');
        } else {
            statusEl.textContent = `Acum (${formateazaOraAcum()}) suntem ÎNCHIȘI.`;
            statusEl.classList.add('orar-status--inchis');
        }
    }

    function opresteTimerAscundere() {
        if (timerAscundere) {
            clearTimeout(timerAscundere);
            timerAscundere = null;
        }
    }

    function inchidePanou() {
        opresteTimerAscundere();
        panou.hidden = true;
        document.body.classList.remove('panou-orar-deschis');
    }

    function deschidePanou() {
        marcheazaZiCurenta();
        actualizeazaStatus();
        panou.hidden = false;
        document.body.classList.add('panou-orar-deschis');
        panou.querySelector('.panou-orar__inchide')?.focus();

        opresteTimerAscundere();
        timerAscundere = setTimeout(inchidePanou, autoSec * 1000);
    }

    function initButoaneDeschidere() {
        document.querySelectorAll('[data-deschide-orar]').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                if (panou.hidden) deschidePanou();
                else inchidePanou();
            });
        });
    }

    panou.querySelectorAll('[data-inchide-orar]').forEach((el) => {
        el.addEventListener('click', inchidePanou);
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && !panou.hidden) inchidePanou();
    });

    initButoaneDeschidere();
    marcheazaZiCurenta();
})();

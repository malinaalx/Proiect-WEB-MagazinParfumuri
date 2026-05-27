// Etapa 5 — Bonus 2) cel puțin 3 teme, memorare în localStorage, alegere prin select

(function () {
    const STORAGE_KEY = 'mab-bs-theme';
    const TEMA_IMPLICITA = 'lux';
    const TEME_VALIDE = ['lux', 'nocturn', 'menta'];

    function temaValida(nume) {
        return TEME_VALIDE.includes(nume) ? nume : TEMA_IMPLICITA;
    }

    function aplicaTema(nume) {
        const tema = temaValida(nume);
        document.documentElement.setAttribute('data-bs-theme', tema);
        localStorage.setItem(STORAGE_KEY, tema);

        const select = document.getElementById('select-tema');
        if (select && select.value !== tema) {
            select.value = tema;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const salvata = localStorage.getItem(STORAGE_KEY);
        const dinHtml = document.documentElement.getAttribute('data-bs-theme');
        aplicaTema(salvata || dinHtml || TEMA_IMPLICITA);

        const select = document.getElementById('select-tema');
        if (select) {
            select.addEventListener('change', () => {
                aplicaTema(select.value);
            });
        }
    });
})();

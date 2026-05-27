-- Etapa 5 — Bonus 9) imagini multiple per produs
-- Rulează în pgAdmin pe baza mab_fragrance_db

-- 1) Coloană nouă: folderul (cale web) unde sunt TOATE imaginile produsului
ALTER TABLE parfumuri
ADD COLUMN IF NOT EXISTS folder_imagini VARCHAR(500);

COMMENT ON COLUMN parfumuri.folder_imagini IS
    'Cale web către folderul cu imaginile produsului, ex: /resurse/imagini/galerie/';

-- 2) Setare folder pentru toate produsele (adaptați dacă folosiți altă structură)
UPDATE parfumuri
SET folder_imagini = '/resurse/imagini/galerie/'
WHERE folder_imagini IS NULL OR TRIM(folder_imagini) = '';

-- 3) Verificare
-- SELECT id, nume, imagine, folder_imagini FROM parfumuri ORDER BY id;

-- NOTĂ: în folder, pentru carusel se folosesc doar:
--   imaginea principală: Alien.jpg
--   variante numerotate: Alien2.webp, Alien3.jpg (prefix + cifre)
-- NU se includ variantele de dimensiune din galerie: Alien-mic, Alien-mediu, Alien-mare
-- Dacă folder_imagini e NULL, serverul folosește automat directorul din câmpul imagine.

# ligalgbt

Prosta statyczna strona dla ligi LGBT z podstronami sportowymi i panelem administratora.

## Uruchomienie na GitHub Pages

1. Wypchnij repozytorium na GitHub.
2. W ustawieniach repozytorium przejdź do **Pages**.
3. Wybierz gałąź `gh-pages` jako źródło publikacji.
4. Zapisz ustawienia.

## Automatyczne wdrożenie

Po każdym pushu do gałęzi `main` GitHub Actions uruchomi workflow `.github/workflows/gh-pages.yml` i opublikuje zawartość repozytorium na gałęzi `gh-pages`.

## Uwaga

- Strona jest statyczna, więc wystarczy wypchnąć wszystkie pliki.
- Panel administratora działa w przeglądarce lokalnie przy pomocy `localStorage`.

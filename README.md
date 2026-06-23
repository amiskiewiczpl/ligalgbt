# ligalgbt

Prosta statyczna strona dla Ligi LGBT z podstronami sportowymi, rankingami i panelem administratora.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce albo uruchom prosty serwer statyczny w katalogu projektu.

## Uruchomienie na GitHub Pages

1. Wypchnij repozytorium na GitHub.
2. W ustawieniach repozytorium przejdź do **Pages**.
3. Wybierz gałąź `gh-pages` jako źródło publikacji.
4. Zapisz ustawienia.

## Automatyczne wdrożenie

Po każdym pushu do gałęzi `main` GitHub Actions uruchomi workflow `.github/workflows/gh-pages.yml` i opublikuje zawartość repozytorium na gałęzi `gh-pages`.

## Wspólne i trwałe dane

Strona używa Supabase jako wspólnej bazy. Publiczne podstrony mogą odczytywać
wyniki, a zapis jest dostępny wyłącznie dla zalogowanego administratora.

1. Utwórz projekt w Supabase.
2. W SQL Editor uruchom cały plik `supabase/schema.sql`.
3. W Authentication utwórz konto administratora e-mail + hasło i wyłącz
   publiczne rejestrowanie nowych użytkowników.
4. W `config.js` wpisz Project URL i klucz `anon`/`publishable`.
5. Opublikuj stronę ponownie.
6. Zaloguj się przez `login.html`. Pierwsze wejście do panelu utworzy wspólny
   rekord danych, jeśli baza jest jeszcze pusta.

Klucz publiczny Supabase może znajdować się w przeglądarce. Nie wolno wpisywać
do `config.js` żadnego klucza serwerowego ani sekretu.

Jeśli Supabase nie jest skonfigurowany lub chwilowo niedostępny, publiczna
strona korzysta z lokalnej kopii awaryjnej. Panel administratora nie pozwala
wtedy na logowanie i zapis, aby nie tworzyć rozbieżnych wyników.

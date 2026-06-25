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

Dane rozgrywek używają schematu V3. Rozgrywki i etapy znajdują się w
`competitions`, a wszystkie mecze ligowe i turniejowe w jednej tablicy
`matches`. Stare rekordy V2 są migrowane bez utraty wyników, setów, MVP ani
klasyfikacji. Po pierwszym zapisie administratora wersja V3 zostaje utrwalona
w Supabase.

Silnik obsługuje turnieje od jednego do trzech etapów: każdy-z-każdym, grupy
oraz play-off. Awans i klasyfikacja końcowa są wyliczane z wyników, a zmiana
wcześniejszego rezultatu kontroluje zależne mecze kolejnych rund i etapów.

Administrator tworzy turniej w sześciu krokach: dane, uczestnicy, etapy,
zasady, terminarz i podgląd. Kreator filtruje uczestników według dyscypliny,
obsługuje rozstawienie, remisy i awans między etapami oraz generuje grupy,
mecze i drabinkę bez pól tekstowych. Zapisanym turniejem zarządza się na
osobnej stronie `admin-turniej.html?id=...`.

Panel wyników rozdziela tworzenie terminarza od wpisywania rezultatów.
Administrator najpierw zapisuje ligowy mecz z sezonem, poziomem, kolejką i
datą, a następnie wybiera istniejący mecz. Uczestnicy, profil setów i lista MVP
są ustalane automatycznie. Z administracyjnej drabinki turnieju można przejść
bezpośrednio do właściwego formularza wyniku. Panel pokazuje też osobną listę
aktywnych meczów bez daty, które nie trafią do publicznego kalendarza do czasu
uzupełnienia terminu.

Tabele ligowe są rozdzielone na poziomy A, B, B-, C i D. Pokazują mecze,
wygrane, remisy, porażki, sety, małe punkty, oba bilanse i punkty tabeli.
Każdą kolumnę można sortować, ale awans, spadek, mistrzostwo i numer oficjalnej
pozycji nadal wynikają z tie-breaków ligi. Pod tabelą widoczny jest najnowszy
ukończony mecz każdej drużyny.

Publiczne rozgrywki mają oddzielne adresy:

- `klasyfikacje.html` - filtrowane wyniki i tabele ligi albo karty turniejów;
- `turnieje.html` - lista opublikowanych turniejów;
- `turniej.html?id=...` - daty, uczestnicy, etapy, grupy, wyniki, drabinka i
  klasyfikacja jednego wydarzenia;
- `kalendarz.html` - wspólny terminarz ligi i turniejów, grupowany według
  miesiąca i dnia, z filtrami dyscypliny, rodzaju rozgrywek, poziomu, statusu
  oraz zakresu dat.

Strony dyscyplin pokazują tylko karty turniejów. Szkice administratora nie są
widoczne publicznie. Każdy datowany mecz występuje w kalendarzu raz i prowadzi
do strony turnieju albo tabeli właściwego poziomu ligowego.

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

## Testy przed publikacją

Pełna regresja danych i interfejsu:

```powershell
node tests/run-all.js
```

Publiczny odczyt produkcyjnego rekordu Supabase bez wypisywania klucza lub
pełnych danych:

```powershell
node tests/live-supabase-read.js
```

Audyt wizualny wymaga lokalnego serwera oraz Chrome lub Edge:

```powershell
$env:PORT = "4179"
node tests/static-server.js
```

W drugim terminalu:

```powershell
$env:VISUAL_BASE_URL = "http://127.0.0.1:4179"
$env:VISUAL_OUTPUT_DIR = "tests/visual-output"
node tests/visual-audit.js
```

Przed `commit` i `push` zaloguj się jako administrator, zapisz niewielką zmianę
i potwierdź jej widoczność w drugiej, prywatnej sesji przeglądarki. To jest
końcowy test rzeczywistej sesji Auth i polityk zapisu RLS.

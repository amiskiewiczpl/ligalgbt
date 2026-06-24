# Plan przebudowy turniejów i panelu administratora

## Status realizacji

- [x] Etap 1. Porządek w modelu danych.
- [x] Etap 2. Silnik formatów turniejowych.
- [x] Etap 3. Graficzna prezentacja turniejów.
- [x] Etap 4. Rozdzielenie panelu administratora.
- [x] Etap 5. Formularz wyników z filtrowaniem.
- [x] Etap 6. Sortowanie wszystkich encji.
- [x] Etap 7. Lista zawodników: filtry, liczniki i sortowanie.
- [x] Etap 8. Numerowane składy drużyn.
- [ ] Etap 9. Testy końcowe i migracja.

Etap 9 ma zakończoną część automatyczną: pełną regresję, test migracji,
symulację dwóch sesji, audyt wizualny 360/768/1440 px, skan sekretów i kontrolę
składni. Do zamknięcia etapu pozostaje ręczny zapis po zalogowaniu do
produkcyjnego Supabase i potwierdzenie odczytu w drugiej, prywatnej sesji;
zgodnie z punktem 9.4 commit i push następują dopiero po tym sprawdzeniu.

## Cel

Przebudować system rozgrywek i panel administratora tak, aby:

- turnieje obsługiwały różne formaty, fazy grupowe, play-off i remisy 1:1;
- drabinki oraz grupy były czytelne graficznie na stronie publicznej;
- panel administratora był podzielony na osobne podstrony robocze;
- formularze pokazywały wyłącznie uczestników zgodnych z dyscypliną i poziomem;
- kluby, drużyny i zawodnicy były sortowane przewidywalnie;
- składy były numerowane, a listę zawodników można było filtrować i sortować.

## Zasady wykonania

- Każdy etap kończy się testem danych, interfejsu desktopowego i mobilnego.
- Nie usuwamy istniejących wyników podczas migracji.
- Dane zapisane w Supabase pozostają zgodne ze starszą wersją aplikacji.
- Formularze nie przyjmują dowolnego tekstu tam, gdzie istnieje lista encji.
- Wszystkie operacje administracyjne muszą zachować powiązania między klubem,
  drużyną, zawodnikiem, dyscypliną, poziomem, turniejem i wynikiem.

---

## Etap 1. Porządek w modelu danych

### 1.1. Wersjonowanie danych

- Dodać `schemaVersion` do wspólnego stanu ligi.
- Dodać migrację istniejących danych do nowego modelu.
- Migracja nie może usuwać wyników, składów, MVP ani klasyfikacji.

### 1.2. Rozszerzenie wyniku meczu

- Dopuścić wyniki:
  - liga siatkarska: 3:0, 3:1, 3:2 i wyniki odwrotne;
  - system do dwóch wygranych setów: 2:0, 2:1 i wyniki odwrotne;
  - system turniejowy z remisem: 1:1;
  - opcjonalnie 0:0 dla meczu zaplanowanego, ale jeszcze nierozpoczętego.
- Wynik 1:1 musi tworzyć dokładnie dwa pola wyników setów.
- Walidacja ma potwierdzać, że każdy uczestnik wygrał po jednym secie.
- Punktacja remisu ma być konfigurowalna w zasadach fazy, domyślnie po 1 punkcie.

### 1.3. Nowy model turnieju

Każdy turniej otrzymuje:

- `format`:
  - `knockout` - bezpośredni play-off;
  - `groups_knockout` - grupy, potem drabinka;
  - `groups_final_group` - grupy, potem grupa finałowa;
- `participantType`: `team` albo `player`, wynikający z dyscypliny;
- `participants`: lista identyfikatorów zapisanych uczestników;
- `seeding`: `random`, `manual` albo `group_result`;
- `groupConfig`:
  - liczba grup;
  - liczba uczestników w grupie;
  - liczba spotkań każdej pary, np. 1 albo 2;
  - liczba awansujących;
  - sposób rozstrzygania remisów w tabeli;
- `finalStageConfig`:
  - `knockout` albo `final_group`;
  - reguła parowania;
  - liczba uczestników;
- `groups`: wygenerowane grupy i mecze;
- `bracket`: rundy, pary, zwycięzcy i statusy;
- `status`: planowany, w trakcie, zakończony.

### Kryterium zakończenia

- Stare dane otwierają się bez błędów.
- Nowy turniej można zapisać i ponownie wczytać bez utraty konfiguracji.
- Remis 1:1 przechodzi walidację tylko w dozwolonym formacie.

---

## Etap 2. Silnik formatów turniejowych

### 2.1. Play-off od pierwszej rundy

- Administrator wybiera uczestników.
- System losuje pary albo respektuje ręczne rozstawienie.
- Dla nieparzystej liczby uczestników obsługuje wolny los.
- Generuje rundy aż do finału:
  - runda wstępna;
  - ćwierćfinał;
  - półfinał;
  - finał;
  - opcjonalnie mecz o trzecie miejsce.
- Zapis zwycięzcy automatycznie uzupełnia kolejną rundę.
- Nie można edytować wcześniejszego wyniku bez ostrzeżenia, jeśli kolejna runda
  ma już wynik.

### 2.2. Grupy, potem play-off

- Administrator ustawia liczbę grup i liczbę uczestników.
- System rozdziela uczestników losowo albo ręcznie.
- Każda para w grupie gra raz lub dwa razy.
- Tabele grup liczą się automatycznie.
- Awansujący są pobierani z pozycji w grupach.
- Dostępne reguły parowania:
  - A1 kontra B2, B1 kontra A2;
  - pierwszy z grupy 1 kontra ostatni zakwalifikowany z grupy 2;
  - ręczne przypisanie;
  - rozstawienie wszystkich zakwalifikowanych według wspólnego rankingu.
- Wszystkie grupy i faza finałowa należą do jednego poziomu rozgrywkowego.

### 2.3. Grupy, potem grupa finałowa

- Do grupy finałowej przechodzą zwycięzcy lub określona liczba najlepszych.
- Wyniki grupy finałowej liczą się osobno.
- Konfiguracja określa, czy przenosić wynik bezpośredniego meczu z pierwszej fazy.
- Końcowa klasyfikacja wynika z tabeli grupy finałowej.

### 2.4. Tabele grupowe

Kolejność:

1. punkty;
2. liczba zwycięstw;
3. wygrane sety;
4. bilans setów;
5. zdobyte małe punkty;
6. bilans małych punktów;
7. mecze bezpośrednie;
8. ręczna decyzja administratora tylko jako jawny tie-break.

### Kryterium zakończenia

- Każdy z trzech formatów da się wygenerować na danych testowych.
- Losowanie nie tworzy meczu uczestnika z samym sobą.
- Ten sam uczestnik nie trafia dwa razy do jednej rundy lub grupy.
- Awans z grup generuje poprawne pary kolejnej fazy.

---

## Etap 3. Graficzna prezentacja turniejów

### 3.1. Drabinka

- Każda runda jest osobną kolumną.
- Pary mają czytelne połączenia do kolejnej rundy.
- Wynik, zwycięzca i status są widoczne bez otwierania szczegółów.
- Na telefonie drabinka przewija się poziomo i nie ściska tekstu.
- Wolny los ma osobne oznaczenie.
- Brak wyniku nie może wyglądać jak 0:0.

### 3.2. Grupy

- Każda grupa ma:
  - tabelę;
  - listę meczów;
  - oznaczone miejsca awansujące;
  - informację o liczbie spotkań każdej pary.
- Grupy układają się jedna pod drugą na małych ekranach.
- Po fazie grupowej widoczny jest graficzny przepływ do fazy finałowej.

### 3.3. Strona główna i strona dyscypliny

- Strona główna pokazuje tylko końcową klasyfikację i status turnieju.
- Strona dyscypliny pokazuje grupy, wyniki i drabinkę.
- Pełny turniej otrzymuje własny adres z parametrem lub osobną podstronę.

### Kryterium zakończenia

- Drabinka jest czytelna dla 4, 8 i 16 uczestników.
- Układ nie nachodzi na siebie przy szerokościach 360, 768 i 1440 px.
- Grupy i drabinka pokazują te same dane co panel administratora.

---

## Etap 4. Rozdzielenie panelu administratora

### 4.1. Docelowe podstrony

- `admin.html` - dashboard i skróty, bez dużych formularzy;
- `admin-kluby.html` - kluby i logotypy;
- `admin-druzyny.html` - drużyny, poziomy i składy;
- `admin-zawodnicy.html` - zawodnicy, dyscypliny, filtry i przypisania;
- `admin-wyniki.html` - wyniki ligowe i turniejowe;
- `admin-turnieje.html` - kreator formatu, grup i drabinek;
- `admin-klasyfikacje.html` - podgląd tabel i kontrola tie-breaków.

### 4.2. Wspólna nawigacja administratora

- Jeden spójny pasek na wszystkich podstronach.
- Aktywna podstrona jest jednoznacznie zaznaczona.
- Pasek nie tańczy przy przewijaniu.
- Na telefonie używa menu zwijanego.
- Każda podstrona ładuje tylko potrzebny edytor.

### 4.3. Routing renderowania

- `data-page` określa właściwy moduł administracyjny.
- `initPage()` nie renderuje nieobecnych sekcji.
- Wspólne elementy: autoryzacja, wylogowanie, zapis, toasty i synchronizacja.

### Kryterium zakończenia

- Żadna podstrona nie zawiera wszystkich formularzy naraz.
- Bez zalogowania każda podstrona administracyjna przekierowuje do logowania.
- Zapis na jednej podstronie jest natychmiast widoczny na pozostałych.

---

## Etap 5. Formularz wyników z filtrowaniem

### 5.1. Kolejność wyboru

1. dyscyplina;
2. rodzaj rozgrywek: liga albo turniej;
3. poziom lub konkretny turniej i faza;
4. uczestnik pierwszy;
5. uczestnik drugi;
6. format wyniku;
7. sety;
8. MVP.

### 5.2. Filtrowanie ligi

- Poziom A pokazuje wyłącznie drużyny zapisane na A.
- Poziom B pokazuje wyłącznie drużyny zapisane na B.
- Analogicznie B-, C i D.
- Po zmianie poziomu oba pola uczestników i MVP są czyszczone.
- Nie można zapisać meczu drużyn z różnych poziomów.

### 5.3. Filtrowanie turniejów

- Lista turniejów zależy od dyscypliny.
- Lista uczestników zależy od zapisów do wybranego turnieju.
- Lista meczów zależy od wybranej fazy i wygenerowanego terminarza.
- Wyniku nie wpisuje się dla pary, której nie ma w grupie lub drabince.
- Remis 1:1 jest dostępny tylko tam, gdzie pozwala konfiguracja fazy.

### Kryterium zakończenia

- Nie da się zapisać meczu poziomu C z drużyną poziomu A.
- Nie da się zapisać wyniku turnieju dla niezapisanego uczestnika.
- MVP pochodzi wyłącznie z prawidłowych uczestników meczu.

---

## Etap 6. Sortowanie wszystkich encji

### 6.1. Zawodnicy

- Domyślne sortowanie po nazwisku.
- Dla `Jakub Kowalski` klucz sortowania to `Kowalski, Jakub`.
- Dla wielu członów ostatni człon jest nazwiskiem, np.
  `Anna Maria Nowak` -> `Nowak, Anna Maria`.
- Sortowanie używa polskiego locale i ignoruje wielkość liter.
- Przy identycznym nazwisku drugi klucz to imię.

### 6.2. Kluby i drużyny

- Domyślnie alfabetycznie po pełnej nazwie.
- Drużyny mogą być sortowane po:
  - nazwie;
  - klubie;
  - dyscyplinie;
  - poziomie.
- Poziomy mają kolejność: A, B, B-, C, D, bez poziomu.

### 6.3. Stabilność

- Kolejność dodania nie wpływa na widok.
- Sortowanie nie modyfikuje kolejności rekordów zapisanych w bazie.
- Numer porządkowy jest liczony po filtrowaniu i sortowaniu.

### Kryterium zakończenia

- Dodanie zawodnika na końcu danych umieszcza go w prawidłowym miejscu listy.
- Polskie litery sortują się zgodnie z `pl-PL`.
- Zmiana sortowania aktualizuje numery bez przeładowania strony.

---

## Etap 7. Lista zawodników: filtry, liczniki i sortowanie

### 7.1. Kontrolki

- wyszukiwarka po imieniu i nazwisku;
- filtr klubu;
- filtr dyscypliny;
- filtr drużyny;
- wybór sortowania:
  - nazwisko;
  - klub;
  - dyscyplina;
  - liczba drużyn;
- kierunek rosnąco lub malejąco;
- przycisk wyczyszczenia filtrów.

### 7.2. Dynamiczne liczenie

- Pokazać:
  - liczbę wszystkich zawodników;
  - liczbę widocznych po filtrach;
  - liczbę zawodników w każdej widocznej grupie.
- Przy sortowaniu po klubie numeracja działa w ramach całej przefiltrowanej listy:
  `1...20 Orion`, następnie `21...` kolejny klub.
- Opcjonalne nagłówki grup pokazują nazwę klubu i liczbę zawodników.

### 7.3. Tabela

- Kolumny:
  - numer;
  - nazwisko i imię;
  - klub;
  - dyscypliny;
  - drużyny;
  - akcje.
- Na telefonie tabela przechodzi w czytelne wiersze lub przewijany obszar.
- Filtry pozostają widoczne nad listą, bez przyklejania powodującego skakanie.

### Kryterium zakończenia

- Filtry można łączyć.
- Licznik aktualizuje się natychmiast.
- Edycja i usunięcie działają na właściwym rekordzie niezależnie od sortowania.

---

## Etap 8. Numerowane składy drużyn

### 8.1. Panel administratora

- Skład wyświetla się jako lista:
  1. zawodnik;
  2. zawodnik;
  3. zawodnik.
- Nagłówek pokazuje `Skład (N)`.
- Zawodnicy w składzie są sortowani po nazwisku.
- Lista wyboru pokazuje wyłącznie zawodników:
  - z właściwego klubu;
  - z właściwej dyscypliny.

### 8.2. Strona publiczna

- Karta drużyny pokazuje numerowany skład i liczbę zawodników.
- Długie nazwiska zawijają się bez nachodzenia.
- Pusty skład ma czytelny komunikat, bez pustej tabeli.

### Kryterium zakończenia

- Liczba w nagłówku zgadza się z liczbą pozycji.
- Zawodnik bez siatkówki nie pojawia się w składzie siatkarskim.
- Usunięcie zawodnika aktualizuje licznik i numerację.

---

## Etap 9. Testy końcowe i migracja

### 9.1. Dane testowe

- turniej play-off dla 4, 8 i 12 uczestników;
- cztery grupy po trzy drużyny, dwa mecze każdej pary;
- jedna grupa czterech drużyn;
- grupy z przejściem do drabinki;
- grupy z przejściem do grupy finałowej;
- remis 1:1;
- poziomy A, B, B-, C i D;
- zawodnicy wielodyscyplinowi.

### 9.2. Regresja

- logowanie Supabase;
- wspólny zapis danych;
- kluby i logotypy;
- przypisywanie zawodników do drużyn;
- automatyczne tabele ligowe;
- MVP;
- publiczne strony sportów;
- polskie znaki;
- mobilny navbar i brak tańczenia nagłówka.

### 9.3. Kontrola wizualna

- 360 x 800;
- 768 x 1024;
- 1440 x 900;
- brak nachodzących tabel, formularzy i etykiet;
- brak uciętych przycisków;
- drabinka ma kontrolowany poziomy scroll na małych ekranach.

### 9.4. Publikacja

- uruchomić skan sekretów;
- sprawdzić składnię JavaScript;
- sprawdzić migrację starszego rekordu Supabase;
- wykonać zapis i odczyt z dwóch różnych sesji;
- dopiero potem commit i push.

---

## Kolejność wdrażania

1. Etap 1 - model i migracja.
2. Etap 5 - bezpieczny formularz wyników i filtrowanie poziomów.
3. Etap 2 - silnik formatów turniejowych.
4. Etap 3 - publiczne grupy i drabinki.
5. Etap 4 - osobne podstrony administratora.
6. Etap 6 - wspólne sortowanie.
7. Etap 7 - filtry i liczniki zawodników.
8. Etap 8 - numerowane składy.
9. Etap 9 - pełna regresja i publikacja.

## Definicja ukończenia całości

Przebudowa jest ukończona dopiero wtedy, gdy wszystkie kryteria etapów są
spełnione, dane synchronizują się przez Supabase, a administrator nie może
utworzyć logicznie niepoprawnego meczu, składu, grupy ani drabinki.

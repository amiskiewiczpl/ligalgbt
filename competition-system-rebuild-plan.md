# Plan V2: rozgrywki, turnieje, wyniki i kalendarz

## Status

- [x] Etap 0. Kontrakt funkcjonalny i testy zabezpieczające.
- [x] Etap 1. Jeden model rozgrywek i meczów.
- [x] Etap 2. Silnik etapów turniejowych.
- [x] Etap 3. Kreator turnieju w panelu administratora.
- [x] Etap 4. Terminarz i logiczne wprowadzanie wyników.
- [x] Etap 5. Tabele poziomów, remisy, sortowanie i numeracja.
- [x] Etap 6. Publiczna architektura wyników i turniejów.
- [x] Etap 7. Kalendarz ligi i turniejów.
- [ ] Etap 8. Klasyfikacja klubów.
- [ ] Etap 9. Migracja, regresja i publikacja.

## 1. Audyt obecnego stanu

### Co jest już wartościowe

- `tournament-engine.js` potrafi generować drabinkę, grupy i mecze
  każdy-z-każdym.
- Silnik potrafi propagować zwycięzcę do kolejnej rundy i blokować zmianę
  wcześniejszego wyniku, jeśli kolejna runda ma już rezultat.
- Istnieje liczenie tabel grupowych z remisami oraz obsługa wyniku 1:1.
- Istnieje publiczny widok grup i drabinki na `turniej.html?id=...`.
- Formularz ligowy częściowo filtruje drużyny według dyscypliny i poziomu.

### Co jest obecnie błędne

- `renderPublicRankingsPage()` i panel klasyfikacji wywołują tabelę bez poziomu,
  więc drużyny A, B, B-, C i D mogą zostać połączone.
- Publiczna strona wyników pokazuje jedną zbiorczą klasyfikację na dyscyplinę
  zamiast osobnych tabel każdego poziomu.
- Tabele nie mają interaktywnego sortowania po dowolnej statystyce.
- Brakuje jasnego rozdzielenia numeru wiersza od oficjalnej pozycji w tabeli.
- Ligowa tabela nie eksponuje remisów, mimo że ogólny model rozgrywek powinien
  je obsługiwać.
- Kreator turnieju nadal wymaga ręcznego wpisania klasyfikacji i drabinki w
  polach tekstowych.
- Panel turnieju nie pozwala zbudować systemu jedno-, dwu- lub trzyetapowego.
- Istniejący silnik generowania turniejów nie jest podłączony do formularza
  administratora.
- Wyniki ligowe są przechowywane osobno od meczów turniejowych. Nie ma jednego
  źródła danych dla tabel, kalendarza i stron rozgrywek.
- Mecz nie ma obowiązkowej daty, numeru kolejki ani wspólnego identyfikatora
  rozgrywek.
- Strona dyscypliny wyświetla pełne turnieje jeden pod drugim zamiast listy
  turniejów prowadzącej do osobnych stron.
- Formularz wyników wymaga powtarzania wyboru dyscypliny i pozwala budować
  kontekst meczu podczas wpisywania rezultatu.
- Klasyfikacja wszystkich drużyn jest myląca, ponieważ sumuje uczestników z
  nieporównywalnych poziomów.

## 2. Decyzje architektoniczne

1. Mecz jest jednym rekordem i jednym źródłem prawdy dla wyniku, tabeli,
   drabinki, ostatnich spotkań i kalendarza.
2. Administrator najpierw tworzy rozgrywki i terminarz, a wynik wpisuje do
   istniejącego meczu. Formularz wyniku nie tworzy dowolnej pary uczestników.
3. Turniej składa się z od jednego do trzech uporządkowanych etapów.
4. Etap może mieć typ:
   - `round_robin` - jedna tabela, każdy z każdym;
   - `groups` - kilka grup, każdy z każdym w grupie;
   - `knockout` - drabinka play-off.
5. Etapy przekazują uczestników dalej według jawnej reguły awansu.
6. Każdy poziom ligowy ma własną tabelę i własny terminarz.
7. Sortowanie tabeli jest wyłącznie widokiem. Oficjalna pozycja, awans,
   mistrzostwo i spadek nadal wynikają z regulaminowej kolejności.
8. Dyscyplina jest wybierana raz jako kontekst roboczy panelu i zapamiętywana.
   Wybrany turniej automatycznie określa dyscyplinę.
9. Daty spotkań są częścią rekordu meczu. Tylko datowane mecze trafiają do
   publicznego kalendarza.
10. Nie publikujemy zbiorczej tabeli drużyn ze wszystkich poziomów.

## 3. Docelowy model danych

### 3.1. Rozgrywki

Każda liga lub turniej otrzymuje rekord:

```text
competition:
  id
  slug
  name
  kind: league | tournament
  sport
  season
  participantType: team | player
  status: draft | published | ongoing | completed
  startDate
  endDate
  participantIds[]
  stages[]
```

### 3.2. Etap

```text
stage:
  id
  competitionId
  order
  name
  type: round_robin | groups | knockout
  participantIds[]
  level
  scoringProfile
  allowDraws
  pointsRules
  tieBreakOrder[]
  groupConfig
  qualificationRule
  status
```

### 3.3. Mecz

```text
match:
  id
  competitionId
  stageId
  groupId
  roundNumber
  roundLabel
  scheduledAt
  venue
  homeId
  awayId
  status: draft | scheduled | completed | walkover | cancelled | bye
  score
  sets[]
  winnerId
  mvpId
  nextMatchId
  nextSlot
```

### 3.4. Profile punktacji

- siatkówka do trzech wygranych setów;
- mecz do dwóch wygranych setów;
- dwa sety z dozwolonym remisem 1:1;
- konfigurowalna punktacja tabeli: wygrana, remis, porażka;
- osobna konfiguracja punktów ligowych 3:0/3:1, 3:2 i 2:3.

### 3.5. Migracja

- Podnieść `schemaVersion` do 3.
- Zamienić `sports.*.results` i zagnieżdżone mecze turniejowe na wspólną listę
  meczów.
- Zachować identyfikatory uczestników zamiast nazw jako relacje.
- Zachować wszystkie stare wyniki, sety, MVP i klasyfikacje.
- Dla starych meczów bez daty pozostawić `scheduledAt: null`; nie pokazywać ich
  w kalendarzu do czasu uzupełnienia daty.

## 4. Backlog wdrożeniowy

## Etap 0. Kontrakt i testy zabezpieczające

- [x] `T0.1` Zapisać testy odtwarzające błąd mieszania poziomów.
- [x] `T0.2` Zapisać testy tabel A, B, B-, C i D z drużynami bez rozegranego
  meczu.
- [x] `T0.3` Zapisać test tabeli uwzględniającej remis.
- [x] `T0.4` Zapisać test sortowania każdej kolumny i dynamicznej numeracji.
- [x] `T0.5` Zapisać test ostatniego meczu każdej drużyny.
- [x] `T0.6` Zapisać test daty, kolejki i obecności meczu w kalendarzu.
- [x] `T0.7` Zapisać scenariusze turniejów jedno-, dwu- i trzyetapowych.

Kryterium: nowe testy najpierw wykazują obecne błędy i opisują oczekiwane
zachowanie bez zmiany danych produkcyjnych.

## Etap 1. Jeden model rozgrywek i meczów

- [x] `T1.1` Dodać model `competitions`, `stages` i `matches`.
- [x] `T1.2` Oddzielić czyste funkcje modelu od renderowania w `script.js`.
- [x] `T1.3` Wprowadzić stabilne identyfikatory klubów, drużyn i zawodników we
  wszystkich meczach.
- [x] `T1.4` Dodać migrację danych V2 do V3.
- [x] `T1.5` Dodać walidację osieroconych uczestników i nieistniejących etapów.
- [x] `T1.6` Dodać datę, godzinę, miejsce i numer kolejki do meczu.
- [x] `T1.7` Usunąć podwójny zapis tego samego meczu w wynikach i drabince.

Kryterium: zmiana wyniku jednego rekordu aktualizuje tabelę, drabinkę, stronę
turnieju i kalendarz.

## Etap 2. Silnik etapów turniejowych

- [x] `T2.1` Zbudować generator jednego etapu każdy-z-każdym.
- [x] `T2.2` Zbudować generator wielu grup z jednym lub dwoma meczami każdej
  pary.
- [x] `T2.3` Zachować i rozszerzyć generator play-off z wolnymi losami.
- [x] `T2.4` Obsłużyć 1-3 etapy w dowolnej poprawnej kolejności.
- [x] `T2.5` Dodać awans: miejsca z grup, najlepsi z wielu grup, zwycięzcy grup,
  ręczne rozstawienie i wysoki kontra niski seed.
- [x] `T2.6` Generować kolejny etap dopiero po rozstrzygnięciu wymaganych
  spotkań poprzedniego etapu.
- [x] `T2.7` Automatycznie promować zwycięzcę meczu play-off.
- [x] `T2.8` Przy zmianie wcześniejszego wyniku ostrzegać i czyścić zależne,
  nierozgrywane jeszcze mecze.
- [x] `T2.9` Blokować zmianę wcześniejszego wyniku, jeśli zależny mecz ma już
  rezultat, dopóki administrator świadomie go nie wycofa.
- [x] `T2.10` Wyliczać klasyfikację końcową z ostatniego etapu, bez ręcznego
  wpisywania tekstu.

Kryterium: klasyfikacja, uczestnicy kolejnego etapu i drabinka wynikają wyłącznie
z konfiguracji oraz zapisanych rezultatów.

## Etap 3. Kreator turnieju administratora

- [x] `T3.1` Usunąć pola tekstowe klasyfikacji i drabinki.
- [x] `T3.2` Zbudować kreator krokowy:
  1. dane podstawowe;
  2. uczestnicy;
  3. liczba i typ etapów;
  4. zasady każdego etapu;
  5. daty i terminarz;
  6. podgląd oraz publikacja.
- [x] `T3.3` Pozwalać wybrać od jednego do trzech etapów.
- [x] `T3.4` Pokazywać tylko drużyny lub zawodników zgodnych z dyscypliną.
- [x] `T3.5` Dodać wybór losowania, ręcznego rozstawienia i rozstawienia z
  wyników poprzedniego etapu.
- [x] `T3.6` Dodać konfigurację grup, liczby meczów pary, awansu i tie-breaków.
- [x] `T3.7` Dodać profil wyniku i możliwość remisu wyłącznie dla dozwolonych
  etapów.
- [x] `T3.8` Dodać czytelny podgląd tabel, grup i drabinki przed publikacją.
- [x] `T3.9` Dodać osobny ekran zarządzania turniejem
  `admin-turniej.html?id=...`.
- [x] `T3.10` Dodać status szkicu, publikacji, trwania i zakończenia.

Kryterium: administrator tworzy kompletny turniej bez wpisywania struktury,
uczestników fazy finałowej ani klasyfikacji w polu tekstowym.

## Etap 4. Terminarz i logiczne wyniki

- [x] `T4.1` Rozdzielić tworzenie meczu od wpisywania wyniku.
- [x] `T4.2` Dla ligi dodać generator lub formularz terminarza oparty o:
  dyscyplinę, sezon, poziom, kolejkę, datę i uczestników.
- [x] `T4.3` W formularzu wyniku wybierać wyłącznie istniejący mecz.
- [x] `T4.4` Zapamiętywać ostatnią dyscyplinę panelu w `localStorage` i adresie
  URL.
- [x] `T4.5` Po wyborze turnieju automatycznie ustawiać dyscyplinę.
- [x] `T4.6` Po wyborze poziomu pokazywać wyłącznie mecze oraz drużyny tego
  poziomu.
- [x] `T4.7` Nie pokazywać tenisistów w siatkówce ani uczestników spoza
  rozgrywek.
- [x] `T4.8` Blokować mecz uczestnika z samym sobą i duplikat meczu w tej samej
  kolejce.
- [x] `T4.9` Generować pola setów z profilu punktacji, bez wpisywania wyniku
  tekstem.
- [x] `T4.10` Zawężać MVP do składów dwóch drużyn albo dwóch uczestników meczu.
- [x] `T4.11` Wymagać daty meczu przed opublikowaniem wyniku.
- [x] `T4.12` Umożliwić edycję wyniku bezpośrednio z meczu w drabince.

Kryterium: nie da się zapisać wyniku dla złego poziomu, dyscypliny, etapu,
uczestnika ani niedozwolonego formatu.

## Etap 5. Tabele, remis, sortowanie i numeracja

- [x] `T5.1` Renderować osobną tabelę dla każdego poziomu A, B, B-, C i D.
- [x] `T5.2` Usunąć tabelę łączącą drużyny z różnych poziomów.
- [x] `T5.3` Dodać kolumny: pozycja, drużyna, M, W, R, P, sety, bilans setów,
  małe punkty, bilans małych punktów i punkty.
- [x] `T5.4` Uwzględnić remisy zgodnie z profilem punktacji rozgrywek.
- [x] `T5.5` Zachować oficjalne tie-breaki: punkty, wygrane, wygrane sety,
  małe punkty i mecze bezpośrednie.
- [x] `T5.6` Dodać sortowanie rosnące i malejące po każdej statystyce.
- [x] `T5.7` Dodać `aria-sort`, obsługę klawiatury i czytelny wskaźnik kierunku.
- [x] `T5.8` Pokazywać oficjalną pozycję niezależnie od wybranego sortowania.
- [x] `T5.9` Numerować wszystkie zwykłe listy po aktualnym filtrowaniu i
  sortowaniu.
- [x] `T5.10` Awans, spadek i mistrzostwo liczyć według oficjalnej kolejności,
  nie według chwilowego sortowania widoku.
- [x] `T5.11` Pod tabelą poziomu pokazać najnowszy ukończony mecz każdej
  drużyny, połączyć duplikaty i sortować je po dacie malejąco.

Kryterium: żadna tabela nie miesza poziomów, remis zmienia właściwe statystyki,
a kliknięcie nagłówka sortuje bez utraty oficjalnej pozycji.

## Etap 6. Publiczne strony rozgrywek

- [x] `T6.1` Przebudować `klasyfikacje.html` na właściwą podstronę
  "Wyniki i tabele".
- [x] `T6.2` Dodać filtry dyscypliny, sezonu, rozgrywek i poziomu.
- [x] `T6.3` Na stronie dyscypliny wyświetlać tabele poziomów, a bezpośrednio
  pod nimi ostatnie mecze drużyn z tych poziomów.
- [x] `T6.4` Dodać `turnieje.html` z listą opublikowanych turniejów.
- [x] `T6.5` Każdy turniej kierować do `turniej.html?id=...`.
- [x] `T6.6` Na stronie turnieju pokazać:
  - informacje i daty;
  - uczestników;
  - wszystkie etapy;
  - tabele grupowe;
  - wyniki;
  - graficzną drabinkę;
  - klasyfikację końcową.
- [x] `T6.7` Na stronie dyscypliny pokazywać tylko karty turniejów, nie pełne
  drabinki wszystkich wydarzeń.
- [x] `T6.8` Dodać filtry i sortowanie także do publicznych tabel.
- [x] `T6.9` Usunąć hardkodowane przykładowe tabele z HTML; wszystkie widoki
  mają pochodzić ze wspólnych danych.
- [x] `T6.10` Zachować czytelny układ na 360, 768 i 1440 px.

Kryterium: liga, turnieje i pojedynczy turniej mają oddzielne, przewidywalne
adresy i nie powielają niespójnych danych.

## Etap 7. Kalendarz

- [x] `T7.1` Dodać `kalendarz.html`.
- [x] `T7.2` Zebrać w jednym strumieniu datowane mecze ligowe i turniejowe.
- [x] `T7.3` Grupować wydarzenia według dnia i miesiąca.
- [x] `T7.4` Dodać filtry: dyscyplina, liga/turniej, poziom, status i zakres dat.
- [x] `T7.5` Pokazać przeciwników, rozgrywki, etap, poziom, godzinę, miejsce i
  wynik albo status.
- [x] `T7.6` Z meczu turniejowego linkować do strony turnieju.
- [x] `T7.7` Z wyniku linkować do właściwej tabeli poziomu.
- [x] `T7.8` Dodać w panelu listę meczów bez daty wymagających uzupełnienia.

Kryterium: każdy datowany mecz występuje dokładnie raz w kalendarzu i prowadzi
do właściwego kontekstu.

## Etap 8. Klasyfikacja klubów

- [ ] `T8.1` Nie tworzyć rankingu wszystkich drużyn ze wszystkich poziomów.
- [ ] `T8.2` Jeśli ranking klubów pozostaje, sumować wyniki drużyn i zawodników
  przypisanych do klubu.
- [ ] `T8.3` Pokazać rozbicie punktów według rozgrywek i dyscyplin.
- [ ] `T8.4` Nie sumować różnych sportów do jednego wyniku bez jawnej,
  zatwierdzonej reguły normalizacji.
- [ ] `T8.5` Dodać filtr sezonu oraz dyscypliny.
- [ ] `T8.6` Opisać źródło każdej wartości i zapewnić możliwość przejścia do
  wyników składowych.

Kryterium: ranking klubu jest audytowalny i nie sugeruje, że drużyny z różnych
poziomów rywalizują w jednej tabeli.

## Etap 9. Regresja i publikacja

- [ ] `T9.1` Migracja V2 do V3 na kopii danych Supabase.
- [ ] `T9.2` Turniej: każdy-z-każdym.
- [ ] `T9.3` Turniej: grupy i play-off.
- [ ] `T9.4` Turniej trzyetapowy.
- [ ] `T9.5` Drabinki dla 4, 6, 8, 12 i 16 uczestników.
- [ ] `T9.6` Remis 1:1 w dozwolonej fazie i blokada remisu w play-off.
- [ ] `T9.7` Zmiana wyniku wcześniejszej rundy z kontrolą zależności.
- [ ] `T9.8` Tabele wszystkich poziomów i drużyny z zerowym dorobkiem.
- [ ] `T9.9` Sortowanie każdej kolumny i numeracja po filtrach.
- [ ] `T9.10` Kalendarz ligowy i turniejowy.
- [ ] `T9.11` Audyt wizualny 360, 768 i 1440 px.
- [ ] `T9.12` Test zapisu administratora i odczytu w drugiej sesji.
- [ ] `T9.13` Skan sekretów, składnia JavaScript, pełna regresja, commit i push.

## 5. Kolejność realizacji

1. Etap 0 - testy kontraktowe.
2. Etap 1 - model V3 i migracja.
3. Etap 2 - silnik etapów.
4. Etap 3 - kreator turnieju.
5. Etap 4 - terminarz i wyniki.
6. Etap 5 - tabele.
7. Etap 6 - strony publiczne.
8. Etap 7 - kalendarz.
9. Etap 8 - ranking klubów.
10. Etap 9 - regresja i publikacja.

## 6. Definicja ukończenia

System jest ukończony, gdy administrator tworzy rozgrywki bez pól tekstowych,
generuje logiczny terminarz, wpisuje wynik wyłącznie do istniejącego meczu,
a ten sam rekord aktualizuje tabelę, ostatnie wyniki, drabinkę, klasyfikację
turnieju i kalendarz. Publiczne tabele nigdy nie mieszają poziomów, a każdy
turniej ma własną stronę.

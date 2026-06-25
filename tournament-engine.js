(function (root) {
  const DEFAULT_TIE_BREAK_ORDER = [
    'points',
    'wins',
    'setsWon',
    'setDifference',
    'pointsFor',
    'pointDifference',
    'headToHead'
  ];

  function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
  }

  function shuffle(values, random = Math.random) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  function nextPowerOfTwo(value) {
    let size = 1;
    while (size < value) size *= 2;
    return size;
  }

  function parseScore(score) {
    const [home, away] = String(score || '0:0').split(':').map(Number);
    return {
      home: Number.isFinite(home) ? home : 0,
      away: Number.isFinite(away) ? away : 0
    };
  }

  function parseSetPairs(sets) {
    return String(sets || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => item.split(':').map(Number))
      .filter(pair => pair.length === 2 && pair.every(Number.isFinite));
  }

  function deriveScore(sets, fallback = '0:0') {
    const pairs = parseSetPairs(sets);
    if (!pairs.length) return fallback;
    let home = 0;
    let away = 0;
    pairs.forEach(([homePoints, awayPoints]) => {
      if (homePoints > awayPoints) home += 1;
      if (awayPoints > homePoints) away += 1;
    });
    return `${home}:${away}`;
  }

  function getRoundName(roundIndex, roundCount) {
    const remaining = roundCount - roundIndex;
    if (remaining === 1) return 'Finał';
    if (remaining === 2) return 'Półfinał';
    if (remaining === 3) return 'Ćwierćfinał';
    if (remaining === 4) return '1/8 finału';
    if (remaining === 5) return '1/16 finału';
    return roundIndex === 0 ? 'Runda wstępna' : `Runda ${roundIndex + 1}`;
  }

  function participantName(participantId, names = {}) {
    return names[participantId] || participantId || '';
  }

  function createMatch(tournamentId, roundIndex, matchIndex, roundCount) {
    return {
      id: `t${tournamentId}-r${roundIndex + 1}-m${matchIndex + 1}`,
      round: getRoundName(roundIndex, roundCount),
      roundIndex,
      matchIndex,
      homeId: '',
      awayId: '',
      home: '',
      away: '',
      score: '',
      sets: '',
      status: 'scheduled',
      phaseType: 'knockout',
      allowDraw: false,
      winnerId: '',
      winner: '',
      loserId: '',
      nextMatchId: '',
      nextSlot: '',
      sourceHomeMatchId: '',
      sourceAwayMatchId: '',
      isThirdPlace: false
    };
  }

  function setMatchSlot(match, slot, participantId, names) {
    const idKey = slot === 'home' ? 'homeId' : 'awayId';
    const nameKey = slot === 'home' ? 'home' : 'away';
    match[idKey] = participantId || '';
    match[nameKey] = participantName(participantId, names);
  }

  function getMatchById(bracket, matchId) {
    return bracket.find(match => match.id === matchId) || null;
  }

  function propagateWinner(bracket, match, participantId, names) {
    if (!match.nextMatchId || !participantId) return;
    const nextMatch = getMatchById(bracket, match.nextMatchId);
    if (!nextMatch) return;
    setMatchSlot(nextMatch, match.nextSlot, participantId, names);
  }

  function propagateSemifinalLoser(bracket, match, participantId, names) {
    if (!participantId) return;
    const thirdPlace = bracket.find(item => item.isThirdPlace);
    if (!thirdPlace) return;
    const semifinalMatches = bracket
      .filter(item => !item.isThirdPlace && item.round === 'Półfinał')
      .sort((a, b) => a.matchIndex - b.matchIndex);
    const semifinalIndex = semifinalMatches.findIndex(item => item.id === match.id);
    if (semifinalIndex === 0) setMatchSlot(thirdPlace, 'home', participantId, names);
    if (semifinalIndex === 1) setMatchSlot(thirdPlace, 'away', participantId, names);
  }

  function resolveAutomaticByes(bracket, names) {
    let changed = true;
    while (changed) {
      changed = false;
      bracket
        .filter(match => !match.isThirdPlace && match.status === 'scheduled')
        .forEach(match => {
          const hasHome = Boolean(match.homeId);
          const hasAway = Boolean(match.awayId);
          const homePending = Boolean(match.sourceHomeMatchId);
          const awayPending = Boolean(match.sourceAwayMatchId);
          const homeBye = hasHome && !hasAway && !awayPending;
          const awayBye = hasAway && !hasHome && !homePending;
          if (!homeBye && !awayBye) return;
          const winnerId = homeBye ? match.homeId : match.awayId;
          match.status = 'bye';
          match.winnerId = winnerId;
          match.winner = participantName(winnerId, names);
          match.score = 'BYE';
          propagateWinner(bracket, match, winnerId, names);
          changed = true;
        });
    }
  }

  function createKnockoutBracket(participantIds, options = {}) {
    const uniqueParticipants = unique(participantIds);
    if (uniqueParticipants.length < 2) {
      throw new Error('Faza play-off wymaga co najmniej dwóch uczestników.');
    }
    const tournamentId = options.tournamentId || 'new';
    const names = options.names || {};
    const seeding = options.seeding || 'manual';
    const ordered = seeding === 'random'
      ? shuffle(uniqueParticipants, options.random)
      : [...uniqueParticipants];
    const bracketSize = nextPowerOfTwo(ordered.length);
    const roundCount = Math.log2(bracketSize);
    const bracket = [];
    const rounds = [];

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      const matchCount = bracketSize / (2 ** (roundIndex + 1));
      const round = [];
      for (let matchIndex = 0; matchIndex < matchCount; matchIndex += 1) {
        const match = createMatch(tournamentId, roundIndex, matchIndex, roundCount);
        round.push(match);
        bracket.push(match);
      }
      rounds.push(round);
    }

    rounds.forEach((round, roundIndex) => {
      if (roundIndex === rounds.length - 1) return;
      round.forEach((match, matchIndex) => {
        const nextMatch = rounds[roundIndex + 1][Math.floor(matchIndex / 2)];
        const nextSlot = matchIndex % 2 === 0 ? 'home' : 'away';
        match.nextMatchId = nextMatch.id;
        match.nextSlot = nextSlot;
        if (nextSlot === 'home') nextMatch.sourceHomeMatchId = match.id;
        else nextMatch.sourceAwayMatchId = match.id;
      });
    });

    const firstRound = rounds[0];
    const byeCount = bracketSize - ordered.length;
    let participantIndex = 0;
    firstRound.forEach((match, matchIndex) => {
      if (matchIndex < byeCount) {
        setMatchSlot(match, 'home', ordered[participantIndex], names);
        participantIndex += 1;
        return;
      }
      setMatchSlot(match, 'home', ordered[participantIndex], names);
      setMatchSlot(match, 'away', ordered[participantIndex + 1], names);
      participantIndex += 2;
    });

    if (options.thirdPlaceMatch && roundCount >= 2) {
      const thirdPlace = createMatch(tournamentId, roundCount, 0, roundCount + 1);
      thirdPlace.id = `t${tournamentId}-third-place`;
      thirdPlace.round = 'Mecz o 3. miejsce';
      thirdPlace.isThirdPlace = true;
      const semifinals = bracket.filter(match => match.round === 'Półfinał');
      thirdPlace.sourceHomeMatchId = semifinals[0]?.id || '';
      thirdPlace.sourceAwayMatchId = semifinals[1]?.id || '';
      bracket.push(thirdPlace);
    }

    resolveAutomaticByes(bracket, names);
    return bracket;
  }

  function assertKnockoutResult(match, score, sets) {
    if (!match.homeId || !match.awayId) {
      throw new Error('Nie można zapisać wyniku przed ustaleniem obu uczestników.');
    }
    const parsed = parseScore(score || deriveScore(sets));
    if (parsed.home === parsed.away) {
      throw new Error('Mecz play-off nie może zakończyć się remisem.');
    }
    const pairs = parseSetPairs(sets);
    if (pairs.length !== parsed.home + parsed.away) {
      throw new Error(`Wynik ${score} wymaga ${parsed.home + parsed.away} wyników setów.`);
    }
    if (pairs.some(([homePoints, awayPoints]) => homePoints === awayPoints)) {
      throw new Error('Pojedynczy set nie może zakończyć się remisem.');
    }
    const derived = deriveScore(sets, score);
    if (derived !== score) {
      throw new Error('Wyniki setów nie zgadzają się z wynikiem meczu.');
    }
    return parsed;
  }

  function recordKnockoutResult(bracket, matchId, result, options = {}) {
    const match = getMatchById(bracket, matchId);
    if (!match) throw new Error('Nie znaleziono meczu w drabince.');
    if (match.status === 'bye') throw new Error('Nie można wpisać wyniku dla wolnego losu.');
    const parsed = assertKnockoutResult(match, result.score, result.sets);
    const winnerId = parsed.home > parsed.away ? match.homeId : match.awayId;
    const loserId = parsed.home > parsed.away ? match.awayId : match.homeId;
    const names = options.names || {};
    const oldWinnerId = match.winnerId;
    const nextMatch = match.nextMatchId ? getMatchById(bracket, match.nextMatchId) : null;
    const thirdPlace = match.round === 'Półfinał'
      ? bracket.find(item => item.isThirdPlace)
      : null;

    if (oldWinnerId && oldWinnerId !== winnerId && nextMatch) {
      if (nextMatch?.status === 'completed') {
        throw new Error('Nie można zmienić zwycięzcy, ponieważ kolejna runda ma już zapisany wynik.');
      }
    }
    if (oldWinnerId && oldWinnerId !== winnerId && thirdPlace?.status === 'completed') {
      throw new Error('Nie można zmienić półfinału, ponieważ mecz o trzecie miejsce ma już zapisany wynik.');
    }
    if (oldWinnerId && oldWinnerId !== winnerId && nextMatch) {
      setMatchSlot(nextMatch, match.nextSlot, '', names);
    }

    match.score = result.score;
    match.sets = result.sets || '';
    match.status = 'completed';
    match.winnerId = winnerId;
    match.winner = participantName(winnerId, names);
    match.loserId = loserId;
    match.mvp = result.mvp || '';
    propagateWinner(bracket, match, winnerId, names);
    if (match.round === 'Półfinał') propagateSemifinalLoser(bracket, match, loserId, names);
    resolveAutomaticByes(bracket, names);
    return match;
  }

  function resetMatchResult(match) {
    match.score = '';
    match.sets = '';
    match.status = 'scheduled';
    match.winnerId = '';
    match.winner = '';
    match.loserId = '';
    match.mvp = '';
    return match;
  }

  function clearKnockoutResult(bracket, matchId, options = {}) {
    const match = getMatchById(bracket, matchId);
    if (!match) throw new Error('Nie znaleziono meczu w drabince.');
    if (match.status === 'bye') throw new Error('Nie można wyczyścić wyniku wolnego losu.');
    const names = options.names || {};
    const nextMatch = match.nextMatchId ? getMatchById(bracket, match.nextMatchId) : null;
    const thirdPlace = match.round === 'Półfinał'
      ? bracket.find(item => item.isThirdPlace)
      : null;
    if (nextMatch && nextMatch.status !== 'scheduled') {
      throw new Error('Nie można wyczyścić wyniku, ponieważ kolejna runda została już rozstrzygnięta.');
    }
    if (thirdPlace && thirdPlace.status !== 'scheduled') {
      throw new Error('Nie można wyczyścić półfinału, ponieważ mecz o trzecie miejsce został już rozstrzygnięty.');
    }
    if (nextMatch && match.winnerId) {
      const slotId = match.nextSlot === 'home' ? nextMatch.homeId : nextMatch.awayId;
      if (slotId === match.winnerId) setMatchSlot(nextMatch, match.nextSlot, '', names);
    }
    if (thirdPlace && match.loserId) {
      const semifinals = bracket
        .filter(item => !item.isThirdPlace && item.round === 'Półfinał')
        .sort((a, b) => a.matchIndex - b.matchIndex);
      const semifinalIndex = semifinals.findIndex(item => item.id === match.id);
      const slot = semifinalIndex === 0 ? 'home' : semifinalIndex === 1 ? 'away' : '';
      if (slot) {
        const slotId = slot === 'home' ? thirdPlace.homeId : thirdPlace.awayId;
        if (slotId === match.loserId) setMatchSlot(thirdPlace, slot, '', names);
      }
    }
    return resetMatchResult(match);
  }

  function distributeParticipants(participantIds, groupCount, options = {}) {
    const participants = unique(participantIds);
    if (groupCount < 1 || groupCount > participants.length) {
      throw new Error('Nieprawidłowa liczba grup.');
    }
    const ordered = options.seeding === 'random'
      ? shuffle(participants, options.random)
      : [...participants];
    const groups = Array.from({ length: groupCount }, () => []);
    ordered.forEach((participantId, index) => {
      const cycle = Math.floor(index / groupCount);
      const position = index % groupCount;
      const groupIndex = cycle % 2 === 0 ? position : groupCount - position - 1;
      groups[groupIndex].push(participantId);
    });
    return groups;
  }

  function createRoundRobinMatches(group, options = {}) {
    const tournamentId = options.tournamentId || 'new';
    const names = options.names || {};
    const matchesPerPair = Number(options.matchesPerPair) === 2 ? 2 : 1;
    const matches = [];
    for (let homeIndex = 0; homeIndex < group.participantIds.length; homeIndex += 1) {
      for (let awayIndex = homeIndex + 1; awayIndex < group.participantIds.length; awayIndex += 1) {
        for (let leg = 1; leg <= matchesPerPair; leg += 1) {
          const firstId = group.participantIds[homeIndex];
          const secondId = group.participantIds[awayIndex];
          const homeId = leg === 1 ? firstId : secondId;
          const awayId = leg === 1 ? secondId : firstId;
          matches.push({
            id: `t${tournamentId}-${group.id}-m${matches.length + 1}`,
            groupId: group.id,
            leg,
            phaseType: 'group',
            homeId,
            awayId,
            home: participantName(homeId, names),
            away: participantName(awayId, names),
            score: '',
            sets: '',
            status: 'scheduled',
            allowDraw: options.allowDraws !== false,
            pointsRules: { ...(options.pointsRules || { win: 3, draw: 1, loss: 0 }) },
            winnerId: '',
            mvp: ''
          });
        }
      }
    }
    return matches;
  }

  function createGroupStage(participantIds, config = {}, options = {}) {
    const participants = unique(participantIds);
    const groupCount = Number(config.groupCount) || 1;
    const participantsPerGroup = Number(config.participantsPerGroup) || 0;
    if (participantsPerGroup && participantsPerGroup * groupCount !== participants.length) {
      throw new Error('Liczba uczestników nie odpowiada liczbie i wielkości grup.');
    }
    const distributed = options.manualGroups
      ? options.manualGroups.map(unique)
      : distributeParticipants(participants, groupCount, {
        seeding: options.seeding || 'random',
        random: options.random
      });
    const assigned = distributed.flat();
    if (assigned.length !== participants.length || unique(assigned).length !== participants.length) {
      throw new Error('Każdy uczestnik musi zostać przypisany dokładnie do jednej grupy.');
    }
    if (participants.some(participantId => !assigned.includes(participantId))) {
      throw new Error('W grupach brakuje zapisanego uczestnika.');
    }
    if (distributed.length !== groupCount) {
      throw new Error('Ręczny podział nie odpowiada wybranej liczbie grup.');
    }
    if (participantsPerGroup && distributed.some(group => group.length !== participantsPerGroup)) {
      throw new Error('Każda grupa musi mieć skonfigurowaną liczbę uczestników.');
    }
    return distributed.map((groupParticipantIds, index) => {
      const group = {
        id: `group-${index + 1}`,
        name: `Grupa ${String.fromCharCode(65 + index)}`,
        participantIds: groupParticipantIds,
        participants: groupParticipantIds.map(id => participantName(id, options.names)),
        matches: []
      };
      group.matches = createRoundRobinMatches(group, {
        tournamentId: options.tournamentId,
        names: options.names,
        matchesPerPair: config.matchesPerPair,
        allowDraws: options.allowDraws,
        pointsRules: options.pointsRules
      });
      return group;
    });
  }

  function recordGroupResult(group, matchId, result) {
    const match = group.matches.find(item => item.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu grupowego.');
    const score = parseScore(result.score || deriveScore(result.sets));
    if (score.home === score.away && result.score !== '1:1') {
      throw new Error('Dozwolonym remisem grupowym jest wyłącznie 1:1.');
    }
    if (score.home === score.away && !match.allowDraw) {
      throw new Error('Remis nie jest dozwolony w tej grupie.');
    }
    const pairs = parseSetPairs(result.sets);
    if (pairs.length !== score.home + score.away) {
      throw new Error(`Wynik ${result.score} wymaga ${score.home + score.away} wyników setów.`);
    }
    if (pairs.some(([homePoints, awayPoints]) => homePoints === awayPoints)) {
      throw new Error('Pojedynczy set nie może zakończyć się remisem.');
    }
    const derived = deriveScore(result.sets, result.score);
    if (derived !== result.score) {
      throw new Error('Wyniki setów nie zgadzają się z wynikiem meczu.');
    }
    match.score = result.score;
    match.sets = result.sets || '';
    match.status = 'completed';
    match.mvp = result.mvp || '';
    match.winnerId = score.home === score.away
      ? ''
      : score.home > score.away ? match.homeId : match.awayId;
    return match;
  }

  function clearGroupResult(group, matchId) {
    const match = group.matches.find(item => item.id === matchId);
    if (!match) throw new Error('Nie znaleziono meczu grupowego.');
    return resetMatchResult(match);
  }

  function createStandingRow(participantId) {
    return {
      participantId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      setDifference: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDifference: 0,
      points: 0,
      manualTieBreak: 0
    };
  }

  function applyGroupMatch(row, match, side) {
    const score = parseScore(match.score || deriveScore(match.sets));
    const own = side === 'home' ? score.home : score.away;
    const other = side === 'home' ? score.away : score.home;
    const rules = match.pointsRules || { win: 3, draw: 1, loss: 0 };
    row.played += 1;
    row.wins += own > other ? 1 : 0;
    row.draws += own === other ? 1 : 0;
    row.losses += own < other ? 1 : 0;
    row.setsWon += own;
    row.setsLost += other;
    row.points += own > other ? Number(rules.win) || 0
      : own === other ? Number(rules.draw) || 0
        : Number(rules.loss) || 0;
    parseSetPairs(match.sets).forEach(([homePoints, awayPoints]) => {
      row.pointsFor += side === 'home' ? homePoints : awayPoints;
      row.pointsAgainst += side === 'home' ? awayPoints : homePoints;
    });
    row.setDifference = row.setsWon - row.setsLost;
    row.pointDifference = row.pointsFor - row.pointsAgainst;
  }

  function calculateHeadToHead(group, participantIds) {
    const rows = new Map(participantIds.map(id => [id, createStandingRow(id)]));
    group.matches
      .filter(match => match.status === 'completed'
        && participantIds.includes(match.homeId)
        && participantIds.includes(match.awayId))
      .forEach(match => {
        applyGroupMatch(rows.get(match.homeId), match, 'home');
        applyGroupMatch(rows.get(match.awayId), match, 'away');
      });
    return rows;
  }

  function compareRows(a, b, tieBreakOrder, group, tiedIds) {
    for (const key of tieBreakOrder) {
      if (key === 'headToHead') {
        if (!tiedIds || tiedIds.length < 2) continue;
        const direct = calculateHeadToHead(group, tiedIds);
        const directA = direct.get(a.participantId);
        const directB = direct.get(b.participantId);
        const directDifference = (directB?.points || 0) - (directA?.points || 0)
          || (directB?.wins || 0) - (directA?.wins || 0)
          || (directB?.setDifference || 0) - (directA?.setDifference || 0)
          || (directB?.pointDifference || 0) - (directA?.pointDifference || 0);
        if (directDifference) return directDifference;
        continue;
      }
      const difference = (b[key] || 0) - (a[key] || 0);
      if (difference) return difference;
    }
    return (b.manualTieBreak || 0) - (a.manualTieBreak || 0)
      || String(a.participantId).localeCompare(String(b.participantId), 'pl');
  }

  function calculateGroupStandings(group, options = {}) {
    const tieBreakOrder = options.tieBreakOrder || DEFAULT_TIE_BREAK_ORDER;
    const rows = new Map(group.participantIds.map(id => [id, createStandingRow(id)]));
    const manualTieBreaks = options.manualTieBreaks || {};
    rows.forEach(row => {
      row.manualTieBreak = Number(manualTieBreaks[row.participantId]) || 0;
    });
    group.matches
      .filter(match => match.status === 'completed')
      .forEach(match => {
        if (!rows.has(match.homeId) || !rows.has(match.awayId)) return;
        applyGroupMatch(rows.get(match.homeId), match, 'home');
        applyGroupMatch(rows.get(match.awayId), match, 'away');
      });
    const values = [...rows.values()];
    const baseKeys = tieBreakOrder.filter(key => key !== 'headToHead' && key !== 'manualTieBreak');
    values.sort((a, b) => {
      const tiedIds = values
        .filter(row => baseKeys.every(key => (row[key] || 0) === (a[key] || 0)))
        .map(row => row.participantId);
      return compareRows(a, b, tieBreakOrder, group, tiedIds);
    });
    return values.map((row, index) => ({ ...row, position: index + 1 }));
  }

  function rankQualifiedParticipants(groups, qualifiersPerGroup, options = {}) {
    const qualified = [];
    groups.forEach((group, groupIndex) => {
      calculateGroupStandings(group, options)
        .slice(0, qualifiersPerGroup)
        .forEach(row => qualified.push({
          ...row,
          groupId: group.id,
          groupIndex,
          groupPosition: row.position
        }));
    });
    return qualified;
  }

  function orderQualifiedParticipants(qualified, pairingRule, manualOrder = []) {
    if (pairingRule === 'manual') {
      const order = unique(manualOrder);
      if (order.length !== qualified.length) {
        throw new Error('Ręczne parowanie wymaga wskazania wszystkich zakwalifikowanych uczestników.');
      }
      return order;
    }
    if (pairingRule === 'cross_groups') {
      const groupA = qualified.filter(item => item.groupIndex === 0);
      const groupB = qualified.filter(item => item.groupIndex === 1);
      if (groupA.length && groupA.length === groupB.length && groupA.length * 2 === qualified.length) {
        const sortedA = [...groupA].sort((a, b) => a.groupPosition - b.groupPosition);
        const sortedB = [...groupB].sort((a, b) => a.groupPosition - b.groupPosition);
        const order = [];
        sortedA.forEach((participant, index) => {
          const opponent = sortedB[sortedB.length - index - 1];
          if (index % 2 === 0) order.push(participant.participantId, opponent.participantId);
          else order.push(opponent.participantId, participant.participantId);
        });
        return order;
      }
    }
    const ranked = [...qualified].sort((a, b) => (
      a.groupPosition - b.groupPosition
      || b.points - a.points
      || b.wins - a.wins
      || b.setDifference - a.setDifference
      || b.pointDifference - a.pointDifference
    ));
    if (pairingRule === 'high_low' || pairingRule === 'group_result') {
      const ordered = [];
      while (ranked.length > 1) {
        ordered.push(ranked.shift().participantId, ranked.pop().participantId);
      }
      if (ranked.length) ordered.push(ranked[0].participantId);
      return ordered;
    }
    return ranked.map(item => item.participantId);
  }

  function createFinalStageFromGroups(tournament, options = {}) {
    const qualifiersPerGroup = Number(tournament.groupConfig?.qualifiersPerGroup) || 1;
    let qualified = rankQualifiedParticipants(
      tournament.groups,
      qualifiersPerGroup,
      { tieBreakOrder: tournament.groupConfig?.tieBreakOrder }
    );
    const finalParticipantCount = Number(tournament.finalStageConfig?.participantCount) || 0;
    if (finalParticipantCount && qualified.length > finalParticipantCount) {
      qualified = [...qualified]
        .sort((a, b) => (
          a.groupPosition - b.groupPosition
          || b.points - a.points
          || b.wins - a.wins
          || b.setDifference - a.setDifference
          || b.pointDifference - a.pointDifference
        ))
        .slice(0, finalParticipantCount);
    }
    const config = tournament.finalStageConfig || {};
    const participantIds = orderQualifiedParticipants(
      qualified,
      config.pairingRule || 'group_result',
      options.manualOrder
    );
    if (config.type === 'final_group' || tournament.format === 'groups_final_group') {
      const finalGroups = createGroupStage(participantIds, {
        groupCount: 1,
        matchesPerPair: 1
      }, {
        tournamentId: `${tournament.id}-final`,
        names: options.names,
        seeding: 'manual',
        allowDraws: tournament.allowDraws,
        pointsRules: tournament.pointsRules,
        manualGroups: [participantIds]
      });
      const finalGroup = finalGroups[0];
      finalGroup.id = `final-group-${tournament.id}`;
      finalGroup.name = 'Grupa finałowa';
      if (config.carryGroupResults) {
        const qualifiedSet = new Set(participantIds);
        tournament.groups.forEach(group => {
          group.matches
            .filter(match => match.status === 'completed'
              && qualifiedSet.has(match.homeId)
              && qualifiedSet.has(match.awayId))
            .forEach(match => {
              const target = finalGroup.matches.find(item => (
                (item.homeId === match.homeId && item.awayId === match.awayId)
                || (item.homeId === match.awayId && item.awayId === match.homeId)
              ));
              if (target) Object.assign(target, structuredClone(match), { id: target.id, groupId: finalGroup.id });
            });
        });
      }
      return { qualified, participantIds, finalGroup, bracket: [] };
    }
    const bracket = createKnockoutBracket(participantIds, {
      tournamentId: `${tournament.id}-final`,
      names: options.names,
      seeding: 'manual',
      thirdPlaceMatch: Boolean(config.thirdPlaceMatch)
    });
    return { qualified, participantIds, finalGroup: null, bracket };
  }

  function generateTournamentStructure(tournament, options = {}) {
    const participantIds = unique(tournament.participantIds);
    const names = options.names || {};
    if (tournament.format === 'knockout') {
      tournament.groups = [];
      tournament.bracket = createKnockoutBracket(participantIds, {
        tournamentId: tournament.id,
        names,
        seeding: tournament.seeding,
        random: options.random,
        thirdPlaceMatch: Boolean(tournament.finalStageConfig?.thirdPlaceMatch)
      });
      return tournament;
    }
    tournament.groups = createGroupStage(participantIds, tournament.groupConfig, {
      tournamentId: tournament.id,
      names,
      seeding: tournament.seeding,
      random: options.random,
      manualGroups: options.manualGroups,
      allowDraws: tournament.allowDraws,
      pointsRules: tournament.pointsRules
    });
    tournament.bracket = [];
    tournament.finalGroup = null;
    return tournament;
  }

  function canonicalSetScores(sets) {
    if (Array.isArray(sets)) {
      return sets.map(set => ({
        home: Number(set.home) || 0,
        away: Number(set.away) || 0
      }));
    }
    return parseSetPairs(sets).map(([home, away]) => ({ home, away }));
  }

  function canonicalSetsString(match) {
    if (typeof match.sets === 'string') return match.sets;
    return (match.setScores || [])
      .map(set => `${Number(set.home) || 0}:${Number(set.away) || 0}`)
      .join(', ');
  }

  function validateCompetitionStages(competition) {
    const stages = [...(competition.stages || [])].sort((a, b) => a.order - b.order);
    if (stages.length < 1 || stages.length > 3) {
      throw new Error('Rozgrywki muszą zawierać od jednego do trzech etapów.');
    }
    const allowedTypes = new Set(['round_robin', 'groups', 'knockout']);
    const ids = new Set();
    stages.forEach((stage, index) => {
      if (!stage.id || ids.has(stage.id)) throw new Error('Każdy etap musi mieć unikalny identyfikator.');
      ids.add(stage.id);
      if (!allowedTypes.has(stage.type)) throw new Error(`Nieobsługiwany typ etapu: ${stage.type}.`);
      if (Number(stage.order) !== index + 1) {
        throw new Error('Kolejność etapów musi być ciągła i zaczynać się od 1.');
      }
      if (index > 0 && !stage.qualificationRule) {
        throw new Error('Każdy kolejny etap wymaga jawnej reguły awansu.');
      }
    });
    return stages;
  }

  function competitionStageMatches(matches, stageId) {
    return (matches || []).filter(match => String(match.stageId) === String(stageId));
  }

  function toCanonicalMatch(match, competition, stage) {
    return {
      id: String(match.id),
      legacyId: null,
      competitionId: String(competition.id),
      stageId: String(stage.id),
      groupId: match.groupId ? String(match.groupId) : null,
      roundNumber: Number.isInteger(match.roundIndex) ? match.roundIndex + 1 : null,
      roundLabel: String(match.round || ''),
      matchIndex: Number(match.matchIndex) || 0,
      scheduledAt: null,
      venue: '',
      homeId: String(match.homeId || ''),
      awayId: String(match.awayId || ''),
      status: String(match.status || 'scheduled'),
      score: String(match.score || ''),
      setScores: canonicalSetScores(match.sets),
      winnerId: String(match.winnerId || ''),
      loserId: String(match.loserId || ''),
      mvpId: String(match.mvpId || ''),
      nextMatchId: String(match.nextMatchId || ''),
      nextSlot: String(match.nextSlot || ''),
      sourceHomeMatchId: String(match.sourceHomeMatchId || ''),
      sourceAwayMatchId: String(match.sourceAwayMatchId || ''),
      isThirdPlace: Boolean(match.isThirdPlace),
      allowDraw: typeof match.allowDraw === 'boolean' ? match.allowDraw : Boolean(stage.allowDraws),
      pointsRules: { ...(match.pointsRules || stage.pointsRules || { win: 3, draw: 1, loss: 0 }) },
      scoringProfile: String(match.scoring || stage.scoringProfile || 'sets')
    };
  }

  function toLegacyMatch(match, names = {}) {
    return {
      id: String(match.id),
      round: String(match.roundLabel || ''),
      roundIndex: match.roundNumber === null || match.roundNumber === undefined
        ? 0
        : Math.max(0, Number(match.roundNumber) - 1),
      matchIndex: Number(match.matchIndex) || 0,
      groupId: match.groupId || '',
      homeId: String(match.homeId || ''),
      awayId: String(match.awayId || ''),
      home: participantName(match.homeId, names),
      away: participantName(match.awayId, names),
      score: String(match.score || ''),
      sets: canonicalSetsString(match),
      status: String(match.status || 'scheduled'),
      phaseType: match.phaseType || '',
      allowDraw: Boolean(match.allowDraw),
      pointsRules: { ...(match.pointsRules || { win: 3, draw: 1, loss: 0 }) },
      winnerId: String(match.winnerId || ''),
      winner: participantName(match.winnerId, names),
      loserId: String(match.loserId || ''),
      nextMatchId: String(match.nextMatchId || ''),
      nextSlot: String(match.nextSlot || ''),
      sourceHomeMatchId: String(match.sourceHomeMatchId || ''),
      sourceAwayMatchId: String(match.sourceAwayMatchId || ''),
      isThirdPlace: Boolean(match.isThirdPlace),
      mvp: String(match.mvpId || '')
    };
  }

  function syncCanonicalMatches(canonicalMatches, legacyMatches) {
    const canonicalById = new Map(canonicalMatches.map(match => [String(match.id), match]));
    legacyMatches.forEach(legacy => {
      const match = canonicalById.get(String(legacy.id));
      if (!match) return;
      match.roundNumber = Number(legacy.roundIndex) + 1;
      match.roundLabel = String(legacy.round || '');
      match.matchIndex = Number(legacy.matchIndex) || 0;
      match.groupId = legacy.groupId || null;
      match.homeId = String(legacy.homeId || '');
      match.awayId = String(legacy.awayId || '');
      match.status = String(legacy.status || 'scheduled');
      match.score = String(legacy.score || '');
      match.setScores = canonicalSetScores(legacy.sets);
      match.winnerId = String(legacy.winnerId || '');
      match.loserId = String(legacy.loserId || '');
      match.mvpId = String(legacy.mvp || '');
      match.nextMatchId = String(legacy.nextMatchId || '');
      match.nextSlot = String(legacy.nextSlot || '');
      match.sourceHomeMatchId = String(legacy.sourceHomeMatchId || '');
      match.sourceAwayMatchId = String(legacy.sourceAwayMatchId || '');
      match.isThirdPlace = Boolean(legacy.isThirdPlace);
    });
  }

  function generateStageMatches(competition, stage, participantIds, options = {}) {
    const participants = unique(participantIds);
    if (participants.length < 2) throw new Error('Etap wymaga co najmniej dwóch uczestników.');
    stage.participantIds = [...participants];
    stage.status = 'ongoing';
    const names = options.names || {};
    if (stage.type === 'knockout') {
      stage.groups = [];
      return createKnockoutBracket(participants, {
        tournamentId: stage.id,
        names,
        seeding: options.seeding || stage.seeding || 'manual',
        random: options.random,
        thirdPlaceMatch: Boolean(stage.groupConfig?.thirdPlaceMatch || stage.thirdPlaceMatch)
      }).map(match => toCanonicalMatch(match, competition, stage));
    }

    const isRoundRobin = stage.type === 'round_robin';
    const groupConfig = isRoundRobin
      ? {
        groupCount: 1,
        participantsPerGroup: participants.length,
        matchesPerPair: Number(stage.groupConfig?.matchesPerPair) === 2 ? 2 : 1
      }
      : {
        ...(stage.groupConfig || {}),
        groupCount: Number(stage.groupConfig?.groupCount) || 1,
        matchesPerPair: Number(stage.groupConfig?.matchesPerPair) === 2 ? 2 : 1
      };
    const manualGroups = isRoundRobin
      ? [participants]
      : options.manualGroups;
    const groups = createGroupStage(participants, groupConfig, {
      tournamentId: stage.id,
      names,
      seeding: options.seeding || stage.seeding || 'manual',
      random: options.random,
      manualGroups,
      allowDraws: Boolean(stage.allowDraws),
      pointsRules: stage.pointsRules
    });
    stage.groups = groups.map(group => ({
      id: group.id,
      name: group.name,
      participantIds: [...group.participantIds],
      manualTieBreaks: {}
    }));
    return groups.flatMap(group => group.matches.map(match => toCanonicalMatch(match, competition, stage)));
  }

  function generateCompetitionStructure(competition, matches, options = {}) {
    const stages = validateCompetitionStages(competition);
    const retained = (matches || []).filter(match => String(match.competitionId) !== String(competition.id));
    matches.splice(0, matches.length, ...retained);
    stages.forEach((stage, index) => {
      stage.status = index === 0 ? 'ongoing' : 'draft';
      stage.participantIds = index === 0 ? unique(competition.participantIds) : [];
      stage.groups = [];
    });
    const generated = generateStageMatches(
      competition,
      stages[0],
      competition.participantIds,
      {
        ...options,
        manualGroups: options.manualGroups?.[stages[0].id] || options.manualGroups
      }
    );
    matches.push(...generated);
    competition.finalClassification = [];
    return generated;
  }

  function groupViewForStage(stage, matches, group) {
    return {
      id: group.id,
      name: group.name,
      participantIds: [...group.participantIds],
      manualTieBreaks: { ...(group.manualTieBreaks || {}) },
      matches: competitionStageMatches(matches, stage.id)
        .filter(match => String(match.groupId) === String(group.id))
        .map(match => toLegacyMatch(match))
    };
  }

  function calculateStageStandings(stage, matches) {
    if (stage.type === 'knockout') return [];
    return (stage.groups || []).map((group, groupIndex) => {
      const view = groupViewForStage(stage, matches, group);
      return {
        groupId: group.id,
        groupIndex,
        rows: calculateGroupStandings(view, {
          tieBreakOrder: stage.tieBreakOrder,
          manualTieBreaks: group.manualTieBreaks
        })
      };
    });
  }

  function isTerminalMatch(match) {
    return ['completed', 'walkover', 'bye', 'cancelled'].includes(match.status);
  }

  function isStageComplete(stage, matches) {
    const stageMatches = competitionStageMatches(matches, stage.id);
    return stageMatches.length > 0 && stageMatches.every(isTerminalMatch);
  }

  function calculateKnockoutClassification(stage, matches) {
    const stageMatches = competitionStageMatches(matches, stage.id);
    if (!stageMatches.length || !isStageComplete(stage, matches)) return [];
    const mainMatches = stageMatches.filter(match => !match.isThirdPlace);
    const finalRound = Math.max(...mainMatches.map(match => Number(match.roundNumber) || 0));
    const final = mainMatches.find(match => Number(match.roundNumber) === finalRound);
    if (!final?.winnerId || !final?.loserId) return [];
    const ordered = [final.winnerId, final.loserId];
    const thirdPlace = stageMatches.find(match => match.isThirdPlace);
    if (thirdPlace?.winnerId) ordered.push(thirdPlace.winnerId);
    if (thirdPlace?.loserId) ordered.push(thirdPlace.loserId);
    mainMatches
      .filter(match => match.id !== final.id && match.loserId)
      .sort((left, right) => (
        (Number(right.roundNumber) || 0) - (Number(left.roundNumber) || 0)
        || (Number(left.matchIndex) || 0) - (Number(right.matchIndex) || 0)
      ))
      .forEach(match => ordered.push(match.loserId));
    stage.participantIds.forEach(participantId => ordered.push(participantId));
    return unique(ordered).map((participantId, index) => ({
      participantId,
      position: index + 1,
      groupPosition: index + 1,
      points: 0,
      wins: 0,
      setDifference: 0,
      pointDifference: 0
    }));
  }

  function rankStageParticipants(stage, matches) {
    if (stage.type === 'knockout') return calculateKnockoutClassification(stage, matches);
    return calculateStageStandings(stage, matches)
      .flatMap(group => group.rows.map(row => ({
        ...row,
        groupId: group.groupId,
        groupIndex: group.groupIndex,
        groupPosition: row.position
      })));
  }

  function sortOverallRank(rows) {
    return [...rows].sort((left, right) => (
      (right.points || 0) - (left.points || 0)
      || (right.wins || 0) - (left.wins || 0)
      || (right.setDifference || 0) - (left.setDifference || 0)
      || (right.pointDifference || 0) - (left.pointDifference || 0)
      || String(left.participantId).localeCompare(String(right.participantId), 'pl')
    ));
  }

  function resolveQualifiedParticipants(previousStage, nextStage, matches, options = {}) {
    if (!isStageComplete(previousStage, matches)) {
      throw new Error('Nie można wygenerować kolejnego etapu przed zakończeniem poprzedniego.');
    }
    const ranked = rankStageParticipants(previousStage, matches);
    const rule = nextStage.qualificationRule || {};
    let qualified;
    if (rule.type === 'manual') {
      qualified = unique(options.manualOrder || rule.participantIds);
      const eligible = new Set(previousStage.participantIds);
      if (!qualified.length || qualified.some(participantId => !eligible.has(participantId))) {
        throw new Error('Ręczny awans zawiera uczestnika spoza poprzedniego etapu.');
      }
      return qualified;
    }
    if (rule.type === 'places_per_group') {
      const count = Math.max(1, Number(rule.count) || 1);
      qualified = ranked.filter(row => row.groupPosition <= count);
    } else if (rule.type === 'group_winners') {
      qualified = ranked.filter(row => row.groupPosition === 1);
    } else if (rule.type === 'best_overall') {
      qualified = sortOverallRank(ranked).slice(0, Math.max(1, Number(rule.count) || 1));
    } else if (rule.type === 'stage_positions') {
      const positions = new Set((rule.positions || []).map(Number));
      const overall = previousStage.type === 'knockout'
        ? ranked
        : sortOverallRank(ranked).map((row, index) => ({ ...row, position: index + 1 }));
      qualified = overall.filter(row => positions.has(Number(row.position)));
    } else if (rule.type === 'all') {
      qualified = ranked;
    } else {
      throw new Error(`Nieobsługiwana reguła awansu: ${rule.type || 'brak'}.`);
    }
    if (!qualified.length) throw new Error('Reguła awansu nie wyłoniła żadnego uczestnika.');

    const pairingRule = rule.pairingRule || nextStage.seeding || 'group_result';
    if (pairingRule === 'random') {
      return shuffle(qualified.map(row => row.participantId), options.random);
    }
    if (pairingRule === 'manual') {
      return orderQualifiedParticipants(qualified, 'manual', options.manualOrder || rule.manualOrder);
    }
    if (nextStage.type === 'knockout') {
      return orderQualifiedParticipants(qualified, pairingRule, options.manualOrder);
    }
    return qualified.map(row => row.participantId);
  }

  function resetLaterStages(competition, matches, stageOrder) {
    const laterStageIds = new Set(
      competition.stages
        .filter(stage => Number(stage.order) > Number(stageOrder))
        .map(stage => String(stage.id))
    );
    const removed = matches.filter(match => laterStageIds.has(String(match.stageId)));
    const retained = matches.filter(match => !laterStageIds.has(String(match.stageId)));
    matches.splice(0, matches.length, ...retained);
    competition.stages
      .filter(stage => laterStageIds.has(String(stage.id)))
      .forEach(stage => {
        stage.status = 'draft';
        stage.participantIds = [];
        stage.groups = [];
      });
    competition.finalClassification = [];
    return removed.map(match => match.id);
  }

  function dependencyClosure(matches, matchId) {
    const result = new Set();
    const queue = [String(matchId)];
    while (queue.length) {
      const sourceId = queue.shift();
      matches.forEach(match => {
        const depends = String(match.sourceHomeMatchId || '') === sourceId
          || String(match.sourceAwayMatchId || '') === sourceId
          || String(matches.find(source => String(source.id) === sourceId)?.nextMatchId || '') === String(match.id);
        if (!depends || result.has(String(match.id))) return;
        result.add(String(match.id));
        queue.push(String(match.id));
      });
    }
    return result;
  }

  function inspectMatchChange(competition, matches, matchId, result = {}) {
    const match = matches.find(item => String(item.id) === String(matchId));
    if (!match) throw new Error('Nie znaleziono meczu.');
    const stage = competition.stages.find(item => String(item.id) === String(match.stageId));
    if (!stage) throw new Error('Mecz nie ma prawidłowego etapu.');
    const nextScore = String(result.score ?? match.score ?? '');
    const nextSets = result.setScores
      ? canonicalSetsString({ setScores: result.setScores })
      : String(result.sets ?? canonicalSetsString(match));
    const changed = nextScore !== String(match.score || '')
      || nextSets !== canonicalSetsString(match);
    const directIds = dependencyClosure(competitionStageMatches(matches, stage.id), match.id);
    const laterStageIds = new Set(competition.stages
      .filter(item => Number(item.order) > Number(stage.order))
      .map(item => String(item.id)));
    const dependentMatches = matches.filter(item => (
      directIds.has(String(item.id))
      || laterStageIds.has(String(item.stageId))
    ));
    const completedDependencies = dependentMatches.filter(item => (
      ['completed', 'walkover'].includes(item.status)
    ));
    return {
      match,
      stage,
      changed,
      dependentMatches,
      completedDependencies,
      requiresReset: changed && dependentMatches.length > 0,
      blocked: changed && completedDependencies.length > 0
    };
  }

  function resetKnockoutDependencies(matches, sourceMatchId) {
    const stageMatches = matches.filter(match => match.stageId === matches
      .find(item => String(item.id) === String(sourceMatchId))?.stageId);
    const affectedIds = dependencyClosure(stageMatches, sourceMatchId);
    const affectedSources = new Set([String(sourceMatchId), ...affectedIds]);
    stageMatches
      .filter(match => affectedIds.has(String(match.id)))
      .sort((left, right) => (Number(right.roundNumber) || 0) - (Number(left.roundNumber) || 0))
      .forEach(match => {
        if (affectedSources.has(String(match.sourceHomeMatchId || ''))) match.homeId = '';
        if (affectedSources.has(String(match.sourceAwayMatchId || ''))) match.awayId = '';
        match.score = '';
        match.setScores = [];
        match.status = 'scheduled';
        match.winnerId = '';
        match.loserId = '';
        match.mvpId = '';
      });
    return [...affectedIds];
  }

  function generateNextStage(competition, matches, completedStageId, options = {}) {
    const stages = validateCompetitionStages(competition);
    const currentIndex = stages.findIndex(stage => String(stage.id) === String(completedStageId));
    if (currentIndex < 0) throw new Error('Nie znaleziono zakończonego etapu.');
    const currentStage = stages[currentIndex];
    if (!isStageComplete(currentStage, matches)) {
      throw new Error('Nie można wygenerować kolejnego etapu przed zakończeniem poprzedniego.');
    }
    currentStage.status = 'completed';
    const nextStage = stages[currentIndex + 1];
    if (!nextStage) return [];
    const existing = competitionStageMatches(matches, nextStage.id);
    if (existing.length) return existing;
    const participantIds = resolveQualifiedParticipants(currentStage, nextStage, matches, options);
    const generated = generateStageMatches(competition, nextStage, participantIds, {
      ...options,
      manualGroups: options.manualGroups?.[nextStage.id] || options.manualGroups
    });
    matches.push(...generated);
    return generated;
  }

  function calculateFinalClassification(competition, matches, options = {}) {
    const stages = validateCompetitionStages(competition);
    const finalStage = stages[stages.length - 1];
    if (!isStageComplete(finalStage, matches)) return [];
    let ranked = rankStageParticipants(finalStage, matches);
    if (finalStage.type !== 'knockout') {
      if ((finalStage.groups || []).length === 1) {
        ranked = ranked.sort((left, right) => left.groupPosition - right.groupPosition);
      } else {
        ranked = [...ranked].sort((left, right) => (
          left.groupPosition - right.groupPosition
          || (right.points || 0) - (left.points || 0)
          || (right.wins || 0) - (left.wins || 0)
          || (right.setDifference || 0) - (left.setDifference || 0)
          || (right.pointDifference || 0) - (left.pointDifference || 0)
        ));
      }
    }
    const names = options.names || {};
    const clubs = options.clubs || {};
    competition.finalClassification = ranked.map((row, index) => ({
      place: index + 1,
      participantId: row.participantId,
      participant: names[row.participantId] || row.participantId,
      club: clubs[row.participantId] || ''
    }));
    competition.status = 'completed';
    finalStage.status = 'completed';
    return competition.finalClassification;
  }

  function applyCompetitionResult(competition, matches, matchId, result, options = {}) {
    const inspection = inspectMatchChange(competition, matches, matchId, result);
    if (inspection.blocked && !options.forceResetDownstream) {
      const error = new Error('Nie można zmienić wyniku, ponieważ zależny mecz lub etap ma już rezultat.');
      error.code = 'DOWNSTREAM_COMPLETED';
      error.dependencies = inspection.completedDependencies.map(match => match.id);
      throw error;
    }
    const resetMatchIds = [];
    if (inspection.changed && inspection.dependentMatches.length) {
      if (inspection.stage.type === 'knockout') {
        resetMatchIds.push(...resetKnockoutDependencies(matches, matchId));
      }
      resetMatchIds.push(...resetLaterStages(competition, matches, inspection.stage.order));
    }

    const stageMatches = competitionStageMatches(matches, inspection.stage.id);
    const names = options.names || {};
    const normalizedResult = {
      ...result,
      sets: result.sets || canonicalSetsString({ setScores: result.setScores || [] }),
      mvp: result.mvpId || result.mvp || ''
    };
    if (inspection.stage.type === 'knockout') {
      const legacyMatches = stageMatches.map(match => toLegacyMatch(match, names));
      recordKnockoutResult(legacyMatches, matchId, normalizedResult, { names });
      syncCanonicalMatches(stageMatches, legacyMatches);
    } else {
      const groupMatches = stageMatches.filter(match => String(match.groupId) === String(inspection.match.groupId));
      const legacyMatches = groupMatches.map(match => toLegacyMatch(match, names));
      recordGroupResult({ matches: legacyMatches }, matchId, normalizedResult);
      syncCanonicalMatches(groupMatches, legacyMatches);
    }

    const updated = matches.find(match => String(match.id) === String(matchId));
    if (result.mvpId !== undefined) updated.mvpId = String(result.mvpId || '');
    let generatedMatches = [];
    let finalClassification = [];
    if (isStageComplete(inspection.stage, matches)) {
      generatedMatches = generateNextStage(competition, matches, inspection.stage.id, options);
      if (!generatedMatches.length
          && Number(inspection.stage.order) === Math.max(...competition.stages.map(stage => Number(stage.order)))) {
        finalClassification = calculateFinalClassification(competition, matches, options);
      }
    }
    return { match: updated, resetMatchIds: unique(resetMatchIds), generatedMatches, finalClassification };
  }

  function clearCompetitionMatchResult(competition, matches, matchId, options = {}) {
    const inspection = inspectMatchChange(competition, matches, matchId, { score: '', sets: '' });
    if (inspection.blocked && !options.forceResetDownstream) {
      const error = new Error('Nie można wycofać wyniku, ponieważ zależny mecz lub etap ma już rezultat.');
      error.code = 'DOWNSTREAM_COMPLETED';
      error.dependencies = inspection.completedDependencies.map(match => match.id);
      throw error;
    }
    const resetMatchIds = [];
    if (inspection.stage.type === 'knockout') {
      resetMatchIds.push(...resetKnockoutDependencies(matches, matchId));
      const stageMatches = competitionStageMatches(matches, inspection.stage.id);
      const legacyMatches = stageMatches.map(match => toLegacyMatch(match, options.names));
      clearKnockoutResult(legacyMatches, matchId, { names: options.names });
      syncCanonicalMatches(stageMatches, legacyMatches);
    } else {
      const groupMatches = competitionStageMatches(matches, inspection.stage.id)
        .filter(match => String(match.groupId) === String(inspection.match.groupId));
      const legacyMatches = groupMatches.map(match => toLegacyMatch(match, options.names));
      clearGroupResult({ matches: legacyMatches }, matchId);
      syncCanonicalMatches(groupMatches, legacyMatches);
    }
    resetMatchIds.push(...resetLaterStages(competition, matches, inspection.stage.order));
    inspection.stage.status = 'ongoing';
    competition.status = 'ongoing';
    competition.finalClassification = [];
    return {
      match: matches.find(match => String(match.id) === String(matchId)),
      resetMatchIds: unique(resetMatchIds)
    };
  }

  const api = {
    shuffle,
    nextPowerOfTwo,
    parseScore,
    parseSetPairs,
    deriveScore,
    createKnockoutBracket,
    recordKnockoutResult,
    clearKnockoutResult,
    createGroupStage,
    createRoundRobinMatches,
    recordGroupResult,
    clearGroupResult,
    calculateGroupStandings,
    rankQualifiedParticipants,
    orderQualifiedParticipants,
    createFinalStageFromGroups,
    generateTournamentStructure,
    validateCompetitionStages,
    competitionStageMatches,
    generateStageMatches,
    generateCompetitionStructure,
    calculateStageStandings,
    isStageComplete,
    rankStageParticipants,
    resolveQualifiedParticipants,
    inspectMatchChange,
    generateNextStage,
    calculateFinalClassification,
    applyCompetitionResult,
    clearCompetitionMatchResult
  };

  root.tournamentEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

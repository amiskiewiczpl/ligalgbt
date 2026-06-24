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
    generateTournamentStructure
  };

  root.tournamentEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

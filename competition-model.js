(function (root) {
  const SCHEMA_VERSION = 3;
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

  function slugify(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'rozgrywki';
  }

  function participantTypeForSport(data, sportKey) {
    return data.sports?.[sportKey]?.type === 'team' ? 'team' : 'player';
  }

  function participantReference(data, sportKey, name) {
    const type = participantTypeForSport(data, sportKey);
    const source = type === 'team' ? data.clubTeams : data.players;
    const participant = (source || []).find(item => item.name === name);
    return participant ? `${type}:${participant.id}` : '';
  }

  function participantName(data, reference) {
    const [type, rawId] = String(reference || '').split(':');
    const id = Number(rawId);
    if (!Number.isFinite(id)) return '';
    const source = type === 'team' ? data.clubTeams : type === 'player' ? data.players : [];
    return (source || []).find(item => Number(item.id) === id)?.name || '';
  }

  function playerReference(data, name) {
    const player = (data.players || []).find(item => item.name === name);
    return player ? `player:${player.id}` : '';
  }

  function parseSetScores(value) {
    if (Array.isArray(value)) {
      return value.map(set => ({
        home: Number(set.home) || 0,
        away: Number(set.away) || 0
      }));
    }
    return String(value || '')
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .map(item => {
        const [home, away] = item.split(':').map(Number);
        return {
          home: Number.isFinite(home) ? home : 0,
          away: Number.isFinite(away) ? away : 0
        };
      });
  }

  function stringifySetScores(value) {
    return (Array.isArray(value) ? value : [])
      .map(set => `${Number(set.home) || 0}:${Number(set.away) || 0}`)
      .join(', ');
  }

  function normalizeDateTime(value) {
    if (!value) return null;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }

  function stagePhaseType(stage) {
    if (!stage) return 'league';
    if (stage.role === 'final_group') return 'final_group';
    if (stage.type === 'knockout') return 'knockout';
    if (stage.type === 'groups') return 'group';
    return stage.competitionKind === 'league' ? 'league' : 'group';
  }

  function normalizeStage(stage, competition, index) {
    const type = ['round_robin', 'groups', 'knockout'].includes(stage?.type)
      ? stage.type
      : 'round_robin';
    return {
      id: String(stage?.id || `stage:${competition.id}:${index + 1}`),
      competitionId: String(competition.id),
      order: Number(stage?.order) || index + 1,
      name: String(stage?.name || `Etap ${index + 1}`),
      type,
      role: String(stage?.role || ''),
      seeding: ['manual', 'random', 'high_low', 'group_result', 'cross_groups'].includes(stage?.seeding)
        ? stage.seeding
        : 'manual',
      thirdPlaceMatch: Boolean(stage?.thirdPlaceMatch),
      level: String(stage?.level || ''),
      scoringProfile: String(stage?.scoringProfile || stage?.scoring || 'sets'),
      allowDraws: Boolean(stage?.allowDraws),
      pointsRules: {
        win: Number(stage?.pointsRules?.win ?? 3),
        draw: Number(stage?.pointsRules?.draw ?? 1),
        loss: Number(stage?.pointsRules?.loss ?? 0)
      },
      tieBreakOrder: Array.isArray(stage?.tieBreakOrder)
        ? [...stage.tieBreakOrder]
        : [...DEFAULT_TIE_BREAK_ORDER],
      groupConfig: stage?.groupConfig && typeof stage.groupConfig === 'object'
        ? structuredClone(stage.groupConfig)
        : null,
      qualificationRule: stage?.qualificationRule && typeof stage.qualificationRule === 'object'
        ? structuredClone(stage.qualificationRule)
        : null,
      status: ['draft', 'scheduled', 'ongoing', 'completed'].includes(stage?.status)
        ? stage.status
        : 'scheduled',
      participantIds: unique(stage?.participantIds),
      groups: Array.isArray(stage?.groups)
        ? stage.groups.map((group, groupIndex) => ({
          id: String(group.id || `group:${competition.id}:${index + 1}:${groupIndex + 1}`),
          name: String(group.name || `Grupa ${groupIndex + 1}`),
          participantIds: unique(group.participantIds),
          manualTieBreaks: group.manualTieBreaks && typeof group.manualTieBreaks === 'object'
            ? { ...group.manualTieBreaks }
            : {}
        }))
        : []
    };
  }

  function normalizeCompetition(competition, index) {
    const id = String(competition?.id || `competition:${index + 1}`);
    const kind = competition?.kind === 'league' ? 'league' : 'tournament';
    const normalized = {
      id,
      legacyId: competition?.legacyId ?? null,
      slug: String(competition?.slug || slugify(competition?.name || id)),
      name: String(competition?.name || `Rozgrywki ${index + 1}`),
      kind,
      sport: String(competition?.sport || ''),
      season: String(competition?.season || new Date().getFullYear()),
      participantType: competition?.participantType === 'team' ? 'team' : 'player',
      status: ['draft', 'published', 'planned', 'ongoing', 'completed'].includes(competition?.status)
        ? competition.status
        : 'draft',
      startDate: normalizeDateTime(competition?.startDate),
      endDate: normalizeDateTime(competition?.endDate),
      participantIds: unique(competition?.participantIds),
      stages: [],
      finalClassification: Array.isArray(competition?.finalClassification)
        ? structuredClone(competition.finalClassification)
        : [],
      legacyFormat: String(competition?.legacyFormat || competition?.format || 'knockout'),
      seeding: String(competition?.seeding || 'manual'),
      groupConfig: competition?.groupConfig && typeof competition.groupConfig === 'object'
        ? structuredClone(competition.groupConfig)
        : {},
      finalStageConfig: competition?.finalStageConfig && typeof competition.finalStageConfig === 'object'
        ? structuredClone(competition.finalStageConfig)
        : {}
    };
    normalized.stages = (Array.isArray(competition?.stages) ? competition.stages : [])
      .map((stage, stageIndex) => normalizeStage(stage, normalized, stageIndex))
      .sort((left, right) => left.order - right.order);
    return normalized;
  }

  function normalizeMatch(match, data, index) {
    const competition = (data.competitions || []).find(item => String(item.id) === String(match?.competitionId));
    const stage = competition?.stages.find(item => String(item.id) === String(match?.stageId));
    const normalized = {
      id: String(match?.id || `match:${index + 1}`),
      legacyId: match?.legacyId ?? null,
      competitionId: String(match?.competitionId || ''),
      stageId: String(match?.stageId || ''),
      groupId: match?.groupId ? String(match.groupId) : null,
      roundNumber: match?.roundNumber !== null
        && match?.roundNumber !== undefined
        && Number.isInteger(Number(match.roundNumber))
        ? Number(match.roundNumber)
        : null,
      roundLabel: String(match?.roundLabel || match?.round || ''),
      matchIndex: Number.isInteger(Number(match?.matchIndex)) ? Number(match.matchIndex) : 0,
      scheduledAt: normalizeDateTime(match?.scheduledAt),
      venue: String(match?.venue || ''),
      homeId: String(match?.homeId || ''),
      awayId: String(match?.awayId || ''),
      status: ['draft', 'scheduled', 'completed', 'walkover', 'cancelled', 'bye'].includes(match?.status)
        ? match.status
        : (match?.score || match?.sets || match?.setScores?.length ? 'completed' : 'scheduled'),
      score: String(match?.score || ''),
      setScores: parseSetScores(match?.setScores ?? match?.sets),
      winnerId: String(match?.winnerId || ''),
      mvpId: String(match?.mvpId || ''),
      nextMatchId: String(match?.nextMatchId || ''),
      nextSlot: String(match?.nextSlot || ''),
      sourceHomeMatchId: String(match?.sourceHomeMatchId || ''),
      sourceAwayMatchId: String(match?.sourceAwayMatchId || ''),
      loserId: String(match?.loserId || ''),
      isThirdPlace: Boolean(match?.isThirdPlace),
      allowDraw: typeof match?.allowDraw === 'boolean'
        ? match.allowDraw
        : Boolean(stage?.allowDraws),
      pointsRules: match?.pointsRules && typeof match.pointsRules === 'object'
        ? {
          win: Number(match.pointsRules.win ?? 3),
          draw: Number(match.pointsRules.draw ?? 1),
          loss: Number(match.pointsRules.loss ?? 0)
        }
        : structuredClone(stage?.pointsRules || { win: 3, draw: 1, loss: 0 }),
      scoringProfile: String(match?.scoringProfile || match?.scoring || stage?.scoringProfile || 'sets')
    };
    if (!normalized.winnerId && normalized.status === 'completed' && normalized.score) {
      const [homeScore, awayScore] = normalized.score.split(':').map(Number);
      if (Number.isFinite(homeScore) && Number.isFinite(awayScore) && homeScore !== awayScore) {
        normalized.winnerId = homeScore > awayScore ? normalized.homeId : normalized.awayId;
      }
    }
    return normalized;
  }

  function defineLegacyProperty(target, key, getter, setter) {
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: false,
      get: getter,
      set: setter
    });
  }

  function findCompetition(data, id) {
    return (data.competitions || []).find(item => String(item.id) === String(id)) || null;
  }

  function findStage(data, stageId) {
    for (const competition of data.competitions || []) {
      const stage = competition.stages.find(item => String(item.id) === String(stageId));
      if (stage) return { competition, stage };
    }
    return { competition: null, stage: null };
  }

  function matchesForCompetition(data, competitionId) {
    return (data.matches || []).filter(match => String(match.competitionId) === String(competitionId));
  }

  function matchesForStage(data, stageId) {
    return (data.matches || []).filter(match => String(match.stageId) === String(stageId));
  }

  function replaceMatches(data, predicate, replacements, defaults = {}) {
    const retained = (data.matches || []).filter(match => !predicate(match));
    const normalized = (replacements || []).map((match, index) => normalizeMatch({
      ...match,
      ...defaults,
      id: match.id || `${defaults.stageId || 'match'}:${index + 1}`
    }, data, retained.length + index));
    data.matches = [...retained, ...normalized];
    installMatchViews(data);
    return normalized;
  }

  function installMatchView(data, match) {
    const resolveSport = () => findCompetition(data, match.competitionId)?.sport || '';
    defineLegacyProperty(match, 'home', () => participantName(data, match.homeId), value => {
      match.homeId = participantReference(data, resolveSport(), value);
    });
    defineLegacyProperty(match, 'away', () => participantName(data, match.awayId), value => {
      match.awayId = participantReference(data, resolveSport(), value);
    });
    defineLegacyProperty(match, 'winner', () => participantName(data, match.winnerId), value => {
      match.winnerId = participantReference(data, resolveSport(), value);
    });
    defineLegacyProperty(match, 'mvp', () => participantName(data, match.mvpId), value => {
      match.mvpId = playerReference(data, value);
    });
    defineLegacyProperty(match, 'sets', () => stringifySetScores(match.setScores), value => {
      match.setScores = parseSetScores(value);
    });
    defineLegacyProperty(match, 'scoring', () => match.scoringProfile, value => {
      match.scoringProfile = String(value || 'sets');
    });
    defineLegacyProperty(match, 'phaseType', () => {
      const { competition, stage } = findStage(data, match.stageId);
      return competition?.kind === 'league' ? 'league' : stagePhaseType(stage);
    });
    defineLegacyProperty(match, 'level', () => findStage(data, match.stageId).stage?.level || '', value => {
      const stage = findStage(data, match.stageId).stage;
      if (stage) stage.level = String(value || '');
    });
    defineLegacyProperty(match, 'round', () => match.roundLabel, value => {
      match.roundLabel = String(value || '');
    });
    defineLegacyProperty(match, 'roundIndex', () => (
      match.roundNumber === null ? 0 : Math.max(0, match.roundNumber - 1)
    ), value => {
      match.roundNumber = Number(value) + 1;
    });
  }

  function installMatchViews(data) {
    (data.matches || []).forEach(match => installMatchView(data, match));
  }

  function materializeGroup(data, stage, group) {
    const view = {
      id: group.id,
      name: group.name,
      participantIds: group.participantIds,
      participants: group.participantIds.map(reference => participantName(data, reference)),
      manualTieBreaks: group.manualTieBreaks
    };
    defineLegacyProperty(view, 'matches', () => (
      matchesForStage(data, stage.id).filter(match => String(match.groupId) === String(group.id))
    ), replacements => {
      replaceMatches(
        data,
        match => String(match.stageId) === String(stage.id) && String(match.groupId) === String(group.id),
        replacements,
        { competitionId: stage.competitionId, stageId: stage.id, groupId: group.id }
      );
    });
    return view;
  }

  function installTournamentView(data, competition) {
    defineLegacyProperty(competition, 'format', () => competition.legacyFormat, value => {
      competition.legacyFormat = String(value || 'knockout');
    });
    defineLegacyProperty(competition, 'participants', () => (
      competition.participantIds.map(reference => participantName(data, reference))
    ), values => {
      competition.participantIds = unique(
        (values || []).map(name => participantReference(data, competition.sport, name))
      );
    });
    defineLegacyProperty(competition, 'scoring', () => competition.stages[0]?.scoringProfile || 'sets');
    defineLegacyProperty(competition, 'pointsRules', () => (
      competition.stages[0]?.pointsRules || { win: 3, draw: 1, loss: 0 }
    ), value => {
      competition.stages.forEach(stage => {
        stage.pointsRules = {
          win: Number(value?.win ?? 3),
          draw: Number(value?.draw ?? 1),
          loss: Number(value?.loss ?? 0)
        };
      });
    });
    defineLegacyProperty(competition, 'allowDraws', () => (
      competition.stages.some(stage => stage.allowDraws)
    ), value => {
      competition.stages.forEach(stage => {
        if (stage.type !== 'knockout') stage.allowDraws = Boolean(value);
      });
    });
    defineLegacyProperty(competition, 'bracket', () => {
      const stage = competition.stages.find(item => item.type === 'knockout');
      return stage ? matchesForStage(data, stage.id) : [];
    }, replacements => {
      let stage = competition.stages.find(item => item.type === 'knockout');
      if (!stage) {
        stage = normalizeStage({
          id: `stage:${competition.id}:knockout`,
          order: competition.stages.length + 1,
          name: 'Play-off',
          type: 'knockout',
          scoringProfile: 'sets'
        }, competition, competition.stages.length);
        competition.stages.push(stage);
      }
      replaceMatches(
        data,
        match => String(match.stageId) === String(stage.id),
        replacements,
        { competitionId: competition.id, stageId: stage.id }
      );
    });
    defineLegacyProperty(competition, 'groups', () => {
      const stage = competition.stages.find(item => item.type === 'groups' && item.role !== 'final_group');
      return stage ? stage.groups.map(group => materializeGroup(data, stage, group)) : [];
    }, groups => {
      let stage = competition.stages.find(item => item.type === 'groups' && item.role !== 'final_group');
      if (!stage) {
        stage = normalizeStage({
          id: `stage:${competition.id}:groups`,
          order: 1,
          name: 'Faza grupowa',
          type: 'groups'
        }, competition, 0);
        competition.stages.unshift(stage);
      }
      stage.groups = (groups || []).map((group, index) => ({
        id: String(group.id || `group:${competition.id}:${index + 1}`),
        name: String(group.name || `Grupa ${index + 1}`),
        participantIds: unique(
          group.participantIds?.length
            ? group.participantIds
            : (group.participants || []).map(name => participantReference(data, competition.sport, name))
        ),
        manualTieBreaks: { ...(group.manualTieBreaks || {}) }
      }));
      replaceMatches(
        data,
        match => String(match.stageId) === String(stage.id),
        (groups || []).flatMap((group, groupIndex) => (group.matches || []).map(match => ({
          ...match,
          groupId: stage.groups[groupIndex].id
        }))),
        { competitionId: competition.id, stageId: stage.id }
      );
    });
    defineLegacyProperty(competition, 'finalGroup', () => {
      const stage = competition.stages.find(item => item.role === 'final_group');
      if (!stage) return null;
      const group = stage.groups[0] || {
        id: `group:${competition.id}:final`,
        name: 'Grupa finalowa',
        participantIds: competition.participantIds,
        manualTieBreaks: {}
      };
      return materializeGroup(data, stage, group);
    }, group => {
      competition.stages = competition.stages.filter(item => item.role !== 'final_group');
      if (!group) return;
      const stage = normalizeStage({
        id: `stage:${competition.id}:final-group`,
        order: competition.stages.length + 1,
        name: group.name || 'Grupa finalowa',
        type: 'round_robin',
        role: 'final_group',
        allowDraws: true,
        groups: [{
          id: group.id || `group:${competition.id}:final`,
          name: group.name || 'Grupa finalowa',
          participantIds: group.participantIds?.length
            ? group.participantIds
            : (group.participants || []).map(name => participantReference(data, competition.sport, name))
        }]
      }, competition, competition.stages.length);
      competition.stages.push(stage);
      replaceMatches(
        data,
        match => String(match.stageId) === String(stage.id),
        group.matches || [],
        { competitionId: competition.id, stageId: stage.id, groupId: stage.groups[0].id }
      );
    });
  }

  function installLegacyViews(data) {
    installMatchViews(data);
    Object.entries(data.sports || {}).forEach(([sportKey, sport]) => {
      defineLegacyProperty(sport, 'results', () => {
        const ids = (data.competitions || [])
          .filter(competition => competition.kind === 'league' && competition.sport === sportKey)
          .map(competition => String(competition.id));
        return (data.matches || []).filter(match => ids.includes(String(match.competitionId)));
      }, replacements => {
        const oldIds = new Set((data.competitions || [])
          .filter(competition => competition.kind === 'league' && competition.sport === sportKey)
          .map(competition => String(competition.id)));
        data.matches = (data.matches || []).filter(match => !oldIds.has(String(match.competitionId)));
        (replacements || []).forEach(match => {
          const level = String(match.level || '');
          const competition = ensureLeagueCompetition(data, sportKey, level);
          const normalizedMatch = normalizeMatch({
            ...match,
            id: match.id || `match:league:${sportKey}:${level || 'open'}:${data.matches.length + 1}`,
            competitionId: competition.id,
            stageId: competition.stages[0].id,
            homeId: match.homeId || participantReference(data, sportKey, match.home),
            awayId: match.awayId || participantReference(data, sportKey, match.away),
            mvpId: match.mvpId || playerReference(data, match.mvp)
          }, data, data.matches.length);
          data.matches.push(normalizedMatch);
          competition.participantIds = unique([
            ...competition.participantIds,
            normalizedMatch.homeId,
            normalizedMatch.awayId
          ]);
        });
        installMatchViews(data);
      });
    });
    (data.competitions || [])
      .filter(competition => competition.kind === 'tournament')
      .forEach(competition => installTournamentView(data, competition));
    defineLegacyProperty(data, 'tournaments', () => (
      (data.competitions || []).filter(competition => competition.kind === 'tournament')
    ), replacements => {
      const currentMatches = [...(data.matches || [])];
      const leagueCompetitions = (data.competitions || []).filter(competition => competition.kind === 'league');
      const canonicalTournaments = (replacements || [])
        .filter(tournament => tournament?.kind === 'tournament' && Array.isArray(tournament.stages))
        .map(normalizeCompetition);
      const canonicalIds = new Set(canonicalTournaments.map(tournament => String(tournament.id)));
      const leagueIds = new Set(leagueCompetitions.map(competition => String(competition.id)));
      data.competitions = [...leagueCompetitions, ...canonicalTournaments];
      data.matches = currentMatches.filter(match => (
        leagueIds.has(String(match.competitionId))
        || canonicalIds.has(String(match.competitionId))
      ));
      (replacements || [])
        .filter(tournament => !(tournament?.kind === 'tournament' && Array.isArray(tournament.stages)))
        .forEach((tournament, index) => {
          const converted = convertLegacyTournament(data, tournament, index);
          data.competitions.push(converted.competition);
          data.matches.push(...converted.matches);
        });
      installLegacyViews(data);
    });
  }

  function ensureLeagueCompetition(data, sportKey, level = '', season = '') {
    const normalizedLevel = String(level || '');
    const normalizedSeason = String(season || new Date().getFullYear());
    let competition = (data.competitions || []).find(item => (
      item.kind === 'league'
      && item.sport === sportKey
      && String(item.season) === normalizedSeason
      && item.stages[0]?.level === normalizedLevel
    ));
    if (competition) return competition;
    const levelSlug = slugify(normalizedLevel || 'open');
    const seasonSlug = slugify(normalizedSeason);
    const id = `competition:league:${sportKey}:${seasonSlug}:${levelSlug}`;
    competition = normalizeCompetition({
      id,
      slug: `liga-${sportKey}-${seasonSlug}-${levelSlug}`,
      name: `${data.sports?.[sportKey]?.name || sportKey}${normalizedLevel ? ` - poziom ${normalizedLevel}` : ''} (${normalizedSeason})`,
      kind: 'league',
      sport: sportKey,
      season: normalizedSeason,
      participantType: participantTypeForSport(data, sportKey),
      status: 'ongoing',
      participantIds: [],
      stages: [{
        id: `stage:league:${sportKey}:${levelSlug}`,
        order: 1,
        name: normalizedLevel ? `Poziom ${normalizedLevel}` : 'Liga',
        type: 'round_robin',
        level: normalizedLevel,
        scoringProfile: data.sports?.[sportKey]?.defaultScoring || 'sets',
        allowDraws: false,
        pointsRules: { win: 3, draw: 0, loss: 0 },
        status: 'ongoing'
      }]
    }, data.competitions.length);
    data.competitions.push(competition);
    return competition;
  }

  function convertLegacyLeagueMatches(data) {
    const matches = [];
    Object.entries(data.sports || {}).forEach(([sportKey, sport]) => {
      const legacyResults = Array.isArray(sport.results) ? [...sport.results] : [];
      legacyResults.forEach((match, index) => {
        const competition = ensureLeagueCompetition(data, sportKey, match.level || '');
        const normalized = normalizeMatch({
          ...match,
          id: `match:league:${sportKey}:${match.level || 'open'}:${match.id || index + 1}`,
          legacyId: match.id ?? null,
          competitionId: competition.id,
          stageId: competition.stages[0].id,
          homeId: match.homeId || participantReference(data, sportKey, match.home),
          awayId: match.awayId || participantReference(data, sportKey, match.away),
          mvpId: match.mvpId || playerReference(data, match.mvp),
          scheduledAt: match.scheduledAt || null,
          roundNumber: match.roundNumber ?? null
        }, data, matches.length);
        matches.push(normalized);
        competition.participantIds = unique([
          ...competition.participantIds,
          normalized.homeId,
          normalized.awayId
        ]);
      });
      delete sport.results;
    });
    return matches;
  }

  function legacyTournamentStages(data, tournament, competitionId) {
    const stages = [];
    if ((tournament.groups || []).length) {
      stages.push({
        id: `stage:${competitionId}:groups`,
        order: stages.length + 1,
        name: 'Faza grupowa',
        type: 'groups',
        role: 'groups',
        scoringProfile: tournament.scoring || 'sets',
        allowDraws: Boolean(tournament.allowDraws),
        pointsRules: tournament.pointsRules,
        tieBreakOrder: tournament.groupConfig?.tieBreakOrder,
        groupConfig: tournament.groupConfig,
        status: tournament.status === 'completed' ? 'completed' : 'ongoing',
        groups: (tournament.groups || []).map((group, index) => ({
          id: group.id || `group:${competitionId}:${index + 1}`,
          name: group.name || `Grupa ${index + 1}`,
          participantIds: unique(
            group.participantIds?.length
              ? group.participantIds
              : (group.participants || []).map(name => participantReference(data, tournament.sport, name))
          )
        }))
      });
    }
    if (tournament.finalGroup) {
      stages.push({
        id: `stage:${competitionId}:final-group`,
        order: stages.length + 1,
        name: tournament.finalGroup.name || 'Grupa finalowa',
        type: 'round_robin',
        role: 'final_group',
        scoringProfile: tournament.scoring || 'sets',
        allowDraws: Boolean(tournament.allowDraws),
        pointsRules: tournament.pointsRules,
        status: tournament.status === 'completed' ? 'completed' : 'ongoing',
        groups: [{
          id: tournament.finalGroup.id || `group:${competitionId}:final`,
          name: tournament.finalGroup.name || 'Grupa finalowa',
          participantIds: unique(
            tournament.finalGroup.participantIds?.length
              ? tournament.finalGroup.participantIds
              : (tournament.finalGroup.participants || [])
                .map(name => participantReference(data, tournament.sport, name))
          )
        }]
      });
    }
    if ((tournament.bracket || []).length || tournament.format === 'knockout' || tournament.format === 'groups_knockout') {
      stages.push({
        id: `stage:${competitionId}:knockout`,
        order: stages.length + 1,
        name: 'Play-off',
        type: 'knockout',
        role: 'knockout',
        seeding: tournament.seeding || 'manual',
        thirdPlaceMatch: Boolean(tournament.finalStageConfig?.thirdPlaceMatch),
        scoringProfile: tournament.scoring || 'sets',
        allowDraws: false,
        pointsRules: tournament.pointsRules,
        status: tournament.status === 'completed' ? 'completed' : 'ongoing'
      });
    }
    if (!stages.length) {
      stages.push({
        id: `stage:${competitionId}:1`,
        order: 1,
        name: 'Turniej',
        type: 'round_robin',
        scoringProfile: tournament.scoring || 'sets',
        allowDraws: Boolean(tournament.allowDraws)
      });
    }
    return stages;
  }

  function convertLegacyTournament(data, tournament, index) {
    const legacyId = tournament.id ?? index + 1;
    const competitionId = String(tournament.competitionId || `competition:tournament:${legacyId}`);
    const inferredParticipantNames = unique([
      ...(tournament.participants || []),
      ...(tournament.finalClassification || []).map(row => row.participant),
      ...(tournament.bracket || []).flatMap(match => [match.home, match.away]),
      ...(tournament.groups || []).flatMap(group => [
        ...(group.participants || []),
        ...(group.matches || []).flatMap(match => [match.home, match.away])
      ]),
      ...(tournament.finalGroup?.participants || []),
      ...(tournament.finalGroup?.matches || []).flatMap(match => [match.home, match.away])
    ]);
    const participantIds = unique(
      tournament.participantIds?.length
        ? tournament.participantIds
        : inferredParticipantNames.map(name => participantReference(data, tournament.sport, name))
    );
    const competition = normalizeCompetition({
      id: competitionId,
      legacyId,
      slug: tournament.slug || slugify(tournament.name),
      name: tournament.name,
      kind: 'tournament',
      sport: tournament.sport,
      participantType: tournament.participantType || participantTypeForSport(data, tournament.sport),
      status: tournament.status || 'planned',
      startDate: tournament.startDate || null,
      endDate: tournament.endDate || null,
      participantIds,
      stages: legacyTournamentStages(data, tournament, competitionId),
      finalClassification: tournament.finalClassification,
      legacyFormat: tournament.format,
      seeding: tournament.seeding,
      groupConfig: tournament.groupConfig,
      finalStageConfig: tournament.finalStageConfig
    }, index);
    const matches = [];
    const groupStage = competition.stages.find(stage => stage.role === 'groups');
    (tournament.groups || []).forEach((group, groupIndex) => {
      (group.matches || []).forEach((match, matchIndex) => {
        matches.push(normalizeMatch({
          ...match,
          id: String(match.id || `match:tournament:${legacyId}:group:${groupIndex + 1}:${matchIndex + 1}`),
          competitionId,
          stageId: groupStage.id,
          groupId: groupStage.groups[groupIndex]?.id || group.id,
          homeId: match.homeId || participantReference(data, tournament.sport, match.home),
          awayId: match.awayId || participantReference(data, tournament.sport, match.away),
          mvpId: match.mvpId || playerReference(data, match.mvp)
        }, { ...data, competitions: [...data.competitions, competition] }, matches.length));
      });
    });
    const finalStage = competition.stages.find(stage => stage.role === 'final_group');
    (tournament.finalGroup?.matches || []).forEach((match, matchIndex) => {
      matches.push(normalizeMatch({
        ...match,
        id: String(match.id || `match:tournament:${legacyId}:final-group:${matchIndex + 1}`),
        competitionId,
        stageId: finalStage.id,
        groupId: finalStage.groups[0].id,
        homeId: match.homeId || participantReference(data, tournament.sport, match.home),
        awayId: match.awayId || participantReference(data, tournament.sport, match.away),
        mvpId: match.mvpId || playerReference(data, match.mvp)
      }, { ...data, competitions: [...data.competitions, competition] }, matches.length));
    });
    const knockoutStage = competition.stages.find(stage => stage.role === 'knockout');
    const roundOrder = unique((tournament.bracket || []).map(match => match.round || 'Runda'));
    const roundMatchCounts = new Map();
    (tournament.bracket || []).forEach((match, matchIndex) => {
      const roundLabel = match.round || 'Runda';
      const roundIndex = Number.isInteger(match.roundIndex)
        ? match.roundIndex
        : roundOrder.indexOf(roundLabel);
      const indexInRound = Number.isInteger(match.matchIndex)
        ? match.matchIndex
        : (roundMatchCounts.get(roundLabel) || 0);
      roundMatchCounts.set(roundLabel, indexInRound + 1);
      matches.push(normalizeMatch({
        ...match,
        id: String(match.id || `match:tournament:${legacyId}:knockout:${matchIndex + 1}`),
        competitionId,
        stageId: knockoutStage.id,
        roundNumber: roundIndex + 1,
        roundLabel,
        matchIndex: indexInRound,
        homeId: match.homeId || participantReference(data, tournament.sport, match.home),
        awayId: match.awayId || participantReference(data, tournament.sport, match.away),
        winnerId: match.winnerId || participantReference(data, tournament.sport, match.winner),
        mvpId: match.mvpId || playerReference(data, match.mvp)
      }, { ...data, competitions: [...data.competitions, competition] }, matches.length));
    });
    return { competition, matches };
  }

  function migrateV2ToV3(data) {
    data.competitions = [];
    data.matches = [];
    data.matches.push(...convertLegacyLeagueMatches(data));
    const legacyTournaments = Array.isArray(data.tournaments) ? [...data.tournaments] : [];
    legacyTournaments.forEach((tournament, index) => {
      const converted = convertLegacyTournament(data, tournament, index);
      data.competitions.push(converted.competition);
      data.matches.push(...converted.matches);
    });
    delete data.tournaments;
    data.schemaVersion = SCHEMA_VERSION;
    return normalizeData(data);
  }

  function validateData(data) {
    const errors = [];
    const competitionIds = new Set();
    const stageIds = new Set();
    const participantIds = new Set([
      ...(data.clubTeams || []).map(team => `team:${team.id}`),
      ...(data.players || []).map(player => `player:${player.id}`)
    ]);
    (data.competitions || []).forEach(competition => {
      if (competitionIds.has(competition.id)) errors.push(`Duplicate competition: ${competition.id}`);
      competitionIds.add(competition.id);
      competition.stages.forEach(stage => {
        if (stageIds.has(stage.id)) errors.push(`Duplicate stage: ${stage.id}`);
        stageIds.add(stage.id);
        if (stage.competitionId !== competition.id) errors.push(`Stage ${stage.id} has invalid competition`);
      });
      competition.participantIds.forEach(reference => {
        if (!participantIds.has(reference)) errors.push(`Competition ${competition.id} has orphan participant ${reference}`);
      });
    });
    const matchIds = new Set();
    (data.matches || []).forEach(match => {
      if (matchIds.has(match.id)) errors.push(`Duplicate match: ${match.id}`);
      matchIds.add(match.id);
      if (!competitionIds.has(match.competitionId)) errors.push(`Match ${match.id} has orphan competition`);
      if (!stageIds.has(match.stageId)) errors.push(`Match ${match.id} has orphan stage`);
      if (match.homeId && !participantIds.has(match.homeId)) errors.push(`Match ${match.id} has orphan home participant`);
      if (match.awayId && !participantIds.has(match.awayId)) errors.push(`Match ${match.id} has orphan away participant`);
      const competition = (data.competitions || [])
        .find(item => String(item.id) === String(match.competitionId));
      if (match.homeId && competition && !competition.participantIds.includes(match.homeId)) {
        errors.push(`Match ${match.id} has home participant outside competition`);
      }
      if (match.awayId && competition && !competition.participantIds.includes(match.awayId)) {
        errors.push(`Match ${match.id} has away participant outside competition`);
      }
      if (match.homeId && match.homeId === match.awayId) errors.push(`Match ${match.id} has identical participants`);
      if (match.scheduledAt && !normalizeDateTime(match.scheduledAt)) errors.push(`Match ${match.id} has invalid date`);
    });
    return errors;
  }

  function normalizeData(data) {
    if (!Array.isArray(data.competitions)) data.competitions = [];
    data.competitions = data.competitions.map(normalizeCompetition);
    if (!Array.isArray(data.matches)) data.matches = [];
    data.matches = data.matches.map((match, index) => normalizeMatch(match, data, index));
    data.schemaVersion = SCHEMA_VERSION;
    installLegacyViews(data);
    return data;
  }

  const api = {
    SCHEMA_VERSION,
    DEFAULT_TIE_BREAK_ORDER,
    slugify,
    participantReference,
    participantName,
    parseSetScores,
    stringifySetScores,
    normalizeDateTime,
    normalizeData,
    normalizeCompetition,
    normalizeMatch,
    ensureLeagueCompetition,
    matchesForCompetition,
    matchesForStage,
    validateData,
    migrateV2ToV3,
    installLegacyViews
  };

  root.competitionModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);

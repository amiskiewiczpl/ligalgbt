const assert = require('node:assert/strict');
const engine = require('../tournament-engine.js');

function names(ids) {
  return Object.fromEntries(ids.map(id => [id, `Participant ${id}`]));
}

const ids = ['p1', 'p2', 'p3', 'p4'];
const participantNames = names(ids);
const bracket = engine.createKnockoutBracket(ids, {
  tournamentId: 91,
  names: participantNames,
  seeding: 'manual'
});
const semifinal = bracket.find(match => match.roundIndex === 0);
const final = bracket.find(match => match.roundIndex === 1);

engine.recordKnockoutResult(bracket, semifinal.id, {
  score: '2:0',
  sets: '21:14, 21:17',
  mvp: 'Participant p1'
}, { names: participantNames });
assert.equal(final.homeId, semifinal.winnerId);

engine.clearKnockoutResult(bracket, semifinal.id, { names: participantNames });
assert.equal(semifinal.status, 'scheduled');
assert.equal(semifinal.score, '');
assert.equal(semifinal.mvp, '');
assert.equal(final.homeId, '');

const [group] = engine.createGroupStage(['p1', 'p2'], {
  groupCount: 1,
  matchesPerPair: 1
}, {
  tournamentId: 92,
  names: participantNames,
  seeding: 'manual',
  allowDraws: true
});
const groupMatch = group.matches[0];
engine.recordGroupResult(group, groupMatch.id, {
  score: '1:1',
  sets: '21:18, 17:21',
  mvp: 'Participant p2'
});
engine.clearGroupResult(group, groupMatch.id);
assert.equal(groupMatch.status, 'scheduled');
assert.equal(groupMatch.score, '');
assert.equal(groupMatch.winnerId, '');

console.log('tournament result clearing tests passed');

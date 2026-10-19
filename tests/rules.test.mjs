import test from 'node:test';
import assert from 'node:assert/strict';
import { validUsername, safeNext, ec, BUILDINGS, buildingState, INITIAL_BALANCE } from '../lib/rules.mjs';
test('redirects reject external, encoded, protocol relative and arbitrary paths', () => {
  for (const input of ['https://evil.test', '//evil.test', '/\\evil.test', '/%2f%2fevil.test', '/game?next=https://evil.test', '/admin', null, 'javascript:alert(1)']) assert.equal(safeNext(input), '/game');
  assert.equal(safeNext('/onboarding'), '/onboarding');
  assert.equal(safeNext('/auth/update-password'), '/auth/update-password');
});
test('founder names have a bounded ASCII format shared with database', () => {
  for (const input of ['ab','9abc','name space','café','a'.repeat(21),'a<script>']) assert.equal(validUsername(input),false);
  assert.equal(validUsername('Founder_19'),true);
});
test('integer EC hundredths are formatted without creating money', () => { assert.equal(ec(INITIAL_BALANCE),'500.00'); assert.throws(() => ec(0.1)); });
test('all required access gates remain visible at level one', () => {
  assert.deepEqual(BUILDINGS.map(b => b.level),[1,1,1,2,3,4,7,10,15,20,25]);
  assert.equal(buildingState(BUILDINGS[0],1),'Available');
  assert.equal(buildingState(BUILDINGS[1],1),'Preview');
  assert.equal(buildingState(BUILDINGS[3],1),'Locked');
});

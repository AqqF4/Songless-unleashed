import test from 'node:test';
import assert from 'node:assert/strict';
import { norm, sameArtist } from './text.ts';

test('norm: регистр, диакритика, ё, пунктуация', () => {
  assert.equal(norm('Beyoncé — Déjà Vu!'), 'beyonce deja vu');
  assert.equal(norm('Ёлка'), norm('елка'));
  assert.equal(norm('AC/DC & Friends'), 'ac dc and friends');
});

test('sameArtist: совпадения и feat', () => {
  assert.ok(sameArtist({ artist: 'The Weeknd', title: 'Starboy' }, { artist: 'the weeknd', title: 'Blinding Lights' }));
  assert.ok(sameArtist({ artist: 'Daft Punk', title: 'Starboy (feat. The Weeknd)' }, { artist: 'The Weeknd', title: 'X' }));
  assert.ok(sameArtist({ artist: 'NCS', title: 'Alan Walker - Fade' }, { artist: 'Alan Walker', title: 'Spectre' }));
  assert.ok(!sameArtist({ artist: 'The Weeknd', title: 'Starboy' }, { artist: 'Drake', title: 'Starboy Remix' }));
});

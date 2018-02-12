/* eslint no-useless-escape: off */
'use strict';

const assert = require('assert');
const test = require('@charmander/test')(module);

const ret3 = require('../');

const parse = regex =>
	ret3.parse(regex.source);

test('empty', () => {
	assert.deepStrictEqual(
		ret3.parse(''),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [],
			}],
		}
	);

	assert.deepStrictEqual(
		parse(/[]/),  // eslint-disable-line no-empty-character-class
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: {
						type: 'CharacterClass',
						negated: false,
						ranges: [],
					},
					quantifier: null,
				}],
			}],
		}
	);

	assert.deepStrictEqual(
		parse(/[^]/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: {
						type: 'CharacterClass',
						negated: true,
						ranges: [],
					},
					quantifier: null,
				}],
			}],
		}
	);

	assert.deepStrictEqual(
		parse(/(?:)/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: {
						type: 'Disjunction',
						alternatives: [{
							type: 'Alternative',
							terms: [],
						}],
					},
					quantifier: null,
				}],
			}],
		}
	);
});

test('fixed string', () => {
	assert.deepStrictEqual(
		parse(/abc/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [
					{type: 'Term', atom: {type: 'Character', value: 97}, quantifier: null},
					{type: 'Term', atom: {type: 'Character', value: 98}, quantifier: null},
					{type: 'Term', atom: {type: 'Character', value: 99}, quantifier: null},
				],
			}],
		}
	);
});

test('quantifiers', () => {
	const reference = (min, max) => ({
		type: 'Disjunction',
		alternatives: [{
			type: 'Alternative',
			terms: [{
				type: 'Term',
				atom: {type: 'Character', value: 97},
				quantifier: {min, max},
			}],
		}],
	});

	assert.deepStrictEqual(parse(/a{2,15}/), reference(2, 15));
	assert.deepStrictEqual(parse(/a{2}/), reference(2, 2));
	assert.deepStrictEqual(parse(/a{02}/), reference(2, 2));
	assert.deepStrictEqual(parse(/a{16000,}/), reference(16000, Infinity));

	assert.deepStrictEqual(parse(/a?/), reference(0, 1));
	assert.deepStrictEqual(parse(/a*/), reference(0, Infinity));
	assert.deepStrictEqual(parse(/a+/), reference(1, Infinity));

	assert.deepStrictEqual(parse(/a{0,9007199254740991}/), reference(0, Number.MAX_SAFE_INTEGER));
	assert.deepStrictEqual(parse(/a{9007199254740991}/), reference(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER));
	assert.deepStrictEqual(parse(/a{9007199254740991,}/), reference(Number.MAX_SAFE_INTEGER, Infinity));

	assert.throws(() => {
		parse(/a{0,9007199254740992}/);
	}, /^PatternError: Count 9007199254740992 is over 2\^53−1 at offset 4 in pattern \/a\{0,9007199254740992\}\/$/);

	assert.throws(() => {
		ret3.parse('a{5,2}');
	}, /^PatternError: Numbers out of order in \{\} quantifier at offset 1 in pattern \/a\{5,2\}\/$/);

	assert.throws(() => {
		parse(/a{,5}/);
	}, /^PatternError: Malformed \{\} quantifier at offset 1 in pattern \/a\{,5\}\/$/);

	assert.throws(() => {
		parse(/a{1,,5}/);
	}, /^PatternError: Malformed \{\} quantifier at offset 1 in pattern \/a\{1,,5\}\/$/);

	assert.throws(() => {
		parse(/a{1/);
	}, /^PatternError: Malformed \{\} quantifier at offset 1 in pattern \/a\{1\/$/);

	assert.throws(() => {
		ret3.parse('?');
	}, /^PatternError: Nothing to repeat at offset 0 in pattern \/\?\/$/);

	assert.throws(() => {
		ret3.parse('{3}');
	}, /^PatternError: Nothing to repeat at offset 0 in pattern \/\{3\}\/$/);

	assert.throws(() => {
		ret3.parse('a{3}*');
	}, /^PatternError: Nothing to repeat at offset 4 in pattern \/a\{3\}\*\/$/);

	assert.deepStrictEqual(
		parse(/(?:a)*/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: parse(/a/),
					quantifier: {
						min: 0,
						max: Infinity,
					},
				}],
			}],
		},
	);
});

test('hex escapes', () => {
	assert.deepStrictEqual(parse(/\x20/), parse(/ /));
	assert.deepStrictEqual(parse(/\x3f/), parse(/\?/));
	assert.deepStrictEqual(parse(/\x3F/), parse(/\?/));
	assert.deepStrictEqual(parse(/\u0020/), parse(/ /));
	assert.deepStrictEqual(parse(/\u003f/), parse(/\?/));
	assert.deepStrictEqual(parse(/\u003F/), parse(/\?/));

	assert.deepStrictEqual(parse(/[\x20]/), parse(/[ ]/));
	assert.deepStrictEqual(parse(/[\x3f]/), parse(/[?]/));
	assert.deepStrictEqual(parse(/[\x3F]/), parse(/[?]/));
	assert.deepStrictEqual(parse(/[\u0020]/), parse(/[ ]/));
	assert.deepStrictEqual(parse(/[\u003f]/), parse(/[?]/));
	assert.deepStrictEqual(parse(/[\u003F]/), parse(/[?]/));

	assert.deepStrictEqual(parse(/[\x20-\u003f]/), parse(/[ -?]/));
});

test('character escapes', () => {
	assert.deepStrictEqual(parse(/\n/), parse(/\x0a/));
	assert.deepStrictEqual(parse(/\r/), parse(/\x0d/));
	assert.deepStrictEqual(parse(/\t/), parse(/\x09/));

	assert.deepStrictEqual(parse(/[\n]/), parse(/[\x0a]/));
	assert.deepStrictEqual(parse(/[\r]/), parse(/[\x0d]/));
	assert.deepStrictEqual(parse(/[\t]/), parse(/[\x09]/));
});

test('character ranges', () => {
	assert.deepStrictEqual(
		parse(/[a-c]/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: {
						type: 'CharacterClass',
						negated: false,
						ranges: [
							{start: 97, end: 99},
						],
					},
					quantifier: null,
				}],
			}],
		}
	);

	assert.deepStrictEqual(
		parse(/[^ba-c]/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: {
						type: 'CharacterClass',
						negated: true,
						ranges: [
							{start: 98, end: 98},
							{start: 97, end: 99},
						],
					},
					quantifier: null,
				}],
			}],
		}
	);

	assert.throws(() => {
		parse(/[-z]/);
	}, /^PatternError: Range missing start at offset 1 in pattern \/\[-z\]\/$/);

	assert.throws(() => {
		parse(/[a-]/);
	}, /^PatternError: Range missing end at offset 1 in pattern \/\[a-\]\/$/);

	assert.throws(() => {
		parse(/[\d-z]/);
	}, /^PatternError: Range missing start at offset 3 in pattern \/\[\\d-z\]\/$/);

	assert.throws(() => {
		parse(/[a-\d]/);
	}, /^PatternError: Range missing end at offset 1 in pattern \/\[a-\\d\]\/$/);
});

test('predefined character classes', () => {
	assert.deepStrictEqual(parse(/\d/), parse(/[0-9]/));
	assert.deepStrictEqual(parse(/[\d]/), parse(/\d/));
	assert.deepStrictEqual(parse(/\D/), parse(/[^0-9]/));
	assert.deepStrictEqual(parse(/[\D]/), parse(/[\x00-/:-\uffff]/));

	assert.deepStrictEqual(parse(/\w/), parse(/[0-9A-Z_a-z]/));
	assert.deepStrictEqual(parse(/[\w]/), parse(/\w/));
	assert.deepStrictEqual(parse(/\W/), parse(/[^0-9A-Z_a-z]/));
	assert.deepStrictEqual(parse(/[\W]/), parse(/[\x00-/:-@\[-\^`{-\uffff]/));

	assert.deepStrictEqual(parse(/./), parse(/[^\n\r\u2028\u2029]/));
	assert.deepStrictEqual(parse(/[.]/), parse(/[\x2e]/));

	[/\s/, /\S/].forEach(pattern => {
		assert.throws(
			() => {
				parse(pattern);
			},
			error => String(error) ===
				`PatternError: Unexpected ${pattern.source} at offset 0 in pattern ${pattern} – use an explicit set of whitespace characters instead`,
		);

		assert.throws(
			() => {
				ret3.parse('[' + pattern.source + ']');
			},
			error => String(error) ===
				`PatternError: Unexpected ${pattern.source.slice(0, 2)} at offset 1 in pattern /[${pattern.source}]/ – use an explicit set of whitespace characters instead`,
		);
	});
});

test('identity escapes', () => {
	assert.deepStrictEqual(parse(/\^/), parse(/\x5e/));
	assert.deepStrictEqual(parse(/\$/), parse(/\x24/));
	assert.deepStrictEqual(parse(/\\/), parse(/\x5c/));
	assert.deepStrictEqual(parse(/\./), parse(/\x2e/));
	assert.deepStrictEqual(parse(/\*/), parse(/\x2a/));
	assert.deepStrictEqual(parse(/\+/), parse(/\x2b/));
	assert.deepStrictEqual(parse(/\?/), parse(/\x3f/));
	assert.deepStrictEqual(parse(/\(/), parse(/\x28/));
	assert.deepStrictEqual(parse(/\)/), parse(/\x29/));
	assert.deepStrictEqual(parse(/\[/), parse(/\x5b/));
	assert.deepStrictEqual(parse(/\]/), parse(/\x5d/));
	assert.deepStrictEqual(parse(/\{/), parse(/\x7b/));
	assert.deepStrictEqual(parse(/\}/), parse(/\x7d/));
	assert.deepStrictEqual(parse(/\|/), parse(/\x7c/));
	assert.deepStrictEqual(parse(/\//), parse(/\x2f/));

	assert.deepStrictEqual(parse(/[\^]/), parse(/[\x5e]/));
	assert.deepStrictEqual(parse(/[\-]/), parse(/[\x2d]/));
	assert.deepStrictEqual(parse(/[\\]/), parse(/[\x5c]/));
	assert.deepStrictEqual(parse(/[\]]/), parse(/[\x5d]/));
});

test('common unnecessary character class escapes', () => {
	assert.deepStrictEqual(parse(/[\[]/), parse(/[[]/));
	assert.deepStrictEqual(parse(/[\/]/), parse(/[/]/));
});

test('unnecessary character class escapes', () => {
	assert.throws(() => {
		parse(/[\+]/);
	}, /^PatternError: Unexpected \\\+ at offset 1 in pattern \/\[\\\+\]\/$/);
});

test('unescaped ^ in character class', () => {
	assert.throws(() => {
		parse(/[a^]/);
	}, /^PatternError: Unexpected \^ at offset 2 in pattern \/\[a\^\]\/$/);
});

test('unrecognized and removed character class escapes', () => {
	assert.throws(() => {
		parse(/[\a]/);
	}, /^PatternError: Unexpected \\a at offset 1 in pattern \/\[\\a\]\/$/);

	assert.throws(() => {
		parse(/[\b]/);
	}, /^PatternError: Unexpected \\b at offset 1 in pattern \/\[\\b\]\/$/);
});

test('trailing backslash', () => {
	assert.throws(() => {
		ret3.parse('\\'); }, /^PatternError: Unexpected \\ at offset 0 in pattern \/\\\/$/);
});

test('unclosed character class', () => {
	assert.throws(() => {
		ret3.parse('[\\');
	}, /^PatternError: Unterminated character class at offset 0 in pattern \/\[\\\/$/);

	assert.throws(() => {
		ret3.parse('[\\]');
	}, /^PatternError: Unterminated character class at offset 0 in pattern \/\[\\\]\/$/);
});

test('unclosed group', () => {
	assert.throws(() => {
		ret3.parse('(?:');
	}, /^PatternError: Unterminated group at offset 0 in pattern \/\(\?:\/$/);

	assert.throws(() => {
		ret3.parse('(?:\\)');
	}, /^PatternError: Unterminated group at offset 0 in pattern \/\(\?:\\\)\/$/);
});

test('non-string input', () => {
	assert.throws(() => {
		ret3.parse(/foo/);
	}, /^TypeError: Parser input must be a string$/);
});

test('alternatives', () => {
	assert.deepStrictEqual(
		parse(/a|b/),
		{
			type: 'Disjunction',
			alternatives: [
				parse(/a/).alternatives[0],
				parse(/b/).alternatives[0],
			],
		},
	);

	assert.deepStrictEqual(
		parse(/a|/),
		{
			type: 'Disjunction',
			alternatives: [
				parse(/a/).alternatives[0],
				ret3.parse('').alternatives[0],
			],
		},
	);

	assert.deepStrictEqual(
		parse(/(?:a|b)/),
		{
			type: 'Disjunction',
			alternatives: [{
				type: 'Alternative',
				terms: [{
					type: 'Term',
					atom: parse(/a|b/),
					quantifier: null,
				}],
			}],
		},
	);
});

test('assertions', () => {
	[/^/, /$/, /\b/, /\B/].forEach(pattern => {
		assert.throws(
			() => {
				parse(pattern);
			},
			error => String(error) ===
				`PatternError: Unexpected ${pattern.source} at offset 0 in pattern ${pattern} – assertions are not supported`,
		);
	});
});

test('capturing groups', () => {
	assert.throws(() => {
		parse(/(a)/);
	}, /^PatternError: Unexpected \( at offset 0 in pattern \/\(a\)\/ – all groups must be non-capturing$/);
});

test('removed escapes', () => {
	[/\cA/, /\0/, /\f/, /\v/].forEach(pattern => {
		assert.throws(
			() => {
				parse(pattern);
			},
			error => String(error) ===
				`PatternError: Unexpected ${pattern.source.slice(0, 2)} at offset 0 in pattern ${pattern} – use a hex escape instead`,
		);

		assert.throws(
			() => {
				ret3.parse('[' + pattern.source + ']');
			},
			error => String(error) ===
				`PatternError: Unexpected ${pattern.source.slice(0, 2)} at offset 1 in pattern /[${pattern.source}]/ – use a hex escape instead`,
		);
	});
});

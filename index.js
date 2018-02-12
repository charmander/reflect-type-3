'use strict';

const PatternError = require('./internal/pattern-error');

const TYPE_DISJUNCTION = 'Disjunction';
const TYPE_ALTERNATIVE = 'Alternative';
const TYPE_TERM = 'Term';
const TYPE_CHARACTER = 'Character';
const TYPE_CHARACTER_CLASS = 'CharacterClass';

const QUANTIFIERS = new Map([
	['*', Object.freeze({min: 0, max: Infinity})],
	['+', Object.freeze({min: 1, max: Infinity})],
	['?', Object.freeze({min: 0, max: 1})],
]);

const CHARACTER_ESCAPES = new Map([
	['n', 10],
	['r', 13],
	['t', 9],
]);

const characterClassTerm = (negated, ranges) => ({
	type: TYPE_TERM,
	atom: {
		type: TYPE_CHARACTER_CLASS,
		negated,
		ranges,
	},
	quantifier: null,
});

const dotTerm = () => characterClassTerm(true, [
	{start: 10, end: 10},          // LF
	{start: 13, end: 13},          // CR
	{start: 0x2028, end: 0x2028},  // line separator
	{start: 0x2029, end: 0x2029},  // paragraph separator
]);

const characterTerm = code => ({
	type: TYPE_TERM,
	atom: {
		type: TYPE_CHARACTER,
		value: code,
	},
	quantifier: null,
});

const parseCount = (text, contextOffset, contextInput) => {
	const count = parseInt(text, 10);

	if (!Number.isSafeInteger(count)) {
		throw new PatternError(`Count ${text} is over 2^53−1`, contextOffset, text.length, contextInput);
	}

	return count;
};

const parseRanges = (input, contextOffset, contextInput) => {
	const ranges = [];
	let range = null;
	let end = false;
	let rangeStart = -1;

	const pushCharacter = (code, offset, length) => {
		if (end) {
			if (code < range.start) {
				throw new PatternError('Range out of order', contextOffset + rangeStart, offset + length - rangeStart, contextInput);
			}

			end = false;
			range.end = code;
			range = null;
		} else {
			range = {
				start: code,
				end: code,
			};
			rangeStart = offset;

			ranges.push(range);
		}
	};

	const token = /([^^\\\-\]])|(-|\\[dDwW])|\\(x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4})|\\([nrt])|\\([\^\\\-\]/[])|[^]/g;
	let match;

	while ((match = token.exec(input)) !== null) {
		if (match[1] !== undefined) {
			pushCharacter(match[1].charCodeAt(0), match.index, 1);
		} else if (match[2] !== undefined) {
			if (end) {
				throw new PatternError('Range missing end', contextOffset + rangeStart, match.index - rangeStart, contextInput);
			}

			switch (match[2]) {
			case '-':
				if (range === null) {
					throw new PatternError('Range missing start', contextOffset + match.index, 1, contextInput);
				}

				end = true;
				break;

			case '\\d':
				range = null;
				ranges.push({start: 0x30, end: 0x39});  // 0-9
				break;

			case '\\D':
				range = null;
				ranges.push({start: 0x00, end: 0x2f});
				ranges.push({start: 0x3a, end: 0xffff});
				break;

			case '\\w':
				range = null;
				ranges.push({start: 0x30, end: 0x39});  // 0-9
				ranges.push({start: 0x41, end: 0x5a});  // A-Z
				ranges.push({start: 0x5f, end: 0x5f});  // _
				ranges.push({start: 0x61, end: 0x7a});  // a-z
				break;

			case '\\W':
				range = null;
				ranges.push({start: 0x00, end: 0x2f});
				ranges.push({start: 0x3a, end: 0x40});
				ranges.push({start: 0x5b, end: 0x5e});
				ranges.push({start: 0x60, end: 0x60});
				ranges.push({start: 0x7b, end: 0xffff});
				break;

			/* istanbul ignore next */
			default:
				throw new Error('Unexpected');
			}
		} else if (match[3] !== undefined) {
			pushCharacter(parseInt(match[3].substring(1), 16), match.index, match[0].length);
		} else if (match[4] !== undefined) {
			pushCharacter(CHARACTER_ESCAPES.get(match[4]), match.index, match[0].length);
		} else if (match[5] !== undefined) {
			pushCharacter(match[5].charCodeAt(0), match.index, match[0].length);
		} else {
			const unexpected =
				match[0] === '\\' ?
					input.substr(match.index, 2) :
					match[0];

			let detail = undefined;

			switch (unexpected) {
			case '\\s':
			case '\\S':
				detail = 'use an explicit set of whitespace characters instead';
				break;

			case '\\c':
			case '\\0':
			case '\\f':
			case '\\v':
				detail = 'use a hex escape instead';
				break;
			}

			throw new PatternError('Unexpected ' + unexpected, contextOffset + match.index, 1, contextInput, detail);
		}
	}

	if (end) {
		throw new PatternError('Range missing end', contextOffset + rangeStart, input.length - rangeStart, contextInput);
	}

	return ranges;
};

const parse = input => {
	if (typeof input !== 'string') {
		throw new TypeError('Parser input must be a string');
	}

	const stack = [];
	let alternative = {
		type: TYPE_ALTERNATIVE,
		terms: [],
	};
	let disjunction = {
		type: TYPE_DISJUNCTION,
		alternatives: [alternative],
	};
	let term = null;

	const pushTerm = newTerm => {
		term = newTerm;
		alternative.terms.push(term);
	};

	const pushQuantifier = (min, max, offset, length) => {
		if (term === null || term.quantifier !== null) {
			throw new PatternError('Nothing to repeat', offset, length, input);
		}

		term.quantifier = {min, max};
	};

	const token = /([^^$\\.*+?()[\]{}|]+)|([)|*+?.]|\(\?:|\\[dDwW])|\\(x[\dA-Fa-f]{2}|u[\dA-Fa-f]{4})|\\([nrt])|\\([\^$\\.*+?()[\]{}|/])|\{(\d+)(?:,(\d*))?\}|\[(\^)?((?:\\[^]|[^\\\]])*)\]|[^]/g;
	let match;

	while ((match = token.exec(input)) !== null) {
		if (match[1] !== undefined) {
			const text = match[1];

			for (let i = 0; i < text.length; i++) {
				pushTerm(characterTerm(text.charCodeAt(i)));
			}
		} else if (match[2] !== undefined) {
			switch (match[2]) {
			case '(?:': {
				stack.push({disjunction, offset: match.index});

				alternative = {
					type: TYPE_ALTERNATIVE,
					terms: [],
				};

				disjunction = {
					type: TYPE_DISJUNCTION,
					alternatives: [alternative],
				};

				term = null;

				break;
			}

			case ')': {
				const head = disjunction;
				disjunction = stack.pop().disjunction;
				alternative = disjunction.alternatives[disjunction.alternatives.length - 1];

				pushTerm({
					type: TYPE_TERM,
					atom: head,
					quantifier: null,
				});

				break;
			}

			case '|': {
				alternative = {
					type: TYPE_ALTERNATIVE,
					terms: [],
				};
				disjunction.alternatives.push(alternative);
				term = null;
				break;
			}

			case '*':
			case '+':
			case '?': {
				const {min, max} = QUANTIFIERS.get(match[2]);
				pushQuantifier(min, max, match.index, 1);
				break;
			}

			case '.': {
				pushTerm(dotTerm());
				break;
			}

			case '\\d':
			case '\\D': {
				pushTerm(characterClassTerm(match[2] === '\\D', [
					{start: 0x30, end: 0x39},  // 0-9
				]));
				break;
			}

			case '\\w':
			case '\\W': {
				pushTerm(characterClassTerm(match[2] === '\\W', [
					{start: 0x30, end: 0x39},  // 0-9
					{start: 0x41, end: 0x5a},  // A-Z
					{start: 0x5f, end: 0x5f},  // _
					{start: 0x61, end: 0x7a},  // a-z
				]));
				break;
			}

			/* istanbul ignore next */
			default:
				throw new Error('Unexpected');
			}
		} else if (match[3] !== undefined) {
			pushTerm(characterTerm(parseInt(match[3].substring(1), 16)));
		} else if (match[4] !== undefined) {
			pushTerm(characterTerm(CHARACTER_ESCAPES.get(match[4])));
		} else if (match[5] !== undefined) {
			pushTerm(characterTerm(match[5].charCodeAt(0)));
		} else if (match[6] !== undefined) {
			const min = parseCount(match[6], match.index + 1, input);
			const max =
				match[7] === undefined ? min :
				match[7] === '' ? Infinity :
				parseCount(match[7], match.index + 1 + match[6].length + 1, input);

			if (max < min) {
				throw new PatternError('Numbers out of order in {} quantifier', match.index, match[0].length, input);
			}

			pushQuantifier(min, max, match.index, match[0].length);
		} else if (match[9] !== undefined) {
			const negated = match[8] !== undefined;

			pushTerm({
				type: TYPE_TERM,
				atom: {
					type: TYPE_CHARACTER_CLASS,
					negated,
					ranges: parseRanges(match[9], match.index + 1 + negated, input),
				},
				quantifier: null,
			});
		} else {
			const unexpected =
				match[0] === '\\' ?
					input.substr(match.index, 2) :
					match[0];

			let detail = undefined;

			switch (unexpected) {
			case '^':
			case '$':
			case '\\b':
			case '\\B':
				detail = 'assertions are not supported';
				break;

			case '(':
				detail = 'all groups must be non-capturing';
				break;

			case '\\s':
			case '\\S':
				detail = 'use an explicit set of whitespace characters instead';
				break;

			case '\\c':
			case '\\0':
			case '\\f':
			case '\\v':
				detail = 'use a hex escape instead';
				break;

			case '[':
				throw new PatternError('Unterminated character class', match.index, input.length - match.index, input);

			case '{': {
				const terminator = input.indexOf('}', match.index + 1);
				const indicatorLength = terminator === -1 ? 1 : terminator - match.index + 1;
				throw new PatternError('Malformed {} quantifier', match.index, indicatorLength, input);
			}
			}

			throw new PatternError('Unexpected ' + unexpected, match.index, unexpected.length, input, detail);
		}
	}

	if (stack.length !== 0) {
		const start = stack[stack.length - 1].offset;
		throw new PatternError('Unterminated group', start, input.length - start, input);
	}

	return disjunction;
};

module.exports = {
	PatternError,
	parse,
};

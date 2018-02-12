'use strict';

class PatternError extends SyntaxError {
	constructor(message, offset, length, input, detail) {
		let fullMessage = message + ' at offset ' + offset + ' in pattern /' + input + '/';

		if (detail !== undefined) {
			fullMessage += ' – ' + detail;
		}

		super(fullMessage);
		Error.captureStackTrace(this, this.constructor);

		// not accurate, but also not worth introducing segmentation for
		this.stack =
			input + '\n' +
			' '.repeat(offset) + '^'.repeat(length) + '\n' +
			this.stack;
	}
}

Object.defineProperty(PatternError.prototype, 'name', {
	configurable: true,
	writable: true,
	value: PatternError.name,
});

module.exports = PatternError;

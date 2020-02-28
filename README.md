[![Build status][ci image]][ci]

A parser for a simplified, regular subset of JavaScript regular expressions that doesn’t support capturing.

Because it’s regular, the subset doesn’t support:

- backreferences

Because it doesn’t support capturing, it doesn’t support:

- capturing groups (`(…)` unless `(?:…)`)
- greediness modifiers

Because it’s simplified, it doesn’t support:

- assertions (anchors, word boundaries, `(?=…)`, and `(?!…)`)
- escapes with easy alternatives that are obscure (`\cX`), uncommon (`\f`, `\v`), or syntactically awkward (`\0`)
- escapes that aren’t necessary in any context
- `\s` and `\S` (what they match is not obvious)


## Syntax

When syntactically valid, a pattern has the same meaning as it does in JavaScript (i.e. when passed to the `RegExp` constructor) with no flags.

```abnf
pattern = disjunction

disjunction = alternative [ "|" disjunction ]

alternative = *term

term = atom [ quantifier ]

quantifier =
    "*" /                        ; zero or more
    "+" /                        ; one or more
    "?" /                        ; zero or one
    "{" 1*DIGIT "}" /            ; exactly count. counts are at most Number.MAX_SAFE_INTEGER.
    "{" 1*DIGIT ",}" /           ; at least count
    "{" 1*DIGIT "," 1*DIGIT "}"  ; at least first count and at most second. must be a non-empty range.

atom =
    pattern-character /        ; the character itself
    "." /                      ; any character except CR, LF, U+2028, and U+2029
    "\" atom-escape /
    character-class /
    "(?:" pattern ")"

character-class =
    "["
    [ "^" ]                    ; indicates a negated character class
    *range
    "]"

range =
    range-character "-" range-character /  ; must be a non-empty range
    range-character /
    "\" predefined-range

range-character =
    range-plain-character /
    "\" range-escape

character-escape =
    %s"n" /                      ; LF
    %s"r" /                      ; CR
    %s"t" /                      ; tab
    %s"x" 2hex-digit /
    %s"u" 4hex-digit

predefined-range =
    "d" / "D" /                ; [0-9], [^0-9]
    "w" / "W"                  ; [0-9A-Za-z_], [^…]

atom-escape =
    character-escape /
    predefined-range /
    pattern-metacharacter /
    "/"

range-escape =
    character-escape /
    range-metacharacter /
    "/" /
    "["

range-metacharacter =
    "^" / "\" / "-" / "]"

pattern-metacharacter =
    "^" / "$" / "\" / "." / "*" / "+" / "?" /
    "(" / ")" / "[" / "]" / "{" / "}" / "|"

hex-digit =
    HEXDIG /                   ; 0-9A-F
    %x61-66                    ; a-f
```

`pattern-character` is any UTF-16 code unit that is not a `pattern-metacharacter`. Similarly, `range-plain-character` is any UTF-16 code unit that is not a `range-metacharacter`.


## Parser output format

Every node has a `type` property (a string). The node types and their properties are:

### `Disjunction`

- `alternatives`, a non-empty array of `Alternative` nodes

### `Alternative`

- `terms`, an array of `Term` nodes

### `Term`

- `atom`, a `Character`, `CharacterClass`, or `Disjunction` node
- `quantifier`, `null` or an object with the following properties:
    - `min`, the minimum number of repetitions indicated by the quantifier; an integer from 0 to 2^53−1
    - `max`, the maximum number of repetitions indicated by the quantifier; an integer from `min` to 2^53−1, or `Infinity`

### `Character`

- `value`, an integer UTF-16 code unit

### `CharacterClass`

- `negated`, a boolean
- `ranges`, an array of objects with inclusive integer `start` and `end` properties representing UTF-16 code units

Nodes can be modified safely.


## API

### `.parse(string)`

Returns a `Disjunction` node or throws a `PatternError`.

### `.PatternError`

The type of error thrown by `.parse`.


## Example

```js
const ret3 = require('reflect-type-3');

ret3.parse(/[ab]+/.source)
```

```js
({
    type: 'Disjunction',
    alternatives: [{
        type: 'Alternative',
        terms: [{
            type: 'Term',
            atom: {
                type: 'CharacterClass',
                negated: false,
                ranges: [
                    {start: 97, end: 97},
                    {start: 98, end: 98},
                ],
            },
            quantifier: {
                min: 1,
                max: Infinity,
            },
        }],
    }],
})
```


  [ci]: https://travis-ci.org/charmander/reflect-type-3
  [ci image]: https://api.travis-ci.org/charmander/reflect-type-3.svg

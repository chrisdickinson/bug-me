# bug-me

A package exposing the data from [nodebug.me](https://nodebug.me). Contains
both a CLI and require-able module.

```bash
$ bug-me
usage: bug-me [<options>]

    -h, -?, --help        show this help
    -r, --reproducible    show issues with reproduction steps
    -c, --consensus       show issues that have consensus on a solution
    -d, --duplicates      show issues that have duplicates
    -w, --wrong-repo      show issues that are in the wrong repo
    -f, --is-feature      show issues that have been approved as features
                          by a core team member
    -v, --version <ver>   show issues that have been reproduced 
                          against version <ver>, with acceptable values
                          of "0.10" or "0.11"
$ bug-me -c -f
# ... all issues that have consensus or are features ...
```

Or from Node:

```javascript
var concat = require('concat-stream');
var bugs = require('bug-me');

bugs().pipe(concat(function(bugReports) {
  bugReports.length
}))
```

## API

### `bugs() → Readable Stream<BugReport>`

Bugs will return an objectMode readable stream of bug report objects, suitable 
for piping to an objectMode writable stream.

#### `BugReport`

An object tallying the results of bug reports for a given github issue.
Detailed [here](https://github.com/nodebugme/site/blob/master/API.md#issue).

## License

MIT

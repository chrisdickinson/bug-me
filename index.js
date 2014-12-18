#!/usr/bin/env node
var Readable = require('stream').Readable;
var concat = require('concat-stream');
var minimist = require('minimist');
var wordwrap = require('wordwrap');
var https = require('https');
var colors = null;
var styles = null;

if (require.main === module) {
  if (require('supports-color')) {
    colors = require('ansicolors');
    styles = require('ansistyles');
  } else {
    colors = {brightBlue: String, yellow: String, red: String, green: String};
    styles = {underline: String};
  }

  cli(minimist(process.argv.slice(2)));
} else {
  module.exports = function() {
    var rs = new Readable({objectMode: true});
    rs._read = function() {
      rs._read = nop;
      getList(Boolean, rs.push.bind(rs), function(err) {

        if (err) {
          return rs.emit('error', err);
        }
        rs.push(null);
      });
    };
    return rs;
  };
}

function cli(argv) {
  var filters = [];

  if (argv.h || argv.help || argv['?']) {
    return help();
  }

  var reproducible = argv.r || argv.reproducible;
  var hasConsensus = argv.c || argv.consensus;
  var duplicates = argv.d || argv.duplicates;
  var wrongRepo = argv.w || argv['wrong-repo'];
  var isFeature = argv.f || argv['is-feature'];
  var issueOn = argv.v || argv.version;
  var all = argv.a || argv.all;
  issueOn = (Array.isArray(issueOn) ? issueOn : [issueOn])
    .filter(Boolean);

  filters.push(reproducible && filter('hasReproductionSteps'));
  filters.push(hasConsensus && filter('hasConsensus'));
  filters.push(duplicates && filterIsDuplicate);
  filters.push(wrongRepo && filterWrongRepository);
  filters.push(isFeature && filter('isFeatureRequest'));
  filters.concat(issueOn.map(filterGetVersion));
  filters.push(all && Boolean);

  filters = filters.filter(Boolean);
  if (!filters.length) {
    return help();
  }

  getList(function(issue) {
    return filters.some(function(xs) {
      return xs(issue);
    });
  }, logIsFeature, function(err) {
    if (err) throw err;
  });
}

function help() {
  process.stderr.write(
    require('fs').readFileSync(require('path').join(__dirname, 'help.txt'))
  );
  process.exit(1);
}

function nop() {
}

function filter(prop) {
  return function(issue) {
    return +issue.stats[prop].yes > 0;
  };
}

function getList(filter, log, ready) {
  iterateURLs('https://nodebug.me/api/v1/issues', function (issue, idx, all) {
    if (!filter(issue)) {
      return;
    }
    log(issue);
  }, function(err) {
    if (err) return ready(err);
    ready();
  });
}

function filterGetVersion(version) {
  return function filterIsVersion(issue) {
    return +issue.isIssueOnVersions[version].yes > 0;
  };
}

function filterIsDuplicate(issue) {
  return issue.stats.duplicates.filter(Boolean).length;
}

function logIsDuplicate(issue) {
  console.log(wordwrap(4, 60)(issue.title));
  console.log();
}

function filterIsFeature(issue) {
  return +issue.stats.isFeatureRequest.yes > 1;
}

function filterHasConsensus(issue) {
  return +issue.stats.hasConsensus.yes > 0;
}

function filterHasReproductionSteps(issue) {
  return +issue.stats.hasReproductionSteps.yes > 0;
}

function filterWrongRepository(issue) {
  return +issue.stats.inCorrectRepository.no > 0;
}

function logIsFeature(issue) {
  var dupes = issue.stats.duplicates.filter(Boolean);

  console.log(styles.underline(issue.issueURL) + ' - ' + issue.stats.total + ' response' + (
    +issue.stats.total === 1 ? '' : 's'
  ));

  dupes = dupes.length ? dupes.map(function(xs) {
    return xs.split(/[,\s]+/g);
  }).reduce(function(lhs, rhs) {
    return lhs.concat(rhs);
  }) : [];

  console.log();
  console.log(wordwrap(4, 80)(issue.title));
  console.log();
  process.stdout.write(printStats('approved feature', issue.stats.isFeatureRequest) + ' ');
  process.stdout.write(printStats('has consensus', issue.stats.isFeatureRequest) + '\n');
  process.stdout.write(printStats('in correct repo', issue.stats.isFeatureRequest) + ' ');
  process.stdout.write(printStats('reproduction steps', issue.stats.hasReproductionSteps) + '\n');
  process.stdout.write(printStats('issue on 0.10', issue.stats.isIssueOnVersions['0.10']) + ' ');
  process.stdout.write(printStats('issue on 0.11', issue.stats.isIssueOnVersions['0.11']) + '\n');
  
  if (dupes.length) {
    process.stdout.write(colors.brightBlue('    duplicates:\n        '));
    process.stdout.write(dupes.map(function(xs) {
      if (xs.slice(0, 4) === 'http') return xs;
      return xs.replace(/^#/, 'https://github.com/joyent/node/issues/');
    }).filter(function(xs, idx, all) {
      return all.indexOf(xs) === idx;
    }).join('\n        '));
  }
  

  console.log();
  console.log();
}

function printStats(name, item) {
  var hasYes = +item.yes > 0;
  var hasNo = +item.no > 0;
  var hasMaybe = +item.maybe > 0;
  name = pad(name, 20);
  if (hasNo && hasYes) {
    name = colors.yellow(name);
  } else if (hasNo) {
    name = colors.red(name);
  } else if (hasYes) {
    name = colors.green(name);
  }

  return name + ' (' +
    item.yes + ' yes ' +
    item.no + ' no ' +
    item.idk + ' maybe' +
  ')';
}

function pad(str, n) {
  while (str.length < n) {
    str = ' ' + str;
  }
  return str;
}

function fetchURL(uri, ready) {
  https.request(uri, function(res) {
    res.pipe(concat(ondata));
  }).end();

  function ondata(data) {
    try {
      data = JSON.parse(data.toString('utf8'));
    } catch (err) {
      return ready(err);
    }
    return ready(null, data);
  }
}

function iterateURLs(url, queue, close) {
  fetchURL(url, function(err, resp) {
    if (err) return close(err);

    resp.objects.forEach(queue);
    if (resp.meta.next) {
      iterateURLs(resp.meta.next, queue, close);
    } else {
      close();
    }
  });
}

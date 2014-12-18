var Writable = require('stream').Writable;
var issues = require('./index.js');
var ws = new Writable({objectMode: true});
ws._write = function(obj, enc, ready) {
  ready();
};
issues().pipe(ws);

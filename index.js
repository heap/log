var fclone = require('fclone');
var os = require('os');
var path = require('path');
var winston = require('winston');
var argv = require('yargs').argv;
require('winston-log-and-exit');

/*
TODO: This should be configured by an external file.
It shouldn't require a code change to set logging prefs.
*/
winston.exitOnError = false;

var mainFilename = path.basename(process.mainModule.filename);

// :KLUDGE: Add special handling for our pm2 loading setup.
if (mainFilename === 'pm2_loader.js') {
  mainFilename = path.basename(argv.pm2Path);
}

var hostname = os.hostname();

var logger = new (winston.Logger)({
  rewriters: [
    function(label, msg, meta) {
      meta = fclone(meta); // Remove circular references.
      meta.mainFilename = mainFilename;
      meta.hostname = hostname;
      return meta;
    }
  ]
});

var prod = process.env.NODE_ENV === 'prod';
logger.add(winston.transports.Console, {
  colorize: (process.env.LOG_COLOR || 'yes') !== 'no',
  timestamp: prod,
  level: process.env.LOG_LEVEL || 'info'
});

if (prod) {
  var fluentConfig = {
    host: 'localhost',
    port: 24224,
    timeout: 3.0
  };
  var fluentTransport = require('fluent-logger').support.winstonTransport();
  var transport = new fluentTransport('heap.coffee', fluentConfig);
  logger.add(transport, null, true);
}

module.exports = logger;

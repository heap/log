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

// process.mainModule is undefined when node reads from STDIN.
var mainFilename = process.mainModule == null
    ? 'unknown'
    : path.basename(process.mainModule.filename);

// :KLUDGE: Add special handling for our pm2 loading setup.
if (mainFilename === 'pm2_loader.js') {
  try {
    mainFilename = path.basename(argv.pm2path)
  }
  catch (e) {
    // An error was encountered, likely because pm2path wasn't passed
    // in. In this case we'll just use pm2_loader for the mainfilename.
  };
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
  colorize: false,
  timestamp: prod,
  level: process.env.LOG_LEVEL || 'info'
});

var notECS = !( typeof process.env.HEAP_ECS !== 'undefined' && process.env.HEAP_ECS == "true" );
if (prod && notECS) {
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

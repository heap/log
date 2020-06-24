var fclone = require('fclone');
var os = require('os');
var path = require('path');
var winston = require('winston');
var argv = require('yargs').argv;
require('winston-log-and-exit');

var isProd = process.env.NODE_ENV === 'prod';
var isECS = process.env.HEAP_ECS === 'true';

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
  }
}

var hostname = os.hostname();

var rewriters = [
  function(label, msg, meta) {
    meta = fclone(meta); // Remove circular references.
    meta.mainFilename = mainFilename;
    meta.hostname = hostname;
    return meta;
  }
]

if (isECS) {
  rewriters.push(function(label,msg, meta) {
    // First, check if the meta object is actually an error. In this case we want to preserve
    // the error message (which would otherwise be clobbered by the log message). Winston populates
    // the `name` field of the meta object with the class of the object if available, so just check
    // for `name === 'Error'` here.
    if (meta.name === 'Error') {
      meta.error_message = meta.message
      delete meta.message;
      delete meta.name; // This field just looks confusing.
      return meta;
    }

    // Otherwise, we expect the meta object to be tags for the log line. Apply some rudimentary
    // sanitizing here to stringify unexpected nested objects. All of our tags should be either
    // string or number values.
    for (var key of Object.keys(meta)) {
      var value = meta[key];
      var isString = typeof value === 'string';
      var isNumber = typeof value === 'number';
      if (!isString && !isNumber) {
        meta[key] = '' + JSON.stringify(value);
      }
    }

    return meta;
  })
}

var logger = new (winston.Logger)({rewriters});

logger.add(winston.transports.Console, {
  json: isECS,
  stringify: (obj) => JSON.stringify(obj),
  colorize: !isECS,
  timestamp: isProd,
  level: process.env.LOG_LEVEL || 'info'
});

if (isProd && !isECS) {
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

var appInstance,
conf,
defaultLogger,
facilityMap,
hostname,
logentries,
logentriesToken,
mainFilename,
os,
path,
prod,
Raygun,
winston,
_;

conf = require('config');
fclone = require('fclone');
os = require('os');
path = require('path');
Raygun = require('winston-raygun');
winston = require('winston');
require('winston-log-and-exit');

/*
TODO: This should be configured by an external file.
It shouldn't require a code change to set logging prefs.
*/
winston.exitOnError = false;

mainFilename = path.basename(process.mainModule.filename);
hostname = os.hostname();

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

prod = process.env.NODE_ENV === 'prod';
logger.add(winston.transports.Console, {
colorize: (process.env.LOG_COLOR || 'yes') !== 'no',
timestamp: prod,
level: process.env.LOG_LEVEL || 'info'
});

// In an effort to minimize noisiness, manually specify what gets logged to Raygun.
raygunLog = Raygun.prototype.log;
Raygun.prototype.log = function(level, msg, meta, callback){
if (meta.logToRaygun) {
  raygunLog.call(this, level, msg, meta, callback);
}
};

if (prod) {
logger.add(Raygun, {
  apiKey: conf.raygun.backend
});
}

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
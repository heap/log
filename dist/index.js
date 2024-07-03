"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var os = require("os");
var path = require("path");
var winston_1 = require("winston");
var fclone_1 = require("fclone");
var yargs_1 = require("yargs");
var constants_1 = require("./constants");
var fluentLogger = require("fluent-logger");
require('winston-log-and-exit');
var isProd = process.env.NODE_ENV === 'prod';
var isECS = process.env.HEAP_ECS === 'true';
var mainFilename = (function () {
    // process.mainModule is undefined when node reads from STDIN.
    var mainModule = process.mainModule;
    if (!mainModule) {
        return 'unknown';
    }
    var basename = path.basename(mainModule.filename);
    if (basename === 'pm2_loader.js') {
        try {
            if (typeof yargs_1.argv.pm2path === 'string') {
                return path.basename(yargs_1.argv.pm2path);
            }
        }
        catch (e) {
            // An error was encountered, likely because pm2path wasn't passed
            // in. In this case we'll just use pm2_loader for the mainfilename.
            return basename;
        }
    }
    return basename;
})();
var hostname = os.hostname();
var baseFormat = (0, winston_1.format)(function (info) {
    return __assign(__assign({}, (0, fclone_1.default)(info)), { mainFilename: mainFilename, hostname: hostname });
})();
var formatsToUse = [baseFormat];
var ecsFormat = (0, winston_1.format)(function (info) {
    // First, check if the meta object is actually an error. In this case we want to preserve
    // the error message (which would otherwise be clobbered by the log message). Winston populates
    // the `name` field of the meta object with the class of the object if available, so just check
    // for `name === 'Error'` here.
    if (info.name === 'Error') {
        info.error_message = info.message;
        delete info.message;
        delete info.name; // This field just looks confusing.
        return info;
    }
    // Otherwise, we expect the meta object to be tags for the log line. Apply some rudimentary
    // sanitizing here to stringify unexpected nested objects. All of our tags should be either
    // string or number values.
    for (var _i = 0, _a = Object.keys(info); _i < _a.length; _i++) {
        var key = _a[_i];
        var value = info[key];
        var isString = typeof value === 'string';
        var isNumber = typeof value === 'number';
        if (!isString && !isNumber) {
            info[key] = '' + JSON.stringify(value);
        }
    }
    return info;
})();
if (isProd) {
    formatsToUse.push(winston_1.format.timestamp());
}
if (isECS) {
    formatsToUse.push(ecsFormat, winston_1.format.json());
}
else {
    // formatsToUse.push(format.colorize({ all: true }), format.simple());
    formatsToUse.push(winston_1.format.simple());
}
var transportsToUse = [new winston_1.transports.Console()];
if (isProd && !isECS) {
    var fluentConfig = {
        host: constants_1.FLUENT_HOST,
        port: constants_1.FLUENT_PORT,
        timeout: constants_1.FLUENT_TIMEOUT,
    };
    var fluentTransport = fluentLogger.support.winstonTransport();
    var transport = new fluentTransport('heap.coffee', fluentConfig);
    transportsToUse.push(transport);
}
exports.logger = (0, winston_1.createLogger)({
    format: winston_1.format.combine.apply(winston_1.format, formatsToUse),
    exitOnError: false,
    transports: transportsToUse,
    level: process.env.LOG_LEVEL || 'info',
});

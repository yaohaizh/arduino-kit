const Logger = require('./Logger');
const ConsoleStream = require('./ConsoleStream');

const defaultLogger = new Logger.Logger({ streams: [new ConsoleStream({})] });

module.exports = defaultLogger;

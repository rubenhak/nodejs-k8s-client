import { setupLogger, LoggerOptions, LogLevel, ILogger } from 'the-logger';

const loggerOptions = new LoggerOptions().enableFile(true).pretty(true)
    // .level(LogLevel.debug)
    ;
export const logger = setupLogger('Test', loggerOptions);

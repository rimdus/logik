declare enum LoggerLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    SILENT = 5
}
interface Item {
    msg: string;
    level: string;
}
interface ILoggerOptions {
    level?: number;
    stdout?: boolean;
    filename: string;
}
declare class Logger {
    private options;
    private stack;
    private level;
    private filename;
    private state;
    constructor(options: ILoggerOptions);
    write(text: string): Promise<any>;
    buildLine(msg: string, level: string, args: any): string;
    addToStack(item: Item): void;
    addLog(msg: string, level: string, args?: any): void;
    init(): void;
    process(): void;
    trace(msg: string): void;
    debug(msg: string): void;
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
}
declare function LoggerFactory(options: ILoggerOptions): Logger;
export { LoggerLevel, ILoggerOptions, LoggerFactory as Logger, };

import * as cluster from 'cluster';
import * as fs from 'fs';

enum LoggerLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5,
}

enum State {
  STATE_IDLE = 0,
  STATE_PROCESS = 1,
  STATE_FAIL = 2,
}

let logger: Logger;

interface Item {
  msg: string;
  level: string;
}

interface ILoggerOptions {
  level?: number;
  stdout?: boolean;
  filename?: string;
}

class Logger {
  private options: ILoggerOptions;
  private stack: Item[];
  private level: number;
  private filename: string;
  private state: number;

  constructor(options: ILoggerOptions) {
    this.options = {
      level: LoggerLevel.ERROR,
      stdout: false,
      ...options,
    };
    this.stack = [];
    this.level = this.options.level;
    this.filename = this.options.filename;
    this.state = State.STATE_IDLE;

    cluster.on('message', (worker, msg, handle) => {
      if (msg && msg.type === 'Logger') {
        this.addToStack(msg);
      }

      this.init();
    });
  }

  write(text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.options.stdout) console.log(text);

      if (this.options.filename) {
        fs.appendFile(this.options.filename, `text${'\n'}`, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  buildLine(msg: string, level: string, args?: any[]): string {
    // 'text{0}text{1}text{2}'
    let message = msg;
    if (args.length) {
      for (let i = 0; i <= args.length - 1; i += 1) {
        let arg = args[i];

        if (typeof args[i] === 'object') {
          let obj = args[i];
          if (args[i] instanceof Error) {
            obj = { message: args[i].message, name: args[i].name, stack: args[i].stack };
          }
          try {
            arg = JSON.stringify(obj);
          } catch (e) {
            arg = 'Cant\'t parse argument';
          }
        }

        message = message.replace(new RegExp(`\\{${i + 1}\\}`, 'i'), arg);
      }
    }

    const time = new Date().toISOString();
    return `${time} - ${level.toUpperCase()}: ${message}`;
  }

  addToStack(item: Item): void {
    this.stack.push(item);
  }

  addLog(msg: string, level: string, args?: any[], nativeArgs?: IArguments): void {
    const args2 = nativeArgs.length === 2 ? args : [...nativeArgs].splice(0, 2);
    if (cluster.isMaster) {
      this.addToStack({
        level,
        msg: this.buildLine(msg, level, args2),
      });
      this.init();
    } else {
      process.send({
        msg,
        level,
        type: 'Logger',
      });
    }
  }

  init(): void {
    if (this.state === State.STATE_IDLE && this.stack.length) {
      this.state = State.STATE_PROCESS;
      this.process();
    } else if (this.state === State.STATE_PROCESS && this.stack.length === 0) {
      this.state = State.STATE_IDLE;
    } else if (this.state === State.STATE_FAIL) {
      if (this.stack.length) {
        this.state = State.STATE_PROCESS;
        this.process();
      } else {
        this.state = State.STATE_IDLE;
      }
    }
  }

  process(): void {
    const processNext = () => {
      const last = this.stack[0];
      if (last) {
        this.write(last.msg).then(() => {
          this.stack.shift();
          processNext(); // recursion
        }).catch((e) => {
          console.log(e);
          this.state = State.STATE_FAIL;
          // delay on the error.
          setTimeout(() => {
            this.init();
          }, 2000);
        });
      } else {
        // stop recursion
        this.state = State.STATE_IDLE;
      }
    };

    processNext();
  }

  trace(msg: string, args?: any[], arg2? :any, arg3? :any, arg4? :any, arg5? :any, arg6? :any): void {
    if (LoggerLevel.TRACE >= this.level) {
      this.addLog(msg, 'TRACE', args || [], arguments);
    }
  }

  debug(msg: string, args?: any[], arg2? :any, arg3? :any, arg4? :any, arg5? :any, arg6? :any): void {
    if (LoggerLevel.DEBUG >= this.level) {
      this.addLog(msg, 'DEBUG', args || [], arguments);
    }
  }

  info(msg: string, args?: any[], arg2? :any, arg3? :any, arg4? :any, arg5? :any, arg6? :any): void {
    if (LoggerLevel.INFO >= this.level) {
      this.addLog(msg, 'INFO', args || [], arguments);
    }
  }

  warn(msg: string, args?: any[], arg2? :any, arg3? :any, arg4? :any, arg5? :any, arg6? :any): void {
    if (LoggerLevel.WARN >= this.level) {
      this.addLog(msg, 'WARN', args || [], arguments);
    }
  }

  error(msg: string, args?: any[], arg2? :any, arg3? :any, arg4? :any, arg5? :any, arg6? :any): void {
    if (LoggerLevel.ERROR >= this.level) {
      this.addLog(msg, 'ERROR', args || [], arguments);
    }
  }
}

function loggerFactory(options: ILoggerOptions): Logger {
  return logger || (logger = new Logger(options));
}

export {
  Item,
  LoggerLevel,
  ILoggerOptions,
  Logger,
  loggerFactory as logger,
};

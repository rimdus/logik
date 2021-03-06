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
  private stdout: boolean;
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
    this.stdout = this.options.stdout;
    this.filename = this.options.filename;
    this.state = State.STATE_IDLE;

    cluster.on('message', (worker, msg) => {
      if (msg && msg.type === 'Logger') {
        this.addToStack(msg);
      }

      this.init();
    });
  }

  private write(text: string, level: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.stdout) {
        if (level === 'ERROR') {
          console.error(text);
        } else {
          console.log(text);
        }
      }

      if (this.options.filename) {
        fs.appendFile(this.options.filename, `${text}\n`, (err) => {
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

  public static buildLine(msg: string, level: string, args?: any[]): string {
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

    // what not find set undefined
    message = message.replace(/({\d+})/gim, 'undefined');
    const time = new Date().toISOString();
    return `${time} - ${level.toUpperCase()}: ${message}`;
  }

  private addToStack(item: Item): void {
    this.stack.push(item);
  }

  private addLog(msg: string, level: string, args?: any, nativeArgs?: IArguments): void {
    let argstmp;
    if (nativeArgs.length === 2) {
      argstmp = args;
    } else {
      argstmp = [...nativeArgs];
      argstmp.splice(0, 1);
    }

    const args2 = Array.isArray(argstmp) ? argstmp : [argstmp];

    if (cluster.isMaster) {
      this.addToStack({
        level,
        msg: Logger.buildLine(msg, level, args2),
      });
      this.init();
    } else {
      process.send({
        level,
        msg: Logger.buildLine(msg, level, args2),
        type: 'Logger',
      });
    }
  }

  private init(): void {
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

  private process(): void {
    const processNext = () => {
      const last = this.stack[0];
      if (last) {
        this.write(last.msg, last.level).then(() => {
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

  public trace(msg: string, args?: any[], arg2?: any, arg3?: any, arg4?: any, arg5?: any, arg6?: any): void {
    if (LoggerLevel.TRACE >= this.level) {
      this.addLog(msg, 'TRACE', args, arguments);
    }
  }

  public debug(msg: string, args?: any[], arg2?: any, arg3?: any, arg4?: any, arg5?: any, arg6?: any): void {
    if (LoggerLevel.DEBUG >= this.level) {
      this.addLog(msg, 'DEBUG', args, arguments);
    }
  }

  public info(msg: string, args?: any[], arg2?: any, arg3?: any, arg4?: any, arg5?: any, arg6?: any): void {
    if (LoggerLevel.INFO >= this.level) {
      this.addLog(msg, 'INFO', args, arguments);
    }
  }

  public warn(msg: string, args?: any[], arg2?: any, arg3?: any, arg4?: any, arg5?: any, arg6?: any): void {
    if (LoggerLevel.WARN >= this.level) {
      this.addLog(msg, 'WARN', args, arguments);
    }
  }

  public error(msg: string, args?: any[], arg2?: any, arg3?: any, arg4?: any, arg5?: any, arg6?: any): void {
    if (LoggerLevel.ERROR >= this.level) {
      this.addLog(msg, 'ERROR', args, arguments);
    }
  }

  public setLevel(level: number): void {
    this.level = level;
  }

  public setStdout(stdout: boolean): void {
    this.stdout = stdout;
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

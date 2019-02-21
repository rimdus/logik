import * as cluster from 'cluster';
import * as fs from 'fs';

enum LoggerLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5
}

enum State {
  STATE_IDLE = 0,
  STATE_PROCESS = 1,
  STATE_FAIL = 2
}

let logger: Logger;

interface Item {
  msg: string;
  level: string;
}

interface ILoggerOptions {
  level?: number;
  stdout?: boolean;
  filename: string;
}

class Logger {
  private options: ILoggerOptions;
  private stack: Item[];
  private level: number;
  private filename: string;
  private state: number;

  constructor(options: ILoggerOptions) {
    this.options = Object.assign({
      level: LoggerLevel.INFO,
      stdout: false
    }, options);
    this.stack = [];
    this.level = this.options.level;
    this.filename = this.options.filename;
    this.state = State.STATE_IDLE;

    cluster.on('message', (worker, msg, handle) => {
      if (msg && msg.type === 'Logger')
        this.addToStack(msg);
      this.init();
    });
  }

  write(text: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.options.stdout)
        console.log(text);

      fs.appendFile(this.options.filename, text + '\n', (err) => {
        if (err)
          reject(err);
        else
          resolve();
      });
    });
  }

  buildLine(msg: string, level: string, args: any): string {
    // 'text{0}text{1}text{2}'
    if (args.length > 1) {
      for (let i = 1; i <= args.length; i++) {
        let arg;

        try {
          arg = (typeof args[i] === 'object') ? JSON.stringify(args[i]) : args[i];
        }
        catch (e) {
          arg = '';
        }

        msg = msg.replace(new RegExp(`\\{${i}\\}`, 'i'), arg);
      }
    }

    let time = new Date().toISOString();
    return `${time} - ${level.toUpperCase()}: ${msg}`;
  }

  addToStack(item: Item): void {
    this.stack.push(item);
  }

  addLog(msg: string, level: string, args?: any): void {
    if (cluster.isMaster) {
      this.addToStack({
        msg: this.buildLine(msg, level, args),
        level: level
      });
      this.init();
    } else {
      process.send({
        type: 'Logger',
        msg: msg,
        level: level
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
    let self = this;
    processNext();

    function processNext(): void {
      let last = self.stack[0];
      if (last)
        self.write(last.msg).then(() => {
          self.stack.shift();
          processNext(); // recursion
        }).catch((e) => {
          console.log(e);
          self.state = State.STATE_FAIL;
          // delay on the error.
          setTimeout(() => {
            self.init();
          }, 2000);
        });
      else {
        // stop recursion
        self.state = State.STATE_IDLE;
      }
    }
  }

  trace(msg: string): void {
    if (LoggerLevel.TRACE >= this.level) {
      this.addLog(msg, 'TRACE', arguments);
    }
  }

  debug(msg: string): void {
    if (LoggerLevel.DEBUG >= this.level) {
      this.addLog(msg, 'DEBUG', arguments);
    }
  }

  info(msg: string): void {
    if (LoggerLevel.INFO >= this.level) {
      this.addLog(msg, 'INFO', arguments);
    }
  }

  warn(msg: string): void {
    if (LoggerLevel.WARN >= this.level) {
      this.addLog(msg, 'WARN', arguments);
    }
  }

  error(msg: string): void {
    if (LoggerLevel.ERROR >= this.level) {
      this.addLog(msg, 'ERROR', arguments);
    }
  }
}

function LoggerFactory(options: ILoggerOptions) {
  return logger || (logger = new Logger(options));
}

export {
  LoggerLevel,
  ILoggerOptions,
  LoggerFactory as Logger,
};
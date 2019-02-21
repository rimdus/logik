"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cluster = require("cluster");
const fs = require("fs");
var LoggerLevel;
(function (LoggerLevel) {
    LoggerLevel[LoggerLevel["TRACE"] = 0] = "TRACE";
    LoggerLevel[LoggerLevel["DEBUG"] = 1] = "DEBUG";
    LoggerLevel[LoggerLevel["INFO"] = 2] = "INFO";
    LoggerLevel[LoggerLevel["WARN"] = 3] = "WARN";
    LoggerLevel[LoggerLevel["ERROR"] = 4] = "ERROR";
    LoggerLevel[LoggerLevel["SILENT"] = 5] = "SILENT";
})(LoggerLevel || (LoggerLevel = {}));
exports.LoggerLevel = LoggerLevel;
var State;
(function (State) {
    State[State["STATE_IDLE"] = 0] = "STATE_IDLE";
    State[State["STATE_PROCESS"] = 1] = "STATE_PROCESS";
    State[State["STATE_FAIL"] = 2] = "STATE_FAIL";
})(State || (State = {}));
let logger;
class Logger {
    constructor(options) {
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
    write(text) {
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
    buildLine(msg, level, args) {
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
    addToStack(item) {
        this.stack.push(item);
    }
    addLog(msg, level, args) {
        if (cluster.isMaster) {
            this.addToStack({
                msg: this.buildLine(msg, level, args),
                level: level
            });
            this.init();
        }
        else {
            process.send({
                type: 'Logger',
                msg: msg,
                level: level
            });
        }
    }
    init() {
        if (this.state === State.STATE_IDLE && this.stack.length) {
            this.state = State.STATE_PROCESS;
            this.process();
        }
        else if (this.state === State.STATE_PROCESS && this.stack.length === 0) {
            this.state = State.STATE_IDLE;
        }
        else if (this.state === State.STATE_FAIL) {
            if (this.stack.length) {
                this.state = State.STATE_PROCESS;
                this.process();
            }
            else {
                this.state = State.STATE_IDLE;
            }
        }
    }
    process() {
        let self = this;
        processNext();
        function processNext() {
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
    trace(msg) {
        if (LoggerLevel.TRACE >= this.level) {
            this.addLog(msg, 'TRACE', arguments);
        }
    }
    debug(msg) {
        if (LoggerLevel.DEBUG >= this.level) {
            this.addLog(msg, 'DEBUG', arguments);
        }
    }
    info(msg) {
        if (LoggerLevel.INFO >= this.level) {
            this.addLog(msg, 'INFO', arguments);
        }
    }
    warn(msg) {
        if (LoggerLevel.WARN >= this.level) {
            this.addLog(msg, 'WARN', arguments);
        }
    }
    error(msg) {
        if (LoggerLevel.ERROR >= this.level) {
            this.addLog(msg, 'ERROR', arguments);
        }
    }
}
function LoggerFactory(options) {
    return logger || (logger = new Logger(options));
}
exports.Logger = LoggerFactory;
//# sourceMappingURL=index.js.map
"use strict";
const cluster = require("cluster");
const fs = require("fs");
const TRACE = 0, DEBUG = 1, INFO = 2, WARN = 3, ERROR = 4, SILENT = 5, STATE_IDLE = 0, STATE_PROCESS = 1, STATE_FAIL = 2;
let logger;
class Logger {
    constructor(opt) {
        this.opt = Object.assign({
            level: INFO,
            stdout: false
        }, opt);
        this.stack = [];
        this.level = this.opt.level;
        this.filename = this.opt.filename;
        this.state = STATE_IDLE;
        cluster.on('message', (worker, msg, handle) => {
            if (msg && msg.type === 'Logger')
                this.addToStack(msg);
            this.init();
        });
    }
    write(text) {
        return new Promise((resolve, reject) => {
            if (this.opt.stdout)
                console.log(text);
            fs.appendFile(this.opt.filename, text + '\n', (err) => {
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
        if (this.state === STATE_IDLE && this.stack.length) {
            this.state = STATE_PROCESS;
            this.process();
        }
        else if (this.state === STATE_PROCESS && this.stack.length === 0) {
            this.state = STATE_IDLE;
        }
        else if (this.state === STATE_FAIL) {
            if (this.stack.length) {
                this.state = STATE_PROCESS;
                this.process();
            }
            else {
                this.state = STATE_IDLE;
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
                    self.state = STATE_FAIL;
                    // delay on the error.
                    setTimeout(() => {
                        self.init();
                    }, 2000);
                });
            else {
                // stop recursion
                self.state = STATE_IDLE;
            }
        }
    }
    trace(msg) {
        if (TRACE >= this.level) {
            this.addLog(msg, 'TRACE', arguments);
        }
    }
    debug(msg) {
        if (DEBUG >= this.level) {
            this.addLog(msg, 'DEBUG', arguments);
        }
    }
    info(msg) {
        if (INFO >= this.level) {
            this.addLog(msg, 'INFO', arguments);
        }
    }
    warn(msg) {
        if (WARN >= this.level) {
            this.addLog(msg, 'WARN', arguments);
        }
    }
    error(msg) {
        if (ERROR >= this.level) {
            this.addLog(msg, 'ERROR', arguments);
        }
    }
}
module.exports = (opt) => {
    return logger || (logger = new Logger(opt));
};
//# sourceMappingURL=index.js.map
interface Item {
    msg: string;
    level: string;
}
declare class Logger {
    opt: any;
    stack: Array<Item>;
    level: number;
    filename: string;
    state: number;
    constructor(opt: any);
    write(text: string): Promise<{}>;
    buildLine(msg: string, level: string, args: any): string;
    addToStack(item: Item): void;
    addLog(msg: string, level: string, args?: any): void;
    init(): void;
    process(): void;
    trace(msg: any): void;
    debug(msg: any): void;
    info(msg: any): void;
    warn(msg: any): void;
    error(msg: any): void;
}
declare const _default: (opt: any) => Logger;
export = _default;

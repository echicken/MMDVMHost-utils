'use strict';

const events = require('events');
const fs = require('fs');
const util = require('util');

const ini = require('ini');
const chokidar = require('chokidar');

const Confrigger = function (opts) {

    events.EventEmitter.call(this);

    let cfg = {};
    let watcher = null;

    let load_ini = () => {
        try {
            let _cfg = ini.parse(fs.readFileSync(opts.path, 'utf8'));
            Object.keys(_cfg).forEach(
                (e) => {
                    if (typeof cfg[e] === 'undefined') cfg[e] = {};
                    Object.keys(_cfg[e]).forEach(
                        (ee) => {
                            if (typeof cfg[e][ee] === 'undefined' ||
                                cfg[e][ee] !== _cfg[e][ee]
                            ) {
                                cfg[e][ee] = _cfg[e][ee];
                                this.emit(
                                    'update', { [e] : { [ee] : cfg[e][ee] } }
                                );
                            }
                        }
                    );
                }
            );
        } catch (err) {
            this.emit('error', err);
        }
    }

    function watch(path) {
        if (watcher !== null) watcher.close();
        watcher = chokidar.watch(path, { awaitWriteFinish : true });
        watcher.on('change', load_ini);
    }

    this.init = function (_watch) {
        load_ini();
        if (_watch) watch(opts.path);
    }

    this.save_cfg = () => {
        fs.writeFile(
            opts.path, ini.stringify(cfg), 'utf8', (err) => {
                if (err) this.emit('error', err);
            }
        );
    }

    this.get_cfg = () => cfg;
    Object.defineProperty(
        this, 'cfg', {
            get : () => { return cfg; }
        }
    );
    
    this.set_cfg = function (section, key, val, commit) {
        if (typeof section !== 'string' || typeof key !== 'string') {
            this.emit('error', 'set_cfg: "section" and "key" must be strings');
        } else if (typeof val !== 'string') {
            this.emit('error', 'set_cfg: "value" must be a string');
        } else {
            if (typeof cfg[section] !== 'object') cfg[section] = {};
            cfg[section][key] = val;
        }
        if (commit) this.save_cfg();
    }

    this.stop = function () {
        watcher.close();
        watcher = null;
    }

}
util.inherits(Confrigger, events.EventEmitter);

module.exports = Confrigger;

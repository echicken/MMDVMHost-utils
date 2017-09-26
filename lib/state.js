'use strict';

const events = require('events');
const util = require('util');

const LogDriver = require('./logdriver.js');
const Confrigger = require('./confrigger.js');

// { config_file, log_base, log_prefix }
const State = function (opts) {

    events.EventEmitter.call(this);

    // good enough for these porpoises
    function clone_obj(o) {
        let r = {};
        Object.keys(o).forEach(
            (e) => {
                r[e] = (
                    (o[e] !== null && typeof o[e] === 'object')
                    ? clone_obj(o[e])
                    : o[e]
                );
            }
        );
        return r;
    }

    const _dmr_slot = {
        rx : false,
        rx_start : null,
        seconds : 0,
        slot : 0,
        source : '',
        destination : '',
        bit_error_rate : 0
    };

    const _properties = {
        host : {
            starting : false,
            running : false,
            exited : '',
            version : ''
        },
        device : {
            opening : false,
            open : false,
            protocol : {
                version : '',
                description : '',
                git_id : ''
            }
        },
        dmr_id : {
            lookup_thread_running : false
        },
        dmr_net : {
            opening : false,
            sending_authorization : false,
            sending_configuration : false,
            open : false
        },
        dmr_rf : {
            rx : [],
            tx : []
        }
    };
    const properties = clone_obj(_properties);

    this.cfg = new Confrigger({ path : opts.config_file });
    this.cfg.on('error', (err) => { this.emit('error', err); });
    this.cfg.on('update', (update) => { this.emit('config_update', update); });

    const ld = new LogDriver({ base : opts.log_base, prefix : opts.log_prefix });
    ld.on('error', (err) => { this.emit('error', err); });

    ld.on(
        'host_starting', (data) => {
            properties.host = clone_obj(_properties.host);
            properties.host.starting = true;
            properties.host.version = data.data.version;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'host_running', (data) => {
            properties.host = clone_obj(_properties.host);
            properties.host.running = true;
            properties.host.version = data.data.version;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'host_exited', (data) => {
            properties.host = clone_obj(_properties.host);
            properties.host.exited = data.data.signal;
            properties.host.version = data.data.version;
            this.emit(data.type, data);
        }
    );

    ld.on(
        'device_opening', (data) => {
            properties.device = clone_obj(_properties.device);
            properties.device.opening = true;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'device_closing', (data) => {
            properties.device = clone_obj(_properties.device);
            this.emit(data.type, data);
        }
    );
    ld.on(
        'device_protocol', (data) => {
            properties.device = clone_obj(_properties.device);
            properties.device.open = true;
            properties.device.protocol.version = data.data.version;
            properties.device.protocol.description = data.data.description;
            properties.device.protocol.git_id = data.data.git_id;
            this.emit(data.type, data);
        }
    );

    ld.on(
        'dmr_net_opening', (data) => {
            properties.dmr_net = clone_obj(_properties.dmr_net);
            properties.dmr_net.opening = true;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_net_sending_authorization', (data) => {
            properties.dmr_net = clone_obj(_properties.dmr_net);
            properties.dmr_net.sending_authorization = true;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_net_sending_configuration', (data) => {
            properties.dmr_net = clone_obj(_properties.dmr_net);
            properties.dmr_net.sending_configuration = true;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_net_logged_in', (data) => {
            properties.dmr_net = clone_obj(_properties.dmr_net);
            properties.dmr_net.open = true;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_net_closing', (data) => {
            properties.dmr_net = clone_obj(_properties.dmr_net);
            this.emit(data.type, data);
        }
    );

    ld.on(
        'dmr_id_thread_started', (data) => {
            properties.dmr_id.lookup_thread_running = true;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_id_thread_stopped', (data) => {
            properties.dmr_id.lookup_thread_running = false;
            this.emit(data.type, data);
        }
    );

    ld.on(
        'dmr_rf_rx_voice_header', (data) => {
            properties.dmr_rf.rx[data.data.slot] = clone_obj(_dmr_slot);
            properties.dmr_rf.rx[data.data.slot].rx = true;
            properties.dmr_rf.rx[data.data.slot].source = data.data.source;
            properties.dmr_rf.rx[data.data.slot].destination = data.data.destination;
            properties.dmr_rf.rx[data.data.slot].rx_start = data.time;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_rf_rx_voice_frame', (data) => {
            if (!(properties.dmr_rf.rx[data.data.slot].rx_start instanceof Date)) {
                properties.dmr_rf.rx[data.data.slot].rx = true;
                properties.dmr_rf.rx[data.data.slot].rx_start = data.time;
            }
            properties.dmr_rf.rx[data.data.slot].bit_error_rate = data.data.ber;
            this.emit(data.type, data);
        }
    );
    ld.on(
        'dmr_rf_rx_voice_end', (data) => {
            if (!(properties.dmr_rf.rx[data.data.slot].rx_start instanceof Date)) {
                properties.dmr_rf.rx[data.data.slot].rx_start = data.time;
            }
            properties.dmr_rf.rx[data.data.slot].rx = false;
            properties.dmr_rf.rx[data.data.slot].bit_error_rate = data.data.ber;
            properties.dmr_rf.rx[data.data.slot].seconds = data.data.seconds;
            this.emit(data.type, data);
        }
    );

    Object.defineProperty(
        this, 'status', {
            get : () => { return properties; }
        }
    );

    this.init = function () {
        this.cfg.init(true);
        ld.init(true, false, true, true);
    }

    this.stop = function () {
        this.cfg.stop();
        this.ld.stop();
    }

}
util.inherits(State, events.EventEmitter);

module.exports = State;

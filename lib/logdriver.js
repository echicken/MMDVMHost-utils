'use strict';

const events = require('events');
const fs = require('fs');
const util = require('util');
const path = require('path');

const Tail = require('tail').Tail;

const log_line_match_offset = 2;
const log_file_name_pattern = '^MMDVM-(\\d{4}-\\d\\d-\\d\\d?)\\.log$';
const log_line_prefix = '^(\\w?)\\: (\\d{4}-\\d\\d-\\d\\d \\d\\d:\\d\\d:\\d\\d\\.\\d{3}?)\\s+';
const log_line_patterns = {
    host_starting : {
        pattern : 'MMDVMHost-(\\w*?) is starting',
        data : [
            { name : 'version' }
        ]
    },
    host_running : {
        pattern : 'MMDVMHost-(\\w*?) is running',
        data : [
            { name : 'version' }
        ]
    },
    host_exited : {
        pattern : 'MMDVMHost-(\\w*?) exited on receipt of (\\w+?)$',
        data : [
            { name : 'version' },
            { name : 'signal' }
        ]
    },
    device_opening : {
        pattern : 'Opening the MMDVM'
    },
    device_closing : {
        pattern : 'Closing the MMDVM'
    },
    device_protocol : {
        pattern : 'MMDVM protocol version: (\\w+?), description: (.*?) GitID #(\\w+?)$',
        data : [
            { name : 'version' },
            { name : 'description' },
            { name : 'git_id' }
        ]
    },
    dmr_net_opening : {
        pattern : 'DMR, Opening DMR Network'
    },
    dmr_net_closing : {
        pattern : 'DMR, Closing DMR Network'
    },
    dmr_net_sending_authorization : {
        pattern : 'DMR, Sending authorisation'
    },
    dmr_net_sending_configuration : {
        pattern : 'DMR, Sending configuration'
    },
    dmr_net_logged_in : {
        pattern : 'DMR, Logged into the master successfully'
    },
    dmr_id_thread_started : {
        pattern : 'Started the DMR Id lookup reload thread'
    },
    dmr_id_thread_stopped : {
        pattern : 'Stopped the DMR Id lookup reload thread'
    },
    dmr_rf_rx_voice_header : {
        pattern : 'DMR Slot (\\d?), received RF voice header from (\\w+?) to (.*?)$',
        data : [
            { name : 'slot', transform : parseInt },
            { name : 'source' },
            { name : 'destination' }
        ]
    },
    dmr_rf_rx_voice_frame : {
        pattern : 'DMR Slot (\\d?), audio sequence no\. (\\d+?), errs: (\\d+?)\\/\\d+ \\((\\d+\\.\\d+?)%\\)',
        data : [
            { name : 'slot', transform : parseInt },
            { name : 'sequence', transform : parseInt },
            { name : 'errs', transform : parseInt },
            { name : 'ber', transform : parseFloat }
        ]
    },
    dmr_rf_rx_voice_end : {
        pattern : 'DMR Slot (\\d?), received RF end of voice transmission, (\\d+\\.\\d+?) seconds, BER: (\\d+\\.\\d+?)%',
        data : [
            { name : 'slot', transform : parseInt },
            { name : 'seconds', transform : parseFloat },
            { name : 'ber', transform : parseFloat }
        ]
    }
};

function matcher(str, pattern) {
    let matches = new RegExp(pattern, 'ig').exec(str);
    return matches === null ? null : matches.slice(1);
}

function file_filter(files, pattern, prefix) {
    return files.filter(
        (e) => {
            let matches = matcher(e, pattern.replace(/MMDVM/, prefix));
            return matches ? matches.length > 0 : false;
        }
    );
}

function file_sort(files, pattern) {
    return files.sort(
        (a, b) => {
            let _a = (new Date(matcher(a, pattern)[0])).getTime();
            let _b = (new Date(matcher(b, pattern)[0])).getTime();
            return _a > _b ? 1 : (_a < _b ? -1 : 0);
        }
    );
}

function get_log_files(base, prefix, pattern, cb) {
    fs.readdir(
        base, (err, files) => {
            cb(err, files ? file_sort(file_filter(files, pattern, prefix), pattern) : []);
        }
    );
}

function parse_log_line(type, def, matches) {
    let r = {
        type : type,
        level : matches[0],
        time : new Date(matches[1]),
        data : {}
    };
    if (typeof def.data !== 'undefined') {
        def.data.forEach(
            (e, i) => {
                r.data[e.name] = (
                    typeof e.transform === 'function'
                    ? e.transform(matches[log_line_match_offset + i])
                    : matches[log_line_match_offset + i]
                );
            }
        );
    }
    return r;
}

const LogDriver = function (opts) {

    events.EventEmitter.call(this);

    const state = {
        tail : null,
        new_file_event : null,
        current_file : null
    };

    let handle_log_line = (str) => {
        let handled = Object.keys(log_line_patterns).some(
            (e) => {
                let matches = matcher(
                    str, log_line_prefix + log_line_patterns[e].pattern
                );
                if (matches !== null) {
                    let ll = parse_log_line(e, log_line_patterns[e], matches);
                    this.emit('log_line', ll);
                    this.emit(e, ll);
                    return true;
                } else {
                    return false;
                }
            }
        );
        if (!handled) this.emit('unhandled_log_line', str);
    }

    let handle_log_file = (file) => {
        try {
            let data = fs.readFileSync(path.join(opts.base, file), 'utf8');
            data.split(/\n/).forEach((e) => handle_log_line(e.trim()));
        } catch (err) {
            this.emit('error', err);
        }
    }

    let tail = (file) => {
        if (state.tail !== null) state.tail.unwatch();
        state.tail = new Tail(path.join(opts.base, file));
        state.tail.on('error', (err) => { this.emit('error', err); });
        state.tail.on('line', (data) => { handle_log_line(data); });
        state.current_file = file;
    }

    let tail_next = () => {
        if (state.new_file_event === null) {
            state.new_file_event = setInterval(
                tail_next, opts.new_file_interval || 60000
            );
        }
        get_log_files(
            opts.base, opts.prefix, log_file_name_pattern, (err, files) => {
                if (files[files.length - 1] !== state.current_file &&
                    typeof files[files.length -1] === 'string'
                ) {
                    if (state.tail instanceof Tail) state.tail.unwatch();
                    handle_log_file(files[files.length - 1]);
                    tail(files[files.length - 1]);
                }
            }
        );
    }

    this.init = function (replay_all, replay_current, tail_current, tail_future) {
        get_log_files(
            opts.base, opts.prefix, log_file_name_pattern, (err, files) => {
                if (err) {
                    this.emit('error', err);
                } else {
                    if (replay_all) {
                        files.forEach(handle_log_file);
                    } else if (replay_current) {
                        handle_log_file(files[files.length - 1]);
                    }
                    if (tail_current) tail(files[files.length - 1]);
                    if (tail_future) {
                        state.current_file = files[files.length - 1];
                        tail_next();
                    }
                }
            }
        );
    }

    this.stop = function () {
        if (state.new_file_event !== null) {
            clearInterval(state.new_file_event);
            state.new_file_event = null;
        }
        if (state.tail !== null) state.tail.unwatch();
    }

}
util.inherits(LogDriver, events.EventEmitter);

module.exports = LogDriver;

'use strict';

const MMDVMHost = require('../index.js');

let state = new MMDVMHost.State(
    {   config_file : '/opt/MMDVMHost/MMDVM.ini',
        log_base : '/var/log',
        log_prefix : 'MMDVM'
    }
);

state.on('error', (err) => console.log(err));

state.on('host_starting', (data) => console.log(state.status.host));
state.on('host_running', (data) => console.log(state.status.host));
state.on('host_exited', (data) => console.log(state.status.host));

state.on('device_open', (data) => console.log(state.status.device));
state.on('device_close', (data) => console.log(state.status.device));
state.on('device_protocol', (data) => console.log(state.status.device));

state.on('dmr_net_opening', (data) => console.log(state.status.dmr_net));
state.on('dmr_net_sending_authorization', (data) => console.log(state.status.dmr_net));
state.on('dmr_net_sending_configuration', (data) => console.log(state.status.dmr_net));
state.on('dmr_net_logged_in', (data) => console.log(state.status.dmr_net));
state.on('dmr_net_closing', (data) => console.log(state.status.dmr_net));

state.on('dmr_id_thread_started', (data) => console.log(state.status.dmr_id));
state.on('dmr_id_thread_stopped', (data) => console.log(state.status.dmr_id));

state.on('dmr_rf_rx_voice_header', (data) => console.log(state.status.dmr_rf.rx[data.data.slot]));
state.on('dmr_rf_rx_voice_frame', (data) => console.log(state.status.dmr_rf.rx[data.data.slot]));
state.on('dmr_rf_rx_voice_end', (data) => console.log(state.status.dmr_rf.rx[data.data.slot]));

state.init();

console.log(state.cfg.get_cfg());

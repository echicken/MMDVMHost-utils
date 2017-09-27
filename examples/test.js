'use strict';

const MMDVMHost = require('../index.js');

const state = new MMDVMHost.State(
    {   config_file : '/opt/MMDVMHost/MMDVM.ini',
        log_base : '/var/log',
        log_prefix : 'MMDVM'
    }
);

function barf(data, obj) {
    console.log(data.time, data.type, obj);
}

state.on('error', (err) => console.log(err));

state.on(
    'host_starting', (data) => {
        barf(data, state.status.host);
    }
);
state.on(
    'host_running', (data) => {
        barf(data, state.status.host);
    }
);
state.on(
    'host_exited', (data) => {
        barf(data, state.status.host);
    }
);

state.on(
    'device_open', (data) => {
		barf(data, state.status.device);
	}
);
state.on(
    'device_close', (data) => {
		barf(data, state.status.device);
	}
);
state.on(
    'device_protocol', (data) => {
		barf(data, state.status.device);
	}
);

state.on(
    'dmr_net_opening', (data) => {
		barf(data, state.status.dmr.net);
	}
);
state.on(
    'dmr_net_sending_authorization', (data) => {
        barf(data, state.status.dmr.net);
    }
);
state.on(
    'dmr_net_sending_configuration', (data) => {
        barf(data, state.status.dmr.net);
    }
);
state.on(
    'dmr_net_logged_in', (data) => {
		barf(data, state.status.dmr.net);
	}
);
state.on(
    'dmr_net_closing', (data) => {
		barf(data, state.status.dmr.net);
	}
);

state.on(
    'dmr_id_thread_started', (data) => {
        barf(data, state.status.dmr.id);
    }
);
state.on(
    'dmr_id_thread_stopped', (data) => {
        barf(data, state.status.dmr.id);
    }
);

state.on(
    'dmr_rf_rx_voice_header', (data) => {
        barf(data, state.status.dmr.rf.rx[data.data.slot]);
    }
);
state.on(
    'dmr_rf_rx_voice_frame', (data) => {
        barf(data, state.status.dmr.rf.rx[data.data.slot]);
    }
);
state.on(
    'dmr_rf_rx_voice_end', (data) => {
        barf(data, state.status.dmr.rf.rx[data.data.slot]);
    }
);

state.init();

console.log(state.cfg.get_cfg());

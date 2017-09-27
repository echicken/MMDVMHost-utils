# MMDVMHost-utils
A node.js module to monitor MMDVMHost logs, monitor and modify the configuration file.

- [LogDriver](#logdriver)
    - Consumes, parses, and monitors MMDVMHost log files
- [Confrigger](#confrigger)
    - Reads, writes, and monitors an MMDVMHost configuration file
- [State](#state)
    - Uses [LogDriver](#logdriver) to track the current state of MMDVMHost
    - Exposes an instance of [Confrigger](#confrigger)

The current focus of the [LogDriver](#logdriver) component is on DMR-related features.  D-Star, System Fusion, etc. related stuff may be added at a later date, but I don't care about those things right now.

## LogDriver

Monitors the MMDVMHost log, parses log lines into objects, and emits events when
new log lines are encountered.

```js
const LogDriver = require('MMDVMHost-utils').LogDriver;

let ld = new LogDriver({ base : '/var/log', prefix : 'MMDVM' });
ld.on('error', (err) => console.log(err));
ld.on(
    'dmr_rf_rx_voice_header',
    (data) => console.log('DMR voice header received', data)
);
ld.on(
    'dmr_rf_rx_voice_end',
    (data) => console.log('DMR voice transmission ended', data)
);
ld.init(true, false, true, true);
```

### Methods

- init(Boolean replay_all, Boolean replay_current, Boolean tail_current, Boolean tail_future)
    - *replay_all* - Consume all existing log files?
        - LogDriver will emit an event for every log line it encounters during the replay (see *Events* below)
    - *replay_current* - Consume the current log file? (Has no effect if *replay_all* is *true*)
        - LogDriver will emit an event for every log line it encounters during the replay (see *Events* below)
    - *tail_current* - Watch for new entries in the current log file?
    - *tail_future* - Watch for new log files, and watch them for new entries when they appear?
    - This method must be called before anything useful can be done
- stop()
    - Stop monitoring log files.

### Events

- error
    - Callback receives an Error object describing the error

Other event callbacks receive an Object parameter with the following properties:
- type (String)
    - The name of the event, eg. 'host_starting'
- level (String)
    - The log level of the event, eg. 'M'
    - (Debug, Message, Info, Warning, Error, Fatal)
- time (Date)
    - The timestamp of the log line, parsed into a Date object
- data (Object)
    - Any additional event-specific data (see below)

LogDriver emits the following additional events, with event-specific data where noted:

- host_starting
    - version (String)
        - MMDVMHost version
- host_running
    - version (String)
        - MMDVMHost version
- host_exited
    - version (String)
        - MMDVMHost version
    - signal (String)
        - Signal that caused MMDVMHost to terminate (eg. 'SIGTERM')

- device_opening
- device_protocol
    - version (String)
        - MMDVM protocol version
    - description (String)
        - eg. 'MMDVM_HS-ADF7021 20170715 (DStar/DMR/YSF/P25)'
    - git_id (String)
        - Latest Git commit ID hash when MMDVMHost was built, I guess. (eg. '3651b90')
- device_closing

- dmr_net_opening
- dmr_net_sending_authorization
- dmr_net_sending_configuration
- dmr_net_logged_in
- dmr_net_closing

- dmr_id_thread_started
- dmr_id_thread_stopped

- dmr_rf_rx_voice_header
    - slot (Number) (integer)
        - Time slot
    - source (String)
        - Source callsign or DMR ID
    - destination (String)
        - Destination (talk group, etc.)
- dmr_rf_rx_voice_frame
    - slot (Number) (integer)
        - Time slot
    - sequence (Number) (integer)
        - Sequence number of this voice frame
    - errs (Number) (integer)
        - Number of errors in this sequence of voice frames, out of 141
    - ber (Number) (float)
        - Bit error rate, as a percentage; essentially errs/141
- dmr_rf_rx_voice_end
    - slot (Number) (integer)
        - Time slot
    - seconds (Number) (float)
        - Duration of the voice transmission
    - ber (Number) (float)
        - Bit error rate, as a percentage

- log_line
    - Fired for all of the above
- unhandled_log_line
    - Fired for log lines currently not handled by LogDriver

## Confrigger

Reads and writes the MMDVM INI configuration file, optionally monitoring the
file for changes made by external sources.

```js
const Confrigger = require('MMDVMHost-utils').Confrigger;

let cfrig = new Confrigger({ path : '/opt/MMDVMHost/MMDVM.ini' });
cfrig.on('error', (err) => console.log(err));
cfrig.on('update', (update) => console.log(update));
cfrig.init(true);
console.log(cfrig.get_cfg());
cfrig.set_cfg('General', 'Callsign', 'VE3XEC', true);
console.log(cfrig.get_cfg().General.Callsign);
```

### Properties

- cfg (Object) (read only)
    - An Object representing the current state of the configuration file
        - Top-level properties map to sections of the INI file
            - Sub-properties map to key-value pairs from that section

### Methods

- init(Boolean watch)
    - *watch* - Watch for changes to the log file?
    - This method must be called before anything useful can be done
- get_cfg()
    - Return value is the same as the 'cfg' property described above
- set_cfg(String section, String key, String value, Boolean commit)
    - *section* - Which section of the configuration file this key belongs to
    - *key* - The name of the key to create or modify
    - *value* - The value to set for this key
    - *commit* - Save changes immediately?
- save_cfg()
    - Writes all changes to the configuration file

### Events

- error
    - Callback receives an Error object describing the error
- update
    - A line in the configuration file has been changed by some external process
    - Callback receives an Object parameter describing the change, like this:
        - { [section] : { [key] : [value] } }


## State

A wrapper around LogDriver and Confrigger that lets you monitor the current
state of MMDVMHost, view and change the settings.

```js
const State = require('MMDVMHost-utils').State;

let state = new State(
    {   config_file : '/opt/MMDVMHost/MMDVM.ini',
        log_base : '/var/log',
        log_prefix : 'MMDVM'
    }
);
state.on('error', (err) => console.log(err));
// register event listeners here
state.init();
```

### Properties

- status (Object) (read only)
    - host (Object)
        - starting (Boolean)
            - MMDVMHost is starting up
        - running (Boolean)
            - MMDVMHost is running
        - exited (String)
            - If !starting and !running, this is the signal that told MMDVMHost to shut down
            - or blank if it hasn't been running yet
        - version (String)
    - device (Object)
        - opening (Boolean)
            - Opening the MMDVM device
        - open (Boolean)
            - MMDVM device is open
        - protocol (Object)
            - version (String)
            - description (String)
            - git_id (String)
    - dmr (Object)
        - id (Object)
            - lookup_thread_running (Boolean)
        - net (Object)
            - opening (Boolean)
                - Connecting to a DMR master
            - sending_authorization (Boolean)
                - Connected, attempting to authenticate
            - sending_configuration (Boolean)
                - Connected, authenticated, sending configuration to master
            - open (Boolean)
                - Connected and ready to go
        - rf (Object)
            - rx (Array of Objects)
                - rx (Boolean)
                    - Currently receiving a transmission
                        - (We saw a voice header or voice frame and we've yet to be told that the transmission ended)
                - rx_start (Date || null)
                    - Time that the transmission started
                - seconds (Number) (float)
                    - Not populated until transmission has ended
                - slot (Number) (integer)
                    - Time slot of this transmission
                - source (String)
                    - Callsign or DMR ID
                - destination (String)
                    - Talk group, etc.
                - bit_error_rate : (Number) (float)
                    - Bit error rate for this transmission, as a percentage
            - tx (Array)
                - currently unused
- cfg (Confrigger)
    - An instance of Confrigger (see above)
- ld (LogDriver)
    - An instance of LogDriver (see above)

### Methods

- init()
    - Starts our LogDriver and Confrigger instances
    - This method must be called before anything useful can be done
- stop()
    - Stops our LogDriver and Confrigger instances

### Events

- error
    - Callback receives an Error object describing the error
- config_update
    - Identical to the Confrigger 'update' event described above

Additionally, *State* emits all of the same events fired by LogDriver, as
described above.

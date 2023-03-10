const fs = require('fs');
const {spawn} = require('child_process');
const AbstractGSTDevice = require('./AbstractGSTDevice');

module.exports = class PlaybackDevice extends AbstractGSTDevice {
    constructor(config, pipePrefix) {
        super(config, pipePrefix);

        this.uri = config.uri || '';
    }

    spawnProcess(pipeline) {
        // If trying to play a local file, handle "file not found" errors more gracefully
        if (this.uri.startsWith('file://') && !fs.existsSync(this.uri.substring(7))) {
            throw new Error('PlaybackDevice: file not found at ' + this.uri);
        }

        return spawn('gst-launch-1.0', [
            'uridecodebin',
            'uri="' + this.uri + '"',
            ...pipeline.split(' '),
        ]);
    }
}

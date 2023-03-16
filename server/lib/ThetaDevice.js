const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');
const AbstractGSTDevice = require('./AbstractGSTDevice');

// The pipeline is hard-coded in the C program
// To prevent obscure errors in case the limit is ever reached we'll check the length here
// The 2 values in the calculation below are the maximum char length and the length of the beginning of the pipeline hard-coded in C
const MAX_PIPE_LINE_LENGTH = 1024 - 45;

module.exports = class ThetaDevice extends AbstractGSTDevice {
    constructor(config, pipePrefix) {
        super(config, pipePrefix);

        this.recordPath = config['raw-record-path'];
    }

    pipelineRecord() {
        if (!this.recordPath) {
            return '';
        }

        if (!fs.existsSync(this.recordPath)) {
            console.warn('Invalid recording directory ' + this.recordPath);
            return '';
        }

        const now = new Date();
        const filename = this.recordPath + '/' + this.key + '-' + now.toISOString().split('.')[0].replace('T', '-').replace(':', '-') + '.mkv';

        console.log('Recording raw H264 stream to ' + filename);

        return 'tee name=stream ! ' + this.pipelineQueue() + ' ! matroskamux streamable=true ! ' + this.pipelineQueue() + ' ! filesink location="' + filename + '" stream. ! ';
    }

    spawnProcess(pipeline) {
        const thetaPipeline = this.pipelineRecord() + 'decodebin' + pipeline;

        if (thetaPipeline.length > MAX_PIPE_LINE_LENGTH) {
            throw new Error('GST Pipeline is too large for Theta executable (' + thetaPipeline + ')');
        }

        return spawn(path.join(__dirname, '..', '..', 'theta', 'gst_viewer'), [thetaPipeline]);
    }
}

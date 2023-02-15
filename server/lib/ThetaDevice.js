const path = require('path');
const {spawn} = require('child_process');
const AbstractGSTDevice = require('./AbstractGSTDevice');

// The pipeline is hard-coded in the C program
// To prevent obscure errors in case the limit is ever reached we'll check the length here
// The 2 values in the calculation below are the maximum char length and the length of the beginning of the pipeline hard-coded in C
const MAX_PIPE_LINE_LENGTH = 1024 - 55;

module.exports = class ThetaDevice extends AbstractGSTDevice {
    spawnProcess(pipeline) {
        if (pipeline.length > MAX_PIPE_LINE_LENGTH) {
            throw new Error('GST Pipeline is too large for Theta executable (' + pipeline + ')');
        }

        return spawn(path.join(__dirname, '..', '..', 'theta', 'gst_viewer'), [pipeline]);
    }

    socketInfo() {
        return {
            battery: 0,
        };
    }
}

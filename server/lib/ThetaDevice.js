const path = require('path');
const {spawn} = require('child_process');
const AbstractGSTDevice = require('./AbstractGSTDevice');

module.exports = class ThetaDevice extends AbstractGSTDevice {
    spawnProcess(pipeline) {
        return spawn(path.join(__dirname, '..', '..', 'theta', 'gst_viewer'), [pipeline]);
    }

    socketInfo() {
        return {
            battery: 0,
        };
    }
}

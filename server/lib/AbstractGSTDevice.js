const Camera = require('./Camera');
const Pipe = require('./Pipe');

module.exports = class AbstractGSTDevice {
    constructor(config, pipePrefix) {
        this.key = config.key;
        this.width = config.width;
        this.height = config.height;
        this.cropTop = config.crop?.top || 0;
        this.cropBottom = config.crop?.bottom || 0;
        this.quality = config.quality || -1;

        this.cameras = config.cameras.map(cameraConfig => new Camera(cameraConfig));

        this.pipeOriginal = new Pipe(pipePrefix + 'original');
        this.pipeLow = new Pipe(pipePrefix + 'low');

        this.gstProcess = null;
        this.restartProcessOnExit = true;
    }

    pipelineQueue() {
        return 'queue leaky=downstream max-size-time=500000000';
    }

    pipelineToPipe(pipe, higherQuality = false) {
        // Allow customizing the jpeg quality, but never raise the low quality stream above the default of 85
        return ' ! jpegenc' + ((this.quality > -1 && (higherQuality || this.quality < 85)) ? ' quality=' + this.quality : '') + ' ! ' + this.pipelineQueue() + ' ! filesink location="' + pipe.path + '"';
    }

    pipelineCrop() {
        if (this.cropTop || this.cropBottom) {
            return ' ! videocrop top=' + this.cropTop + ' bottom=' + this.cropBottom;
        }

        return '';
    }

    pipeline() {
        // The first CAPS in the original quality branch would not seem necessary but on some devices the low quality scale CAPS can apparently move up the pipeline and completely mess with both quality outputs
        return this.pipelineCrop() + ' ! tee name=low ! ' + this.pipelineQueue() + ' ! video/x-raw,width=' + this.width + ',height=' + (this.height - this.cropTop - this.cropBottom) + this.pipelineToPipe(this.pipeOriginal, true) +
            ' low. ! ' + this.pipelineQueue() + ' ! videoscale ! video/x-raw,width=' + Math.round(this.width / 2) + ',height=' + Math.round((this.height - this.cropTop - this.cropBottom) / 2) + this.pipelineToPipe(this.pipeLow);
    }

    /**
     * @param {String} pipeline
     * @return {import('child_process').ChildProcess}
     */
    spawnProcess(pipeline) {
        throw new Error('spawnProcess() must be implemented by subclasses');
    }

    startGST() {
        console.log('Starting GST process');
        this.gstProcess = this.spawnProcess(this.pipeline());

        this.gstProcess.stdout.on('data', data => {
            console.log(`GST stdout: ${data}`);
        });

        this.gstProcess.stderr.on('data', data => {
            console.error(`GST stderr: ${data}`);
        });

        this.gstProcess.on('exit', code => {
            console.log('GST process exited with code ' + code);

            this.gstProcess = null;

            if (this.restartProcessOnExit) {
                setTimeout(this.startGST.bind(this), 5000);
            }
        });
    }

    stopGST() {
        this.restartProcessOnExit = false;

        if (!this.gstProcess) {
            console.log('Child process already exited');
            return;
        }

        console.log('Sending SIGINT to child process');
        this.gstProcess.kill('SIGINT');
        console.log('Child process exited');
    }
}

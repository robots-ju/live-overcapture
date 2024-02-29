const jpeg = require('jpeg-js');

module.exports = class MovementTrackerPipe extends require('./Pipe') {
    successfulDecodes = 0;

    constructor(path, config) {
        super(path);

        this.width = config.width;
        this.height = config.height;
        this.cropTop = config.crop?.top || 0;
        this.cropBottom = config.crop?.bottom || 0;
        this.scale = 4;
    }

    sendCompleteFrame(time, frame) {
        super.sendCompleteFrame(time, frame);

        try {
            const image = jpeg.decode(frame, {useTArray: true});
            this.successfulDecodes++;

            if (image.width !== this.width / this.scale) {
                console.warn('Movement JPEG unexpected width: ' + image.width + ' (expected ' + (this.width / this.scale) + ')');
            }

            let total = 0;

            const SCAN_FROM_Y = Math.floor(image.height / 1.3);

            for (let x = 0; x < image.width; x++) {
                for (let y = SCAN_FROM_Y; y < image.height; y++) {
                    total += image.data[x * y * 3] > 0 ? 1 : 0;
                }
            }

            let xMiddle = 0;
            let yMiddle = 0;
            let xTotal = 0;
            let yTotal = 0;

            findX:
                for (let x = 0; x < image.width; x++) {
                    for (let y = SCAN_FROM_Y; y < image.height; y++) {
                        if (xTotal >= total / 2) {
                            xMiddle = x;
                            break findX;
                        }

                        xTotal += image.data[x * y * 3] > 0 ? 1 : 0;
                    }
                }

            findY:
                for (let y = SCAN_FROM_Y; y < image.height; y++) {
                    for (let x = 0; x < image.width; x++) {
                        if (yTotal >= total / 2) {
                            yMiddle = y;
                            break findY;
                        }

                        yTotal += image.data[x * y * 3] > 0 ? 1 : 0;
                    }
                }

            //console.log('track', total, xTotal, yTotal, xMiddle, yMiddle);

            this.websocketClients.forEach(socket => {
                socket.emit('tracking', {
                    number: this.frameNumber,
                    time,
                    x: xMiddle * this.scale,
                    y: yMiddle * this.scale + this.cropTop,
                });
            });

        } catch (error) {
            console.error('Failed to decode movement JPEG after ' + this.successfulDecodes + ' successful decodes');
            console.error(error);
            this.successfulDecodes = 0;
        }
    }
}

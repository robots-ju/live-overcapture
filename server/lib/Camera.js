module.exports = class Camera {
    constructor(config) {
        if (!/^[a-zA-Z0-9_]+$/.test(config.key)) {
            throw new Error('Invalid camera key ' + config.key + ' - Should contain only alpha-numerical characters');
        }

        this.key = config.key;
        this.ratio = config.ratio || 1;
        this.orientation = {
            type: 'fixed',
            to: {
                pitch: config.pitch || 0,
                yaw: config.yaw || 0,
                fov: config.fov || 75,
            },
        };
    }

    setFixedOrientation(orientation) {
        this.orientation = {
            type: 'fixed',
            to: orientation,
        };
    }

    setAnimatedOrientation(orientation) {
        this.orientation = {
            type: 'animated',
            to: orientation,
            from: this.orientation.to,
            time: (new Date()).getTime(),
        };
    }
}

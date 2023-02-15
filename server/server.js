const path = require('path');
const fs = require('fs');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const pipePrefix = config['pipe-prefix'];

if (!fs.existsSync(pipePrefix)) {
    throw new Error('Invalid pipe prefix ' + pipePrefix + ' - Must be a folder');
}

const {Server} = require('socket.io');

console.log('starting socket server');

const io = new Server(config.websocket.port, {
    cors: {origin: '*'},
    maxHttpBufferSize: 3e6, // Upgrade default 1MB to 3MB
});

let frontendDebug = false;

io.on('connection', function (socket) {
    console.log('client connected');

    socket.emit('config', config);

    // Give frontend a bit of time to read config before sending other packets
    setTimeout(() => {
        socket.emit('app', {
            debug: frontendDebug,
        });
        Object.values(devices).forEach(device => {
            socket.emit('device', device.socketInfoPayload());
        });
    }, 1000);

    socket.on('start-stream', function (data) {
        console.log('client start stream: ' + data.quality + ' / device: ' + data.device);

        const device = devices[data.device];

        if (!device) {
            console.error('Invalid device ' + data.device);
        }

        if (data.quality === 'original') {
            device.pipeOriginal.addClient(socket);
        } else {
            device.pipeLow.addClient(socket);
        }
    });

    socket.on('stop-stream', function (data) {
        console.log('client stop stream');

        const device = devices[data.device];

        if (!device) {
            console.error('Invalid device ' + data.device);
        }

        device.pipeOriginal.removeClient(socket);
        device.pipeLow.removeClient(socket);
    });

    socket.on('fix-camera', function (data) {
        Object.values(devices).forEach(device => {
            device.cameras.forEach(camera => {
                if (camera.key === data.camera) {
                    camera.setFixedOrientation(data.orientation);
                    io.emit('camera-position', {
                        camera: camera.key,
                        orientation: camera.orientation
                    });
                }
            });
        });
    });

    socket.on('animate-camera', function (data) {
        Object.values(devices).forEach(device => {
            device.cameras.forEach(camera => {
                if (camera.key === data.camera) {
                    camera.setAnimatedOrientation(data.orientation);
                    io.emit('camera-position', {
                        camera: camera.key,
                        orientation: camera.orientation
                    });
                }
            });
        });
    });

    socket.on('debug', function (data) {
        frontendDebug = !!data;
        socket.emit('app', {
            debug: frontendDebug,
        });
    });

    socket.on('force-program-refresh', function () {
        socket.emit('force-program-refresh');
    });

    socket.on('disconnect', function () {
        console.log('client disconnected');

        Object.values(devices).forEach(device => {
            device.pipeOriginal.removeClient(socket);
            device.pipeLow.removeClient(socket);
        });
    });
});

const ThetaDevice = require('./lib/ThetaDevice');
const PlaybackDevice = require('./lib/PlaybackDevice');

const devices = {};

config.devices.forEach(deviceConfig => {
    if (!/^[a-zA-Z0-9_]+$/.test(deviceConfig.key)) {
        throw new Error('Invalid device key ' + deviceConfig.key + ' - Should contain only alpha-numerical characters');
    }

    let DeviceClass;

    switch (deviceConfig.type) {
        case 'theta':
            DeviceClass = ThetaDevice;
            break;
        case 'playback':
            DeviceClass = PlaybackDevice;
            break;
        default:
            throw new Error('Invalid device type ' + deviceConfig.type);
    }

    const device = new DeviceClass(deviceConfig, pipePrefix + '/pipe-' + deviceConfig.key + '-');
    devices[deviceConfig.key] = device;
    device.startGST();
});

process.on('SIGINT', () => {
    console.log('Received SIGINT signal');

    Object.values(devices).forEach(device => {
        device.stopGST();
    });

    console.log('Closing Socket.IO');

    io.close(() => {
        process.exit(0);
    });

    console.log('Shutting down');
});

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

let clientIdIncrement = 0;

io.on('connection', function (socket) {
    const clientName = '[socket.io#' + (++clientIdIncrement) + '@' + socket.request.socket.remoteAddress + '] ';

    console.log(clientName + 'connected');

    socket.emit('config', config);

    // Give frontend a bit of time to read config before sending other packets
    setTimeout(() => {
        socket.emit('app', {
            debug: frontendDebug,
        });
        Object.values(devices).forEach(device => {
            device.cameras.forEach(camera => {
                socket.emit('camera-target', {
                    ...camera.socketTargetPayload(),
                    init: true,
                });
            });
        });
    }, 1000);

    socket.on('start-stream', function (data) {
        console.log(clientName + 'start stream: ' + data.quality + ' / device: ' + data.device);

        const device = devices[data.device];

        if (!device) {
            console.error(clientName + 'Invalid device ' + data.device);
        }

        if (data.quality === 'original') {
            device.pipeOriginal.addClient(socket);
        } else if (data.quality === 'movement') {
            device.pipeMovement.addClient(socket);
        } else {
            device.pipeLow.addClient(socket);
        }
    });

    socket.on('stop-stream', function (data) {
        console.log(clientName + 'stop stream');

        const device = devices[data.device];

        if (!device) {
            console.error('Invalid device ' + data.device);
        }

        device.pipeOriginal.removeClient(socket);
        device.pipeMovement.removeClient(socket);
        device.pipeLow.removeClient(socket);
    });

    socket.on('camera-target', function (data) {
        Object.values(devices).forEach(device => {
            device.cameras.forEach(camera => {
                if (camera.key === data.camera) {
                    camera.setTarget(data.orientation, !!data.jump);
                    io.emit('camera-target', camera.socketTargetPayload());
                }
            });
        });
    });

    socket.on('debug', function (data) {
        frontendDebug = !!data;
        io.emit('app', {
            debug: frontendDebug,
        });
    });

    socket.on('force-program-refresh', function () {
        io.emit('force-program-refresh');
    });

    socket.on('disconnect', function () {
        console.log(clientName + 'disconnected');

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

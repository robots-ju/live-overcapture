const fs = require('fs');
const net = require('net');
const {spawn} = require('child_process');

const STATS_INTERVAL_SECONDS = 10;

module.exports = class Pipe {
    constructor(path) {
        this.path = path;
        this.buffers = [];
        this.websocketClients = [];
        this.frameNumber = 0;
        this.time = null;
        this.framesInStatsInterval = 0;

        this.init();
    }

    init() {
        if (fs.existsSync(this.path)) {
            console.log('fifo already exists: ' + this.path);
            this.connect();
        } else {
            const process = spawn('mkfifo', [this.path]);

            process.on('exit', code => {
                if (code === 0) {
                    console.log('fifo created: ' + this.path);
                    this.connect();
                } else {
                    console.log('fail to create fifo with code:  ' + code);
                }
            });
        }

        setInterval(() => {
            console.log('[' + (new Date()).toISOString() + '] Pipe ' + this.path + ' stats: ' + (Math.round(this.framesInStatsInterval / STATS_INTERVAL_SECONDS * 10) / 10) + 'frames/s');
            this.framesInStatsInterval = 0;
        }, STATS_INTERVAL_SECONDS * 1000);
    }

    connect() {
        fs.open(this.path, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK, (err, fd) => {
            console.log('opening pipe ' + this.path);

            const pipe = new net.Socket({fd});

            pipe.on('data', (data) => {
                this.buffers.push(data);

                // Copy time as early as possible, so it references the time the frame started coming in
                if (!this.time) {
                    this.time = (new Date()).getTime();
                }

                // Nothing fancy, we can detect the change from one image to another because the last packet will not have the same size
                if (data.length !== 65536) {
                    this.sendFrame();
                }
            });

            pipe.on('end', () => {
                console.log('pipe closed');
                this.sendFrame();

                // Reconnect if the pipe is closed by gstreamer, as we will probably restart the gstreamer process
                setTimeout(this.connect.bind(this), 1000);
            });
        });
    }

    sendFrame() {
        const time = this.time;
        this.time = null;

        if (!this.buffers.length) {
            console.log('no frame to send');
            return;
        }

        const completeFrame = Buffer.concat(this.buffers);

        this.frameNumber++;
        this.framesInStatsInterval++;

        this.websocketClients.forEach(socket => {
            socket.emit('frame', {
                number: this.frameNumber,
                time,
                // Passing binary inside a JSON block should be fine, Socket.io will automatically extract buffers to binary attachments
                jpeg: completeFrame,
            });
        });

        this.buffers = [];
    }

    addClient(socket) {
        const index = this.websocketClients.indexOf(socket);

        if (index !== -1) {
            return;
        }

        this.websocketClients.push(socket);
        console.log('Client joined websocket stream for pipe ' + this.path);
    }

    removeClient(socket) {
        const index = this.websocketClients.indexOf(socket);

        if (index !== -1) {
            this.websocketClients.splice(index, 1);
            console.log('Client left websocket stream for pipe ' + this.path);
        }
    }
}

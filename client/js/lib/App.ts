import {io, Socket} from 'socket.io-client';
import * as m from 'mithril';
import Device, {LocalDevice} from './Device';
import Camera from './Camera';
import CameraOrientation from './CameraOrientation';
import {AppConfig, AppState} from './Config';

export default class App {
    uri: string = '<unknwon uri>' // Set during connect, to be used in titles
    socket: Socket | null = null
    devices: { [key: string]: Device } = {}
    cameras: { [key: string]: Camera } = {}
    quality: 'low' | 'original' = 'low'
    state: AppState = {
        debug: false
    }
    debugStartTime: number = 0

    constructor() {
        const imageUrl = m.parseQueryString(window.location.search).testImage;

        // Allow easy testing without the server working by providing an image path in a page parameter
        if (imageUrl) {
            const image = new Image();
            image.onload = () => {
                this.cameras['test'] = new Camera(new LocalDevice(image), {
                    key: 'test',
                    ratio: 1,
                });
                this.toggleCamera('test', true);
                m.redraw();
            }
            image.onerror = () => {
                console.error('Could not load test image ' + imageUrl);
            }
            image.src = imageUrl as string;
        }
    }

    connect(uri: string) {
        this.uri = uri;
        this.socket = io(uri);

        this.socket.on('config', (config: AppConfig) => {
            // Reset existing information in case of reconnecting
            this.devices = {};
            this.cameras = {};

            config.devices.forEach(deviceConfig => {
                const device = new Device(deviceConfig);
                device.canvas.initWorker(uri, deviceConfig.key);
                this.devices[deviceConfig.key] = device;

                deviceConfig.cameras.forEach(cameraConfig => {
                    this.cameras[cameraConfig.key] = new Camera(device, cameraConfig);
                });
            });

            m.redraw();
        });

        this.socket.on('app', data => {
            this.pushState(data);
        });

        this.socket.on('device', data => {
            const device = this.devices[data.device];

            if (!device) {
                console.warn('Received state data for invalid device ' + data.device);
                return;
            }

            device.pushState(data.state);
        });

        this.socket.on('camera-target', data => {
            const camera = this.cameras[data.camera];

            if (camera) {
                camera.setTarget(data.target);
            }
        });

        this.socket.on('force-program-refresh', data => {
            if (m.route.get() === '/program') {
                window.location.reload();
            }
        });
    }

    sendCameraTarget(cameraKey: string, orientation: CameraOrientation, jump: boolean = false) {
        if (!this.socket) {
            console.warn('Cannot send camera orientation, socket not available');
        }

        this.socket.emit('camera-target', {
            camera: cameraKey,
            orientation,
            jump,
        });
    }

    changeQuality(quality: 'low' | 'original') {
        const oldQuality = this.quality;
        this.quality = quality;

        Object.keys(this.devices).forEach(deviceKey => {
            const device = this.devices[deviceKey];

            if (device.enabled) {
                device.canvas.enableWorker(false, oldQuality);
                device.canvas.enableWorker(true, quality);
            }
        });
    }

    toggleCamera(cameraKey: string, enabled: boolean) {
        const camera = this.cameras[cameraKey];

        if (camera) {
            camera.enabled = enabled;
            this.updateEnabledDevices();
        } else {
            console.warn('toggleCamera: key not found: ' + cameraKey);
        }
    }

    updateEnabledDevices() {
        Object.keys(this.devices).forEach(deviceKey => {
            const device = this.devices[deviceKey];
            const enabled = Object.values(this.cameras).some(camera => camera.enabled);

            if (enabled !== device.enabled) {
                device.enabled = enabled;

                device.canvas.enableWorker(enabled, this.quality);
            }
        });
    }

    pushState(state: AppState) {
        if (state.debug !== this.state.debug) {
            Object.values(this.devices).forEach(device => {
                device.canvas.debug = state.debug ? {
                    websocketFrameCount: 0,
                    websocketTotalBytes: 0,
                    decoderDroppedFrameCount: 0,
                    queueDroppedFrameCount: 0,
                    decodeFrameCount: 0,
                    decodeFailCount: 0,
                    decodeTotalTime: 0,
                    generationToDecodeTotalTime: 0,
                    generationToDecodeMaxTime: 0,
                    framesNotDecodedInTimeCount: 0,
                    drawnFrameCount: 0,
                    drawnDroppedFrameCount: 0,
                } : null;
            });

            document.getElementById('debug').classList.toggle('visible', state.debug);
        }

        this.state = state;

        // Must be started after the state is updated since it's the exit condition for the animaze loop
        if (state.debug) {
            this.debugStartTime = (new Date()).getTime();
            this.animateDebug();
        }
    }

    toggleDebug() {
        this.socket.emit('debug', !this.state.debug);
    }

    animateDebug() {
        if (!this.state.debug) {
            return;
        }

        let content = '';

        const elapsedTime = (new Date()).getTime() - this.debugStartTime;

        Object.keys(this.devices).forEach(deviceKey => {
            const device = this.devices[deviceKey];

            const {debug} = device.canvas;

            if (!debug) {
                return;
            }

            const bytesPerFrame = debug.websocketTotalBytes / (debug.websocketFrameCount || 1);
            const decodeTimePerFrame = debug.decodeTotalTime / (debug.decodeFrameCount || 1);
            const genToDecodeTimePerFrame = debug.generationToDecodeTotalTime / (debug.decodeFrameCount || 1);

            content += 'Device ' + deviceKey + '\n';
            content += debug.websocketFrameCount + ' WS frames\n';
            content += (Math.round(bytesPerFrame / 100000) / 10) + ' MB/frame AVG\n';
            content += Math.round(debug.websocketFrameCount / elapsedTime * 1000) + ' WS frames/s AVG\n';
            content += debug.decoderDroppedFrameCount + ' decoder dropped frames\n';
            content += debug.queueDroppedFrameCount + ' queue dropped frames\n';
            content += debug.decodeFrameCount + ' decoded frames\n';
            content += debug.decodeFailCount + ' broken frames\n';
            content += Math.round(decodeTimePerFrame) + ' ms decode AVG\n';
            content += Math.round(genToDecodeTimePerFrame) + ' ms generation to ready AVG\n';
            content += debug.generationToDecodeMaxTime + ' ms generation to ready MAX\n';
            content += Math.round(debug.decodeFrameCount / elapsedTime * 1000) + ' decoded frames/s AVG\n';
            content += Math.round(debug.drawnFrameCount / elapsedTime * 1000) + ' drawn frames/s AVG\n';
            content += debug.framesNotDecodedInTimeCount + ' skipped frames (too slow)\n';
            content += debug.drawnDroppedFrameCount + ' skipped frames (too fast)\n';
            content += device.canvas.queue.length + ' queue length\n';
        });

        document.getElementById('debug').textContent = content;

        window.requestAnimationFrame(this.animateDebug.bind(this));
    }
}

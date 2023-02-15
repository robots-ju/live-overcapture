import {io, Socket} from 'socket.io-client';
import * as m from 'mithril';
import Device, {LocalDevice} from './Device';
import Camera from './Camera';
import CameraOrientation from './CameraOrientation';
import {AppConfig, AppState} from './Config';

export default class App {
    socket: Socket | null = null
    devices: { [key: string]: Device } = {}
    cameras: { [key: string]: Camera } = {}
    quality: 'low' | 'original' = 'low'
    state: AppState = {
        debug: false
    }

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
        this.socket = io(uri);

        this.socket.on('config', (config: AppConfig) => {
            // Reset existing information in case of reconnecting
            this.devices = {};
            this.cameras = {};

            config.devices.forEach(deviceConfig => {
                const device = new Device(deviceConfig);
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

        this.socket.on('frame', data => {
            const keys = Object.keys(this.devices);
            // TODO: support multiple devices
            if (keys.length) {
                this.devices[keys[0]].canvas.pushFrame(data, this.quality);
            }
        });

        this.socket.on('camera-position', data => {
            const camera = this.cameras[data.camera];

            if (camera) {
                camera.orientation = data.orientation;
            }
        });

        this.socket.on('force-program-refresh', data => {
            if (m.route.get() === '/program') {
                window.location.reload();
            }
        });
    }

    sendCameraOrientation(cameraKey: string, orientation: CameraOrientation, animate: boolean = false) {
        if (!this.socket) {
            console.log('Cannot send camera orientation, socket not available');
        }

        this.socket.emit(animate ? 'animate-camera' : 'fix-camera', {
            camera: cameraKey,
            orientation,
        });
    }

    changeQuality(quality: 'low' | 'original') {
        const oldQuality = this.quality;
        this.quality = quality;

        Object.keys(this.devices).forEach(deviceKey => {
            const device = this.devices[deviceKey];

            if (device.enabled) {
                this.socket.emit('stop-stream', {
                    device: deviceKey,
                    quality: oldQuality,
                });
                this.socket.emit('start-stream', {
                    device: deviceKey,
                    quality,
                });
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

                if (enabled) {
                    this.socket.emit('start-stream', {
                        device: deviceKey,
                        quality: this.quality,
                    });
                } else {
                    this.socket.emit('stop-stream', {
                        device: deviceKey,
                        quality: this.quality,
                    });
                }
            }
        });
    }

    pushState(state: AppState) {
        this.state = state;
    }
}

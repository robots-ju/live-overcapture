import CameraOrientation from './CameraOrientation';
import {CameraConfig} from './Config';
import {DeviceInterface} from './Device';

interface CameraOrientationSaved {
    type: string
    to: CameraOrientation
}

interface CameraOrientationFixed extends CameraOrientationSaved {
    type: 'fixed'
}

interface CameraOrientationAnimate extends CameraOrientationSaved {
    type: 'animated'
    from: CameraOrientation
    time: number
}

export default class Camera {
    key: string
    device: DeviceInterface
    orientation: CameraOrientationSaved
    // The enabled flag is used to indicate the camera is visible in the current viewport
    // In program mode, this will only be set on the program camera
    // In control mode, this is used to select which cameras are being controlled from this client
    enabled: boolean = false

    constructor(device: DeviceInterface, config: CameraConfig) {
        this.key = config.key;
        this.device = device;
        // This orientation is only while waiting for the initial orientation from server
        this.orientation = {
            type: 'fixed',
            to: {
                pitch: 0,
                yaw: 0,
                fov: 75,
            },
        };
    }

    pushOrientation(orientation: CameraOrientationFixed | CameraOrientationAnimate) {
        this.orientation = orientation;
    }
}

import CameraOrientation from './CameraOrientation';
import {CameraConfig} from './Config';
import {DeviceInterface} from './Device';

interface CameraOrientationTarget {
    to: CameraOrientation
    jump?: boolean
    maxPanSpeed?: number
    maxZoomSpeed?: number
}

const SPEED_DEGREES_PER_SECOND = 50;

export default class Camera {
    key: string
    ratio: number
    device: DeviceInterface
    // Those orientations are only while waiting for the initial orientation from server
    targetOrientation: CameraOrientationTarget = {
        to: {
            pitch: 0,
            yaw: 0,
            fov: 75,
        },
    }
    currentOrientation: CameraOrientation = {
        pitch: 0,
        yaw: 0,
        fov: 75,
    }
    currentPanSpeed: number = 0
    currentZoomSpeed: number = 0
    // The enabled flag is used to indicate the camera is visible in the current viewport
    // In program mode, this will only be set on the program camera
    // In control mode, this is used to select which cameras are being controlled from this client
    enabled: boolean = false
    lastAnimationTime: DOMHighResTimeStamp = 0
    minFov: number = 30
    maxFov: number = 200

    constructor(device: DeviceInterface, config: CameraConfig) {
        this.key = config.key;
        this.ratio = config.ratio || 1;
        this.device = device;

        if (typeof config['min-fov'] !== 'undefined') {
            this.minFov = config['min-fov'];
        }

        if (typeof config['max-fov'] !== 'undefined') {
            this.maxFov = config['max-fov'];
        }

        this.animate();
    }

    setTarget(target: CameraOrientationTarget) {
        this.targetOrientation = target;

        // TODO: animate zoom
        this.currentOrientation.fov = this.targetOrientation.to.fov;

        if (target.jump) {
            this.currentOrientation = target.to;
            this.currentPanSpeed = 0;
            this.currentZoomSpeed = 0;
        }
    }

    animate(time?: DOMHighResTimeStamp) {
        // Only after the first call, so we have access to the previous value
        if (this.lastAnimationTime) {
            const elapsed = time - this.lastAnimationTime;

            const rawDiffX = this.targetOrientation.to.yaw - this.currentOrientation.yaw;

            // If it's shorter to go to the target yaw by going through one edge and coming back the other,
            // The target will be calculated like if going out of the screen and the modulo below will convert back to actual position
            const targetYaw = this.targetOrientation.to.yaw + (Math.abs(rawDiffX) > 180 ? (rawDiffX > 0 ? -360 : 360) : 0);

            const diffX = targetYaw - this.currentOrientation.yaw;
            const diffY = this.targetOrientation.to.pitch - this.currentOrientation.pitch;

            const distanceToTarget = Math.sqrt(Math.pow(Math.abs(diffX), 2) + Math.pow(Math.abs(diffY), 2));

            const distanceWeCanTravel = elapsed / 1000 * SPEED_DEGREES_PER_SECOND;

            if (distanceToTarget <= distanceWeCanTravel) {
                this.currentOrientation.yaw = this.targetOrientation.to.yaw;
                this.currentOrientation.pitch = this.targetOrientation.to.pitch;
            } else {
                const direction = Math.atan2(diffY, diffX);

                this.currentOrientation.yaw = (((this.currentOrientation.yaw + Math.cos(direction) * distanceWeCanTravel) - 180) % 360) + 180;
                this.currentOrientation.pitch = Math.max(Math.min(this.currentOrientation.pitch + Math.sin(direction) * distanceWeCanTravel, 90), -90);
            }
        }

        this.lastAnimationTime = time;

        requestAnimationFrame(this.animate.bind(this));
    }
}

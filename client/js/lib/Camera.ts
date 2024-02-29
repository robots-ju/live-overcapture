import CameraOrientation, {AbsoluteCameraOrientation} from './CameraOrientation';
import {AutoFovStep, CameraConfig} from './Config';
import {DeviceInterface} from './Device';

interface CameraOrientationTarget {
    to: CameraOrientation
    jump?: boolean
    maxPanSpeed?: number
    maxZoomSpeed?: number
}

const SPEED_DEGREES_PER_SECOND = 50;
const ZOOM_DEGREES_PER_SECOND = 15;

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
    currentOrientation: AbsoluteCameraOrientation = {
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
    autoFov: AutoFovStep[] = []

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

        if (typeof config['auto-fov'] !== 'undefined') {
            this.autoFov = config['auto-fov'];
        }

        this.animate();
    }

    setTarget(target: CameraOrientationTarget) {
        this.targetOrientation = target;

        if (target.jump) {
            this.currentOrientation = this.convertToAbsoluteOrientation(target.to);
            this.currentPanSpeed = 0;
            this.currentZoomSpeed = 0;
        }
    }

    animate(time?: DOMHighResTimeStamp) {
        // Only after the first call, so we have access to the previous value
        if (this.lastAnimationTime) {
            const elapsed = time - this.lastAnimationTime;

            const absoluteTarget = this.convertToAbsoluteOrientation(this.targetOrientation.to);

            const rawDiffX = absoluteTarget.yaw - this.currentOrientation.yaw;

            // If it's shorter to go to the target yaw by going through one edge and coming back the other,
            // The target will be calculated like if going out of the screen and the modulo below will convert back to actual position
            const targetYaw = absoluteTarget.yaw + (Math.abs(rawDiffX) > 180 ? (rawDiffX > 0 ? -360 : 360) : 0);

            const diffX = targetYaw - this.currentOrientation.yaw;
            const diffY = absoluteTarget.pitch - this.currentOrientation.pitch;

            const distanceToTarget = Math.sqrt(Math.pow(Math.abs(diffX), 2) + Math.pow(Math.abs(diffY), 2));

            const distanceWeCanTravel = elapsed / 1000 * SPEED_DEGREES_PER_SECOND;

            if (distanceToTarget <= distanceWeCanTravel) {
                this.currentOrientation.yaw = absoluteTarget.yaw;
                this.currentOrientation.pitch = absoluteTarget.pitch;
            } else {
                const direction = Math.atan2(diffY, diffX);

                this.currentOrientation.yaw = (((this.currentOrientation.yaw + Math.cos(direction) * distanceWeCanTravel) - 180) % 360) + 180;
                this.currentOrientation.pitch = Math.max(Math.min(this.currentOrientation.pitch + Math.sin(direction) * distanceWeCanTravel, 90), -90);
            }

            // Go faster when in auto mode, but still animate, particularly for when switching back to auto from manual
            const zoomSpeed = ZOOM_DEGREES_PER_SECOND * (this.targetOrientation.to.fov === 'auto' ? 4 : 1);
            const zoomDiff = Math.abs(absoluteTarget.fov - this.currentOrientation.fov);
            const distanceWeCanZoom = elapsed / 1000 * zoomSpeed;

            if (zoomDiff < distanceWeCanZoom) {
                this.currentOrientation.fov = absoluteTarget.fov;
            } else {
                this.currentOrientation.fov += (absoluteTarget.fov > this.currentOrientation.fov ? 1 : -1) * distanceWeCanZoom;
            }
        }

        this.lastAnimationTime = time;

        requestAnimationFrame(this.animate.bind(this));
    }

    convertToAbsoluteOrientation(orientation: CameraOrientation): AbsoluteCameraOrientation {
        if (orientation.fov !== 'auto') {
            // @ts-ignore not sure why typescript doesn't like it
            return orientation;
        }

        if (!this.autoFov.length) {
            return {...orientation, fov: this.minFov};
        }

        const absolutePitch = Math.abs(orientation.pitch);

        let stepStartIndex = -1;

        this.autoFov.forEach((step, index) => {
            if (absolutePitch >= step.pitch) {
                stepStartIndex = index;
            }
        });

        let percentBetweenSteps = 0;

        if (stepStartIndex > -1 && stepStartIndex < this.autoFov.length - 1) {
            percentBetweenSteps = (absolutePitch - this.autoFov[stepStartIndex].pitch) / this.autoFov[stepStartIndex + 1].pitch;
        }

        const fov = percentBetweenSteps === 0 ? this.autoFov[Math.max(stepStartIndex, 0)].fov : (Math.min(this.autoFov[stepStartIndex].fov, this.autoFov[stepStartIndex + 1].fov) + Math.abs((this.autoFov[stepStartIndex + 1].fov - this.autoFov[stepStartIndex].fov) * percentBetweenSteps));

        return {
            pitch: orientation.pitch,
            yaw: orientation.yaw,
            fov,
        };
    }
}

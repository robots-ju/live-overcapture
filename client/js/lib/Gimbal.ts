// Gimbal.js
// Adapted from https://github.com/marquizzo/three-gimbal
// Original authors: Marquizzo, tb-marco
// =========
// Transforms accelerometer alpha, beta, gamma information,
// then returns readable angles via yaw, pitch & roll
// yaw: y-axis rotations
// pitch: x-axis rotations
// roll: z-axis rotations

import * as THREE from 'three';

export default class Gimbal {
    quaternion = new THREE.Quaternion()
    quatOrigin = new THREE.Quaternion()
    axisUp = new THREE.Vector3(0, 1, 0)
    axisFwd = new THREE.Vector3(0, 0, 1)
    vectorUp = new THREE.Vector3()
    vectorFwd = new THREE.Vector3()
    sensorRotations = new THREE.Object3D()
    data = {
        alpha: 0,
        beta: 0,
        gamma: 0,
        orientation: window.orientation ? window.orientation : 0
    }

    needsUpdate = false;
    recalRequested = false;

    RAD = Math.PI / 180;
    DEG = 180 / Math.PI;

    eulerOrigin = new THREE.Euler();

    yaw = 0
    pitch = 0
    roll = 0

    constructor() {
        if (typeof window.orientation !== "undefined") {
            this.eulerOrigin.set(
                90 * this.RAD,
                180 * this.RAD,
                (180 + window.orientation) * this.RAD
            );
        }
    }

    // Recalibrates axes to be oriented to current this.data rotations
    protected performRecalibration() {
        this.sensorRotations.setRotationFromEuler(this.eulerOrigin);

        // Apply gyroscope rotations
        this.sensorRotations.rotateZ(this.data.alpha * this.RAD);
        this.sensorRotations.rotateX(this.data.beta * this.RAD);
        this.sensorRotations.rotateY(this.data.gamma * this.RAD);
        this.sensorRotations.rotation.z -= this.data.orientation;

        this.quatOrigin.copy(this.sensorRotations.quaternion);
        this.quatOrigin.conjugate();

        this.recalRequested = false;
    }

    // When switching from portrait <-> landscape
    protected onDeviceReorientation() {
        this.data.orientation = (window.orientation * this.RAD) || 0;
    }

    // Update data when device detects movement
    // Alpha = z axis [0 ,360]
    // Beta = x axis [-180 , 180]
    // Gamma = y axis [-90 , 90]
    protected onSensorMove(event) {
        this.data.alpha = event.alpha;
        this.data.beta = event.beta;
        this.data.gamma = event.gamma;
        this.needsUpdate = true;

        if (this.recalRequested) {
            this.performRecalibration();
        }
    }

    // Enables gimbal
    enable() {
        this.onDeviceReorientation();

        window.addEventListener('deviceorientation', this.onSensorMove.bind(this), false);
        window.addEventListener('orientationchange', this.onDeviceReorientation.bind(this), false);
    }

    // Disables gimbal
    disable() {
        window.removeEventListener('deviceorientation', this.onSensorMove.bind(this), false);
        window.removeEventListener('orientationchange', this.onDeviceReorientation.bind(this), false);
    }

    // Will perform recalibration when this.data is available
    recalibrate() {
        this.recalRequested = true;
    }

    // Called once per frame
    update() {
        // Skips calculations if this.data hasn't changed
        if (!this.needsUpdate) {
            return;
        }

        // Reset rotation
        this.sensorRotations.setRotationFromEuler(this.eulerOrigin);
        this.sensorRotations.applyQuaternion(this.quatOrigin);

        // Apply gyroscope rotations
        this.sensorRotations.rotateZ(this.data.alpha * this.RAD);
        this.sensorRotations.rotateX(this.data.beta * this.RAD);
        this.sensorRotations.rotateY(this.data.gamma * this.RAD);
        this.sensorRotations.rotation.z -= this.data.orientation;

        // Extract quaternion from object
        this.quaternion.copy(this.sensorRotations.quaternion);
        this.quaternion.conjugate();

        // Apply quat to axes
        this.vectorUp.copy(this.axisUp);
        this.vectorUp.applyQuaternion(this.quaternion);
        this.vectorFwd.copy(this.axisFwd);
        this.vectorFwd.applyQuaternion(this.quaternion);

        // Yaw is heading east (-) or west (+) rotation around y-axis.
        this.yaw = Math.atan2(this.vectorFwd.x, this.vectorFwd.z) * this.DEG;

        // Pitch is pointing above or below (+/-) horizon line
        this.pitch = Math.atan2(this.vectorUp.z, this.vectorUp.y) * -this.DEG;

        // Roll is left (-) or right (+) rotation around local z-axis
        this.roll = Math.atan2(-this.vectorUp.x, this.vectorUp.y) * this.DEG;

        this.needsUpdate = false;
    }
}

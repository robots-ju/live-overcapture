import * as m from 'mithril';
import Camera from '../lib/Camera';
import App from '../lib/App';
import Gimbal from '../lib/Gimbal';

interface CameraGyroControlAttrs {
    app: App
    camera: Camera
}

const ROUND_PRECISION = 4;

export default class CameraGyroControl implements m.ClassComponent<CameraGyroControlAttrs> {
    app: App
    camera: Camera
    enabled: boolean = false
    running: boolean = false
    gimbal = new Gimbal()
    missingPermission: boolean = false

    lastSentPitch = -10000;
    lastSentYaw = -10000;

    pitchMultiple: number = 1
    yawMultiple: number = 1

    view() {
        let onclick, content, disabled = false;

        if (this.running) {
            onclick = () => {
                this.gimbal.disable();
                this.running = false;
                this.enabled = false;
            };
            content = 'Gimbal active';
        } else if (this.enabled) {
            onclick = () => {
            };
            content = 'Enabling...';
            disabled = true;
        } else {
            onclick = () => {
                this.enabled = true;
                this.missingPermission = false;

                Promise.all([
                    navigator.permissions.query({name: 'accelerometer' as any}),
                    navigator.permissions.query({name: 'magnetometer' as any}),
                    navigator.permissions.query({name: 'gyroscope' as any}),
                ]).then((results) => {
                    if (results.every((result) => result.state === 'granted')) {
                        this.gimbal.enable();
                        this.running = true;
                        this.animate();
                    } else {
                        this.enabled = false;
                        this.missingPermission = true;
                    }
                    m.redraw();
                });
            };

            if (this.missingPermission) {
                content = 'Missing permission';
            } else {
                content = 'Enable gimbal';
            }
        }

        return m('span', [
            m('button', {
                onclick,
                disabled,
            }, content),
            ' ',
            m('button', {
                onclick: () => {
                    this.gimbal.recalibrate();
                },
                disabled: !this.running,
            }, 'Reset'),
            ' ',
            m('button', {
                onclick: () => {
                    if (this.pitchMultiple >= 2) {
                        this.pitchMultiple = 1;
                    } else {
                        this.pitchMultiple += 0.25;
                    }
                },
                disabled: !this.running,
            }, 'Pitch ' + this.pitchMultiple + 'x'),
            ' ',
            m('button', {
                onclick: () => {
                    if (this.yawMultiple >= 2) {
                        this.yawMultiple = 1;
                    } else {
                        this.yawMultiple += 0.25;
                    }
                },
                disabled: !this.running,
            }, 'Yaw ' + this.yawMultiple + 'x'),
        ]);
    }

    oninit(vnode: m.Vnode<CameraGyroControlAttrs, this>) {
        const {app, camera} = vnode.attrs;
        this.app = app;
        this.camera = camera;
    }

    animate() {
        if (!this.running) {
            return;
        }

        this.gimbal.update();

        const pitch = Math.round(this.gimbal.pitch * this.pitchMultiple * ROUND_PRECISION) / ROUND_PRECISION;
        const yaw = Math.round(this.gimbal.yaw * this.yawMultiple * ROUND_PRECISION) / ROUND_PRECISION;

        if (pitch !== this.lastSentPitch || yaw !== this.lastSentYaw) {
            this.app.sendCameraTarget(this.camera.key, {
                pitch,
                yaw,
                fov: this.camera.targetOrientation.to.fov,
            }, true);
        }

        this.lastSentPitch = pitch;
        this.lastSentYaw = yaw;

        requestAnimationFrame(this.animate.bind(this));
    }

    onremove() {
        if (!this.running) {
            return;
        }

        this.gimbal.disable();
        this.running = false;
    }
}

import * as m from 'mithril';
import App from '../lib/App';
import Camera from '../lib/Camera';
import CameraOrientation from '../lib/CameraOrientation';
import SceneContainer from './SceneContainer';

interface Camera3DControlAttrs {
    app: App
    camera: Camera
}

const DEGREES_PER_PIXEL_MOVED = 0.1;

export default class Camera3DControl implements m.ClassComponent<Camera3DControlAttrs> {
    mouseMoveCallback!: (event: MouseEvent) => void
    mouseUpCallback!: () => void
    dragActive: { x: number, y: number, orientation: CameraOrientation } | null

    view(vnode: m.VnodeDOM<Camera3DControlAttrs, this>) {
        const {camera} = vnode.attrs;

        return m('.Camera3DControl', {
            onmousedown: (event: MouseEvent) => {
                event.preventDefault();
                event.redraw = false;

                this.dragActive = {
                    x: event.clientX,
                    y: event.clientY,
                    orientation: camera.orientation.to,
                };
            },
        }, m(SceneContainer, {
            camera,
            width: 500,
            height: 500,
        }));
    }

    oncreate(vnode: m.VnodeDOM<Camera3DControlAttrs, this>) {
        this.mouseMoveCallback = (event: MouseEvent) => {
            if (!this.dragActive) {
                return;
            }

            event.preventDefault();

            vnode.attrs.app.sendCameraOrientation(vnode.attrs.camera.key, {
                pitch: Math.max(Math.min((this.dragActive.y - event.clientY) * DEGREES_PER_PIXEL_MOVED * -1 + this.dragActive.orientation.pitch, 90), -90),
                yaw: ((this.dragActive.x - event.clientX) * DEGREES_PER_PIXEL_MOVED + this.dragActive.orientation.yaw + 180) % 360 - 180,
                fov: this.dragActive.orientation.fov,
            }, false);
        };
        this.mouseUpCallback = () => {
            this.dragActive = null;
        };
        document.addEventListener('mousemove', this.mouseMoveCallback);
        document.addEventListener('mouseup', this.mouseUpCallback);
    }

    onremove() {
        document.removeEventListener('mousemove', this.mouseMoveCallback);
        document.removeEventListener('mouseup', this.mouseUpCallback);
    }
}

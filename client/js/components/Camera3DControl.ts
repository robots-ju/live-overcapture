import * as m from 'mithril';
import App from '../lib/App';
import Camera from '../lib/Camera';
import CameraOrientation from '../lib/CameraOrientation';
import SceneContainer from './SceneContainer';
import ThreeScene from '../lib/ThreeScene';

interface Camera3DControlAttrs {
    app: App
    camera: Camera
}

const CANVAS_WIDTH = 500;
const DEGREES_PER_PIXEL_MOVED = 0.1;
const FOV_ZOOM_PER_STEP = 0.02;

export default class Camera3DControl implements m.ClassComponent<Camera3DControlAttrs> {
    mouseMoveCallback!: (event: MouseEvent) => void
    mouseUpCallback!: () => void
    wheelCallback!: (event: WheelEvent) => void
    dragActive: { x: number, y: number, orientation: CameraOrientation } | null = null
    standaloneWheelStartFov: number | null = null
    standaloneWheelTimeout: number = -1
    scene: ThreeScene
    zoomLevel: number = 0

    oninit(vnode: m.Vnode<Camera3DControlAttrs, this>) {
        this.scene = new ThreeScene(vnode.attrs.camera.device);
        this.scene.init();
    }

    view(vnode: m.VnodeDOM<Camera3DControlAttrs, this>) {
        const {camera} = vnode.attrs;

        return m('.Camera3DControl', {
            onmousedown: (event: MouseEvent) => {
                event.preventDefault();
                // @ts-ignore
                event.redraw = false;

                this.dragActive = {
                    x: event.clientX,
                    y: event.clientY,
                    orientation: {
                        // Create deep copy
                        ...camera.targetOrientation.to,
                    },
                };
                this.zoomLevel = 0;
                this.standaloneWheelStartFov = null;
            },
            onwheel: (event: WheelEvent) => {
                // @ts-ignore
                event.redraw = false;

                // Let the global listeners below do the job if a drag is in progress
                if (this.dragActive) {
                    return;
                }

                event.preventDefault();

                if (this.standaloneWheelStartFov === null) {
                    this.standaloneWheelStartFov = camera.currentOrientation.fov;
                    this.zoomLevel = 0;
                }

                // When using the scroll wheel without an active drag, zoom in place
                // We need a way to set and reset the zoom level, otherwise we can't read all the values sent by onwheel event
                clearTimeout(this.standaloneWheelTimeout);
                this.standaloneWheelTimeout = setTimeout(() => {
                    this.standaloneWheelStartFov = null;
                }, 2000) as any;

                this.zoomLevel += event.deltaY;

                vnode.attrs.app.sendCameraTarget(camera.key, {
                    pitch: camera.targetOrientation.to.pitch,
                    yaw: camera.targetOrientation.to.yaw,
                    fov: Math.max(Math.min(this.standaloneWheelStartFov + (this.zoomLevel * FOV_ZOOM_PER_STEP), camera.maxFov), camera.minFov),
                });
            },
        }, m(SceneContainer, {
            camera,
            width: CANVAS_WIDTH,
            height: Math.round(CANVAS_WIDTH / camera.ratio),
            scene: this.scene,
        }));
    }

    oncreate(vnode: m.VnodeDOM<Camera3DControlAttrs, this>) {
        const {camera} = vnode.attrs;

        const sendPosition = (event: MouseEvent) => {
            vnode.attrs.app.sendCameraTarget(camera.key, {
                pitch: Math.max(Math.min((this.dragActive.y - event.clientY) * DEGREES_PER_PIXEL_MOVED * -1 + this.dragActive.orientation.pitch, 90), -90),
                yaw: ((this.dragActive.x - event.clientX) * DEGREES_PER_PIXEL_MOVED + this.dragActive.orientation.yaw + 180) % 360 - 180,
                fov: this.zoomLevel === 0 ? this.dragActive.orientation.fov : Math.max(Math.min(camera.convertToAbsoluteOrientation(this.dragActive.orientation).fov + (this.zoomLevel * FOV_ZOOM_PER_STEP), camera.maxFov), camera.minFov),
            });
        };

        this.mouseMoveCallback = (event: MouseEvent) => {
            if (!this.dragActive) {
                return;
            }

            event.preventDefault();

            sendPosition(event);
        };
        this.mouseUpCallback = () => {
            this.dragActive = null;
        };
        this.wheelCallback = (event: WheelEvent) => {
            // TODO: also zoom if mouse is over area even if not dragging
            if (!this.dragActive) {
                return;
            }

            event.preventDefault();

            this.zoomLevel += event.deltaY;

            sendPosition(event);
        };
        document.addEventListener('mousemove', this.mouseMoveCallback);
        document.addEventListener('mouseup', this.mouseUpCallback);
        document.addEventListener('wheel', this.wheelCallback);
    }

    onremove() {
        document.removeEventListener('mousemove', this.mouseMoveCallback);
        document.removeEventListener('mouseup', this.mouseUpCallback);
        document.removeEventListener('wheel', this.wheelCallback);
        this.scene.destroy();
    }
}

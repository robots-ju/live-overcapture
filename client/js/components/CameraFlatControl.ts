import * as m from 'mithril';
import Camera from '../lib/Camera';
import App from '../lib/App';
import CameraOrientation, {AbsoluteCameraOrientation} from '../lib/CameraOrientation';

interface CameraFlatControlAttrs {
    app: App
    camera: Camera
}

// Width of the 3D camera controls + other margins to keep while trying to make the canvas as wide as possible
const KEEP_HORIZONTAL_SPACE = 700;
const CANVAS_MIN_WIDTH = 500;
const YAW_OFFSET = 90; // degrees

export default class CameraFlatControl implements m.ClassComponent<CameraFlatControlAttrs> {
    app: App
    camera: Camera
    context: CanvasRenderingContext2D
    running: boolean = true
    width: number
    height: number
    yawOffsetPixels: number
    mousePosition: CameraOrientation | null
    targetFov: number = -1

    mousePositionToCameraOrientation(event: MouseEvent) {
        const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
        const xProportional = (event.clientX - rect.left - this.yawOffsetPixels) / rect.width;
        const yProportional = (event.clientY - rect.top) / rect.height;

        return {
            pitch: (0.5 - yProportional) * 180,
            yaw: (xProportional - 0.5) * 360,
        }
    }

    drawTarget(orientation: AbsoluteCameraOrientation, color: string) {
        this.drawSingleTarget(orientation, color);

        // It's not a big performance impact to always draw the shape coming from the other direction,
        // even if most of the time it will be outside the visible area of the canvas
        // Also takes care of the yaw offset
        this.drawSingleTarget({
            pitch: orientation.pitch,
            yaw: orientation.yaw - 360,
            fov: orientation.fov,
        }, color);
        this.drawSingleTarget({
            pitch: orientation.pitch,
            yaw: orientation.yaw + 360,
            fov: orientation.fov,
        }, color);
    }

    drawSingleTarget(orientation: AbsoluteCameraOrientation, color: string) {
        const x = ((orientation.yaw / 360) + 0.5) * this.width + this.yawOffsetPixels;
        const y = (0.5 - (orientation.pitch / 180)) * this.height;

        const height = orientation.fov / 180 * this.height;
        const widthAtEquator = orientation.fov * this.camera.ratio / 360 * this.width;
        // I just can't figure out the math needed here, but this seems like a good approximation for now
        const percentLookingUp = (1 - (Math.abs(orientation.pitch - (orientation.fov / 2)) / 90)) * 1.8;
        const percentLookingDown = (1 - (Math.abs(orientation.pitch + (orientation.fov / 2)) / 90)) * 1.8;
        const percentLookingMiddle = (1 - (Math.abs(orientation.pitch) / 90));
        const widthAtTop = widthAtEquator / Math.max(percentLookingDown, 0.01);
        const widthAtBottom = widthAtEquator / Math.max(percentLookingUp, 0.01);
        const widthAtMiddle = widthAtEquator / Math.max(percentLookingMiddle, 0.01);

        this.context.strokeStyle = color;
        this.context.lineWidth = 2;
        this.context.beginPath();
        this.context.moveTo(x - (widthAtTop / 2), y - (height / 2));
        this.context.lineTo(x + (widthAtTop / 2), y - (height / 2));
        this.context.lineTo(x + (widthAtMiddle / 2), y);
        this.context.lineTo(x + (widthAtBottom / 2), y + (height / 2));
        this.context.lineTo(x - (widthAtBottom / 2), y + (height / 2));
        this.context.lineTo(x - (widthAtMiddle / 2), y);
        this.context.closePath();
        this.context.stroke();
    }

    view(vnode: m.VnodeDOM<CameraFlatControlAttrs, this>) {
        return m('.CameraFlatControl', m('canvas', {
            onmousemove: (event: MouseEvent) => {
                // @ts-ignore
                event.redraw = false;
                this.mousePosition = {
                    ...this.mousePositionToCameraOrientation(event),
                    fov: 75, // This value is overridden in the animation loop, but it's required by the interface
                };
            },
            onmouseleave: (event: MouseEvent) => {
                // @ts-ignore
                event.redraw = false;
                this.mousePosition = null;
                this.targetFov = -1;
            },
            onwheel: (event: WheelEvent) => {
                // @ts-ignore
                event.redraw = false;
                this.targetFov = Math.max(Math.min((this.targetFov === -1 ? this.camera.currentOrientation.fov : this.targetFov) + (event.deltaY > 0 ? 2 : -2), this.camera.maxFov), this.camera.minFov);
            },
            onclick: (event: MouseEvent) => {
                // @ts-ignore
                event.redraw = false;
                const position = this.mousePositionToCameraOrientation(event);

                vnode.attrs.app.sendCameraTarget(this.camera.key, {
                    pitch: position.pitch,
                    yaw: position.yaw,
                    fov: this.targetFov === -1 ? this.camera.targetOrientation.to.fov : this.targetFov,
                }, event.ctrlKey);
            },
            width: this.width,
            height: this.height,
        }));
    }

    oninit(vnode: m.Vnode<CameraFlatControlAttrs, this>) {
        const {camera} = vnode.attrs;
        this.camera = camera;

        this.width = Math.max(window.innerWidth - KEEP_HORIZONTAL_SPACE, CANVAS_MIN_WIDTH);
        this.height = camera.device.canvas.canvas.height / camera.device.canvas.canvas.width * this.width;
        this.yawOffsetPixels = Math.round(this.width / 360 * YAW_OFFSET);
    }

    oncreate(vnode) {
        this.context = vnode.dom.querySelector('canvas').getContext('2d');

        this.animate();
    }

    animate() {
        if (!this.running) {
            return;
        }

        this.context.drawImage(this.camera.device.canvas.canvas, this.yawOffsetPixels, 0, this.width, this.height);

        if (this.yawOffsetPixels !== 0) {
            this.context.drawImage(this.camera.device.canvas.canvas, this.yawOffsetPixels + (this.width * (this.yawOffsetPixels > 0 ? -1 : 1)), 0, this.width, this.height);
        }

        this.drawTarget(this.camera.currentOrientation, 'rgba(0,200,0,0.7)');

        if (this.mousePosition) {
            this.drawTarget(this.camera.convertToAbsoluteOrientation({
                ...this.mousePosition,
                fov: this.targetFov === -1 ? this.camera.targetOrientation.to.fov : this.targetFov,
            }), 'rgba(255,255,255,0.7)');
        }

        requestAnimationFrame(this.animate.bind(this));
    }

    onremove() {
        this.running = false;
    }
}

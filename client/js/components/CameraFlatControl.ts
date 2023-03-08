import * as m from 'mithril';
import Camera from '../lib/Camera';
import App from '../lib/App';
import CameraOrientation from '../lib/CameraOrientation';

interface CameraFlatControlAttrs {
    app: App
    camera: Camera
}

export default class CameraFlatControl implements m.ClassComponent<CameraFlatControlAttrs> {
    app: App
    camera: Camera
    context: CanvasRenderingContext2D
    running: boolean = true
    width: number
    height: number
    mousePosition: CameraOrientation | null
    targetFov: number = -1

    mousePositionToCameraOrientation(event: MouseEvent) {
        const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
        const xProportional = (event.clientX - rect.left) / rect.width;
        const yProportional = (event.clientY - rect.top) / rect.height;

        return {
            pitch: (0.5 - yProportional) * 180,
            yaw: (xProportional - 0.5) * 360,
        }
    }

    drawTarget(orientation: CameraOrientation, color: string) {
        const x = ((orientation.yaw / 360) + 0.5) * this.width;
        const y = (0.5 - (orientation.pitch / 180)) * this.height;

        const height = orientation.fov / 180 * this.height;
        const widthAtEquator = orientation.fov / 360 * this.width;
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
                    fov: 75,
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
                    fov: this.targetFov === -1 ? this.camera.currentOrientation.fov : this.targetFov,
                }, event.ctrlKey);
            },
            width: this.width,
            height: this.height,
        }));
    }

    oninit(vnode: m.Vnode<CameraFlatControlAttrs, this>) {
        const {camera} = vnode.attrs;
        this.camera = camera;

        this.width = 500;
        this.height = camera.device.canvas.canvas.height / camera.device.canvas.canvas.width * this.width;
    }

    oncreate(vnode) {
        this.context = vnode.dom.querySelector('canvas').getContext('2d');

        this.animate();
    }

    animate() {
        if (!this.running) {
            return;
        }

        this.context.drawImage(this.camera.device.canvas.canvas, 0, 0, this.width, this.height);

        this.drawTarget(this.camera.currentOrientation, 'rgba(0,200,0,0.7)');

        if (this.mousePosition) {
            this.drawTarget({
                ...this.mousePosition,
                fov: this.targetFov === -1 ? this.camera.currentOrientation.fov : this.targetFov,
            }, 'rgba(255,255,255,0.7)');
        }

        requestAnimationFrame(this.animate.bind(this));
    }

    onremove() {
        this.running = false;
    }
}

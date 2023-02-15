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

        const radius = 50;

        this.context.strokeStyle = color;
        this.context.lineWidth = 2;
        this.context.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
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
            },
            onclick: (event: MouseEvent) => {
                // @ts-ignore
                event.redraw = false;
                const position = this.mousePositionToCameraOrientation(event);

                vnode.attrs.app.sendCameraOrientation(this.camera.key, {
                    pitch: position.pitch,
                    yaw: position.yaw,
                    fov: 75,
                }, false);
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

        this.drawTarget(this.camera.orientation.to, 'rgba(0,200,0,0.7)');

        if (this.mousePosition) {
            this.drawTarget(this.mousePosition, 'rgba(255,255,255,0.7)');
        }

        requestAnimationFrame(this.animate.bind(this));
    }

    onremove() {
        this.running = false;
    }
}

import * as m from 'mithril';
import Device from '../lib/Device';

interface DeviceEquirectangularViewAttrs {
    device: Device
    yawOffsetPixels: number
    width?: number
}

export default class DeviceEquirectangularView implements m.ClassComponent<DeviceEquirectangularViewAttrs> {
    device: Device
    context: CanvasRenderingContext2D
    running: boolean = true
    yawOffsetPixels: number
    width: number
    height: number

    oninit(vnode: m.Vnode<DeviceEquirectangularViewAttrs, this>) {
        this.device = vnode.attrs.device;
        this.yawOffsetPixels = vnode.attrs.yawOffsetPixels;

        const {width, height} = this.device.canvas.canvas;

        if (vnode.attrs.width) {
            this.width = vnode.attrs.width;
            this.height = vnode.attrs.width / width * height;
        } else {
            this.width = width;
            this.height = height;
        }

        this.device.enabled = true;
        this.device.canvas.enableWorker(true, 'original');
    }

    view() {
        return m('div', m('canvas', {
            width: this.width,
            height: this.height,
        }));
    }

    oncreate(vnode) {
        this.context = vnode.dom.querySelector('canvas').getContext('2d');

        this.animate();
    }

    animate() {
        if (!this.running) {
            return;
        }

        this.context.drawImage(this.device.canvas.canvas, this.yawOffsetPixels, 0, this.width, this.height);

        if (this.yawOffsetPixels !== 0) {
            this.context.drawImage(this.device.canvas.canvas, this.yawOffsetPixels + (this.width * (this.yawOffsetPixels > 0 ? -1 : 1)), 0, this.width, this.height);
        }

        requestAnimationFrame(this.animate.bind(this));
    }

    onremove() {
        this.running = false;
    }
}

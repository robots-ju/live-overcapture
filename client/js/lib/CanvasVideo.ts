import * as m from 'mithril';

export interface CanvasVideoInterface {
    canvas: HTMLCanvasElement
    isDry: boolean

    onNeedsTextureUpdate(callback: () => void)

    offNeedsTextureUpdate(callback: () => void)
}

export default class CanvasVideo implements CanvasVideoInterface {
    canvas: HTMLCanvasElement
    context: CanvasRenderingContext2D
    queue: ArrayBuffer | null = null
    lastFrameTime: Date | null = null
    textureUpdateListeners: (() => void)[] = []
    isDry: boolean = false

    constructor(width: number, height: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.context = this.canvas.getContext('2d');

        this.animate();
    }

    pushFrame(data: ArrayBuffer, quality: 'original' | 'low') {
        if (this.queue) {
            console.log('dropped frame');
        }

        this.queue = data;
        this.lastFrameTime = new Date();
    }

    animate() {
        if (this.queue) {
            if (this.isDry) {
                this.isDry = false;
                m.redraw();
            }

            const blob = new Blob([this.queue], {type: 'application/octet-binary'});
            const url = URL.createObjectURL(blob);
            const img = new Image;
            img.onload = () => {
                URL.revokeObjectURL(url);
                // When running in low quality, the image will be stretched here
                // This makes implementation in other classes easier if size remains the same
                this.context.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
                this.textureUpdateListeners.forEach(callback => callback());
                this.queue = null;
            };
            img.src = url;
        } else if (!this.isDry && (!this.lastFrameTime || ((new Date()).getTime() - this.lastFrameTime.getTime()) > 5000)) {
            this.isDry = true;
            m.redraw();
        }

        requestAnimationFrame(this.animate.bind(this));
    }

    onNeedsTextureUpdate(callback: () => void) {
        this.textureUpdateListeners.push(callback);
    }

    offNeedsTextureUpdate(callback: () => void) {
        const index = this.textureUpdateListeners.indexOf(callback);

        if (index !== -1) {
            this.textureUpdateListeners.splice(index, 1);
        } else {
            console.log('offNeedsTextureUpdate: callback not found');
        }
    }
}

export class StaticCanvasVideo implements CanvasVideoInterface {
    canvas: HTMLCanvasElement
    isDry: boolean = false

    constructor(image: HTMLImageElement) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = image.width;
        this.canvas.height = image.height;
        this.canvas.getContext('2d').drawImage(image, 0, 0);
    }

    onNeedsTextureUpdate(callback: () => void) {
        // Nothing to do since the texture never updates
    }

    offNeedsTextureUpdate(callback: () => void) {
        // Nothing to do since the texture never updates
    }
}

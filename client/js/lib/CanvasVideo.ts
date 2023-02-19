import * as m from 'mithril';

interface CanvasDebug {
    websocketFrameCount: number
    websocketTotalBytes: number
    decoderDroppedFrameCount: number
    queueDroppedFrameCount: number
    decodeFrameCount: number
    decodeFailCount: number
    decodeTotalTime: number
    generationToDecodeTotalTime: number
    generationToDecodeMaxTime: number
    framesNotDecodedInTimeCount: number
    drawnFrameCount: number
    drawnDroppedFrameCount: number
}

export interface CanvasVideoInterface {
    canvas: HTMLCanvasElement
    isDry: boolean
    debug: CanvasDebug | null

    onNeedsTextureUpdate(callback: () => void)

    offNeedsTextureUpdate(callback: () => void)
}

interface QueueEntry {
    number: number
    time: number
    url?: string
    image?: HTMLImageElement
    ready: boolean
}

const DELAY_MS = 500;
const MAX_DECODES = 20;
const MAX_QUEUE_LENGTH = 30;

export default class CanvasVideo implements CanvasVideoInterface {
    canvas: HTMLCanvasElement
    context: CanvasRenderingContext2D
    queue: QueueEntry[] = []
    lastFrameTime: Date | null = null
    lastReceivedFrameNumber: number = -1
    textureUpdateListeners: (() => void)[] = []
    isDry: boolean = false
    debug: CanvasDebug | null = null
    framesBeingDecodedCount: number = 0

    constructor(width: number, height: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.context = this.canvas.getContext('2d', {
            // I don't see much of an improvement with those attributes, but they are supposed to speed things up
            alpha: false,
            desynchronized: true,
            // willReadFrequently doesn't help because then it's THREE.js that clogs the browser when it copies from our RAM canvas to its GPU texture
        });

        this.animate();
    }

    pushFrame(data: { number: number, time: number, jpeg: ArrayBuffer }, quality: 'original' | 'low') {
        if (this.debug) {
            this.debug.websocketFrameCount++;
            this.debug.websocketTotalBytes += data.jpeg.byteLength;
        }

        this.lastFrameTime = new Date();
        this.lastReceivedFrameNumber = data.number;

        if (this.framesBeingDecodedCount > MAX_DECODES) {
            if (this.debug) {
                this.debug.decoderDroppedFrameCount++;
            }

            return;
        }

        this.framesBeingDecodedCount++;

        let startTime: Date;

        if (this.debug) {
            this.debug.decodeFrameCount += 1;
            startTime = new Date();
        }

        let url: string;
        const img = new Image();
        img.onload = () => {
            entry.ready = true;

            URL.revokeObjectURL(url);

            if (this.debug) {
                const endTime = (new Date()).getTime()
                const decodeTime = endTime - startTime.getTime();
                const timeFromGeneration = endTime - data.time;

                this.debug.decodeTotalTime += decodeTime;
                this.debug.generationToDecodeTotalTime += timeFromGeneration;

                if (timeFromGeneration > this.debug.generationToDecodeMaxTime) {
                    this.debug.generationToDecodeMaxTime = timeFromGeneration;
                }
            }

            this.framesBeingDecodedCount--;
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);

            if (this.debug) {
                this.debug.decodeFailCount += 1;
                // TODO: also calculate execution time for errors? It's unlikely to happen
            }

            this.framesBeingDecodedCount--;
        }

        if (this.queue.length > MAX_QUEUE_LENGTH) {
            this.queue.shift();

            if (this.debug) {
                this.debug.queueDroppedFrameCount++;
            }
        }

        const blob = new Blob([data.jpeg], {type: 'application/octet-binary'});
        url = URL.createObjectURL(blob);

        const entry: QueueEntry = {
            number: data.number,
            time: data.time,
            url,
            image: img,
            ready: false,
        };

        this.queue.push(entry);

        img.src = url;
    }

    animate() {
        if (this.queue.length > 0) {
            if (this.isDry) {
                this.isDry = false;
                m.redraw();
            }

            const drawingTime = (new Date()).getTime() - DELAY_MS;

            let frame: QueueEntry | null = null;

            while (this.queue.length > 0 && this.queue[0].time <= drawingTime) {
                const passedFrame = this.queue.shift();

                if (!passedFrame.ready) {
                    // Revoke as soon as possible to free up RAM
                    if (passedFrame.url) {
                        URL.revokeObjectURL(passedFrame.url);
                    }

                    if (this.debug) {
                        this.debug.framesNotDecodedInTimeCount++;
                    }

                    continue;
                }

                if (frame && this.debug) {
                    this.debug.drawnDroppedFrameCount++;
                }

                frame = passedFrame;
            }

            if (frame) {
                //this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.context.drawImage(frame.image, 0, 0, this.canvas.width, this.canvas.height);

                this.textureUpdateListeners.forEach(callback => callback());

                if (this.debug) {
                    this.debug.drawnFrameCount++;
                }
            }
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
    debug: CanvasDebug | null = null

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

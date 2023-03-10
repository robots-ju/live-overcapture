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

const MAX_DECODES = 20;
const MAX_QUEUE_LENGTH = 30;

// In theory, decoding images in the worker should be faster
// But in practice it isn't the case
// In the worker we are forced to use createImageBitmap instead of HTMLImageElement which seems a lot slower for our 4K content
// Probably because it's decoded in the RAM and then needs even more processing to copy to canvas
const DECODE_IMAGE_IN_WORKER = false;

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
    worker: Worker
    cropTop: number
    cropBottom: number
    delayMs: number

    constructor(width: number, height: number, cropTop: number, cropBottom: number, delayMs: number) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.cropTop = cropTop;
        this.cropBottom = cropBottom;
        this.delayMs = delayMs;
        this.context = this.canvas.getContext('2d', {
            // I don't see much of an improvement with those attributes, but they are supposed to speed things up
            alpha: false,
            desynchronized: true,
            // willReadFrequently doesn't help because then it's THREE.js that clogs the browser when it copies from our RAM canvas to its GPU texture
        });
        this.context.imageSmoothingEnabled = false;

        this.worker = new Worker('assets/videofeed.js');
        this.worker.onmessage = event => {
            if (event.data.pushFrame) {
                this.pushFrame(event.data);

                return;
            }

            if (event.data.imageToDraw) {
                this.drawImageOnContext(event.data.imageToDraw);

                return;
            }

            if (typeof event.data.isDry !== 'undefined') {
                this.isDry = event.data.isDry;
                m.redraw();
            }

            if (this.debug) {
                if (event.data.decoderDroppedFrameCount) {
                    this.debug.decoderDroppedFrameCount++;
                }
                if (event.data.decodeFrameCount) {
                    this.debug.decodeFrameCount++;
                }
                if (event.data.queueDroppedFrameCount) {
                    this.debug.queueDroppedFrameCount++;
                }
                if (event.data.decoderDroppedFrameCount) {
                    this.debug.decoderDroppedFrameCount++;
                }
                if (event.data.framesNotDecodedInTimeCount) {
                    this.debug.framesNotDecodedInTimeCount++;
                }
                if (event.data.drawnDroppedFrameCount) {
                    this.debug.drawnDroppedFrameCount++;
                }
                if (event.data.decodeTotalTime) {
                    this.debug.decodeTotalTime += event.data.decodeTotalTime;
                }
                if (event.data.generationToDecodeTotalTime) {
                    this.debug.generationToDecodeTotalTime += event.data.generationToDecodeTotalTime;

                    if (event.data.generationToDecodeTotalTime > this.debug.generationToDecodeMaxTime) {
                        this.debug.generationToDecodeMaxTime = event.data.generationToDecodeTotalTime;
                    }
                }
            }
        };

        if (!DECODE_IMAGE_IN_WORKER) {
            this.animate();
        }
    }

    initWorker(uri: string, deviceKey: string) {
        this.worker.postMessage({
            command: 'init',
            uri,
            deviceKey,
            decodeInWorker: DECODE_IMAGE_IN_WORKER,
        });
    }

    enableWorker(enabled: boolean = true, quality: string) {
        this.worker.postMessage({
            command: 'enable',
            enabled,
            quality,
        });
    }

    pushFrame(data: { number: number, time: number, jpeg: ArrayBuffer }) {
        // Copy reference to debug object so that even if it changes before the image onload/onerror callbacks the code doesn't break
        // if debug was turned off, it'll simply write to the old debug object that will be garbage collected by the browser
        // also gives stats a bit more integrity by not having impossible numbers if enabled while something is in progress
        const {debug} = this;

        if (debug) {
            debug.websocketFrameCount++;
            debug.websocketTotalBytes += data.jpeg.byteLength;
        }

        this.lastFrameTime = new Date();
        this.lastReceivedFrameNumber = data.number;

        if (this.framesBeingDecodedCount > MAX_DECODES) {
            if (debug) {
                debug.decoderDroppedFrameCount++;
            }

            return;
        }

        this.framesBeingDecodedCount++;

        let startTime: Date;

        if (debug) {
            debug.decodeFrameCount += 1;
            startTime = new Date();
        }

        let url: string;
        const img = new Image();
        img.onload = () => {
            entry.ready = true;

            URL.revokeObjectURL(url);

            if (debug) {
                const endTime = (new Date()).getTime()
                const decodeTime = endTime - startTime.getTime();
                const timeFromGeneration = endTime - data.time;

                debug.decodeTotalTime += decodeTime;
                debug.generationToDecodeTotalTime += timeFromGeneration;

                if (timeFromGeneration > debug.generationToDecodeMaxTime) {
                    debug.generationToDecodeMaxTime = timeFromGeneration;
                }
            }

            this.framesBeingDecodedCount--;
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);

            if (debug) {
                debug.decodeFailCount += 1;
                // TODO: also calculate execution time for errors? It's unlikely to happen
            }

            this.framesBeingDecodedCount--;
        }

        if (this.queue.length > MAX_QUEUE_LENGTH) {
            this.queue.shift();

            if (debug) {
                debug.queueDroppedFrameCount++;
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

            const drawingTime = (new Date()).getTime() - this.delayMs;

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
                setTimeout(() => {
                    this.drawImageOnContext(frame.image);
                }, 0);
            }
        } else if (!this.isDry && (!this.lastFrameTime || ((new Date()).getTime() - this.lastFrameTime.getTime()) > 5000)) {
            this.isDry = true;
            m.redraw();
        }

        // Using a regular timeout instead of requestAnimation seems to bring some improvement
        setTimeout(this.animate.bind(this), 5);
    }

    drawImageOnContext(image: HTMLImageElement | ImageBitmap) {
        this.context.drawImage(image, 0, this.cropTop, this.canvas.width, this.canvas.height - this.cropTop - this.cropBottom);

        this.textureUpdateListeners.forEach(callback => callback());

        if (this.debug) {
            this.debug.drawnFrameCount++;
        }
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

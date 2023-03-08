import {io, Socket} from 'socket.io-client';

const DELAY_MS = 300;
const MAX_DECODES = 20;
const MAX_QUEUE_LENGTH = 30;

interface QueueEntry {
    number: number
    time: number
    image?: ImageBitmap
    ready: boolean
}

let socket: Socket | null = null;
let deviceKey: string | null = null;
let framesBeingDecodedCount: number = 0;
const queue: QueueEntry[] = [];
let isDry: boolean = false;
let lastFrameTime: Date | null = null;

onmessage = (event) => {
    switch (event.data.command) {
        case 'init':
            // Will make sense once we share the worker between windows
            // It doesn't make sense to reset the existing connection
            if (socket) {
                console.info('Worker already initialized');
                return;
            }

            socket = io(event.data.uri);
            deviceKey = event.data.deviceKey;

            if (event.data.decodeInWorker) {
                socket.on('frame', data => {
                    setTimeout(() => {
                        pushFrame(data)
                    }, 0);
                });
            } else {
                socket.on('frame', data => {
                    postMessage({
                        pushFrame: true,
                        ...data,
                    });
                });
            }

            return;
        case 'enable':
            if (!socket) {
                return;
            }

            if (event.data.enabled) {
                socket.emit('start-stream', {
                    device: deviceKey,
                    quality: event.data.quality,
                });
            } else {
                socket.emit('stop-stream', {
                    device: deviceKey,
                    quality: event.data.quality,
                });
            }
            return;
    }
}

function pushFrame(data: { number: number, time: number, jpeg: ArrayBuffer }) {
    lastFrameTime = new Date();

    if (framesBeingDecodedCount > MAX_DECODES) {
        postMessage({
            decoderDroppedFrameCount: 1,
        });

        return;
    }

    framesBeingDecodedCount++;

    postMessage({
        decodeFrameCount: 1,
    });

    const startTime = new Date();

    createImageBitmap(new Blob([data.jpeg], {type: 'application/octet-binary'})).then(image => {
        entry.image = image;
        entry.ready = true;

        framesBeingDecodedCount--;

        const endTime = (new Date()).getTime()
        const decodeTime = endTime - startTime.getTime();
        const timeFromGeneration = endTime - data.time;

        postMessage({
            decodeTotalTime: decodeTime,
            generationToDecodeTotalTime: timeFromGeneration,
        });
    }).catch(() => {
        framesBeingDecodedCount--;

        postMessage({
            framesBeingDecodedCount: 1,
        });
    });

    if (queue.length > MAX_QUEUE_LENGTH) {
        queue.shift();

        postMessage({
            queueDroppedFrameCount: 1,
        });
    }

    const entry: QueueEntry = {
        number: data.number,
        time: data.time,
        ready: false,
    };

    queue.push(entry);
}

function animate() {
    if (queue.length > 0) {
        if (isDry) {
            isDry = false;
            postMessage({
                isDry: false,
            });
        }

        const drawingTime = (new Date()).getTime() - DELAY_MS;

        let frame: QueueEntry | null = null;

        while (queue.length > 0 && queue[0].time <= drawingTime) {
            const passedFrame = queue.shift();

            if (!passedFrame.ready) {
                postMessage({
                    framesNotDecodedInTimeCount: 1,
                });

                continue;
            }

            if (frame) {
                postMessage({
                    drawnDroppedFrameCount: 1,
                });
            }

            frame = passedFrame;
        }

        if (frame) {
            postMessage({
                imageToDraw: frame.image,
            });
        }
    } else if (!isDry && (!lastFrameTime || ((new Date()).getTime() - lastFrameTime.getTime()) > 5000)) {
        isDry = true;
        postMessage({
            isDry: true,
        });
    }

    setTimeout(animate, 10);
}

animate();

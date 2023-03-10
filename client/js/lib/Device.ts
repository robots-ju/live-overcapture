import CanvasVideo, {CanvasVideoInterface, StaticCanvasVideo} from './CanvasVideo';
import {DeviceConfig} from './Config';

export interface DeviceInterface {

    canvas: CanvasVideoInterface
}

const DEFAULT_DELAY_MS = 250;

export default class Device {
    canvas: CanvasVideo
    enabled: boolean = false
    description: string

    constructor(config: DeviceConfig) {
        const cropTop = config.crop?.top || 0;
        const cropBottom = config.crop?.bottom || 0;
        const delay = config.delay || DEFAULT_DELAY_MS;

        this.canvas = new CanvasVideo(config.width, config.height, cropTop, cropBottom, delay);
        this.description = 'source ' + config.width + 'x' + config.height + ' / crop ' + cropTop + ' ' + cropBottom + ' / delay ' + delay + 'ms';
    }
}

export class LocalDevice {
    canvas: StaticCanvasVideo

    constructor(image: HTMLImageElement) {
        this.canvas = new StaticCanvasVideo(image);
    }
}

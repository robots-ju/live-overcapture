import * as m from 'mithril';
import CanvasVideo, {CanvasVideoInterface, StaticCanvasVideo} from './CanvasVideo';
import {DeviceConfig, DeviceState} from './Config';

export interface DeviceInterface {

    canvas: CanvasVideoInterface
}

const DEFAULT_DELAY_MS = 250;

export default class Device {
    state: DeviceState = {
        battery: null,
    }
    canvas: CanvasVideo
    enabled: boolean = false

    constructor(config: DeviceConfig) {
        this.canvas = new CanvasVideo(config.width, config.height, config.crop?.top || 0, config.crop?.bottom || 0, config.delay || DEFAULT_DELAY_MS);
    }

    pushState(state: DeviceState) {
        this.state = state;
        m.redraw();
    }
}

export class LocalDevice {
    canvas: StaticCanvasVideo

    constructor(image: HTMLImageElement) {
        this.canvas = new StaticCanvasVideo(image);
    }
}

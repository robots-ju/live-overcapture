export interface CameraConfig {
    key: string
    ratio: number
}

export interface DeviceConfig {
    key: string
    width: number
    height: number
    crop?: {
        top?: number
        bottom?: number
    }
    delay?: number
    cameras: CameraConfig[]
}

export interface AppConfig {
    devices: DeviceConfig[]
}

export interface AppState {
    debug: boolean
}

export interface DeviceState {
    battery: number | null
}

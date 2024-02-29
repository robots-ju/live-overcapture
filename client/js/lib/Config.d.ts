export interface AutoFovStep {
    pitch: number
    fov: number
}

export interface CameraConfig {
    key: string
    ratio?: number
    'auto-fov'?: AutoFovStep[]
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

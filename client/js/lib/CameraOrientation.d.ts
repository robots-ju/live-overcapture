/**
 * I couldn't find any official 360 direction standard, so this is based on the Google VR definition which seems to also be used by other software.
 */
export default interface CameraOrientation {
    pitch: number // -90 to 90. Positive is up
    yaw: number // -180 to 180. 0 is center of source image. Positive is to the right
    fov: number // Vertical FOV value for the camera
}

import * as THREE from 'three';
import CameraOrientation from './CameraOrientation';
import Camera from './Camera';
import ThreeScene from './ThreeScene';

/**
 * Converts the camera orientation to a camera rotation for THREE.js
 * @param orientation
 */
function orientationToRotation(orientation: CameraOrientation) {
    return {
        x: orientation.pitch * Math.PI / 180,
        y: -orientation.yaw * Math.PI / 180,
        z: 0,
    }
}

export default class ThreeCamera {
    running: boolean = true
    camera: Camera
    width: number
    height: number
    scene: ThreeScene
    threeCamera?: THREE.PerspectiveCamera
    renderer?: THREE.Renderer

    constructor(camera: Camera, width: number, height: number, scene: ThreeScene) {
        this.camera = camera;
        this.width = width;
        this.height = height;
        this.scene = scene;
    }

    init() {
        // Already initialized
        if (this.threeCamera) {
            return;
        }

        this.threeCamera = new THREE.PerspectiveCamera(this.camera.currentOrientation.fov || 75, this.width / this.height, 1, 1000);
        this.threeCamera.position.set(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            alpha: false,
            antialias: true
        });
        this.renderer.setSize(this.width, this.height, false);

    }

    animate() {
        if (!this.running) {
            return;
        }

        requestAnimationFrame(this.animate.bind(this));

        // TODO: animation
        const rotation = orientationToRotation(this.camera.currentOrientation);

        this.threeCamera.rotation.set(rotation.x, rotation.y, rotation.z, 'YXZ');
        if (this.threeCamera.fov !== this.camera.currentOrientation.fov) {
            this.threeCamera.fov = this.camera.currentOrientation.fov;
            this.threeCamera.updateProjectionMatrix();
        }

        this.renderer.render(this.scene.scene, this.threeCamera);
    }

    mount(target: HTMLElement) {
        this.init();

        target.appendChild(this.renderer.domElement);

        requestAnimationFrame(this.animate.bind(this));
    }

    unmount() {
        this.running = false;
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
}

import * as THREE from 'three';
import CameraOrientation from './CameraOrientation';
import Camera from './Camera';

const SPHERE_RADIUS = 256;
const SPHERE_DETAIL = 32;

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

export default class Scene {
    running: boolean = true
    camera: Camera
    width: number
    height: number
    threeCamera?: THREE.PerspectiveCamera
    scene?: THREE.Scene
    renderer?: THREE.Renderer
    texture?: THREE.CanvasTexture
    needsTextureUpdateCallback: (() => void) | null = null

    constructor(camera: Camera, width: number, height: number) {
        this.camera = camera;
        this.width = width;
        this.height = height;
    }

    init() {
        // Already initialized
        if (this.threeCamera) {
            return;
        }

        this.threeCamera = new THREE.PerspectiveCamera(75, this.width / this.height, 1, 1000);

        this.scene = new THREE.Scene();
        this.texture = new THREE.CanvasTexture(this.camera.device.canvas.canvas);

        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.format = THREE.RGBAFormat;

        this.threeCamera.position.set(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({
            alpha: false,
            antialias: true
        });
        this.renderer.setSize(this.width, this.height, false);

        const movieGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_DETAIL, SPHERE_DETAIL);
        const movieMaterial = new THREE.MeshBasicMaterial({map: this.texture, side: THREE.BackSide});

        const movieScreen = new THREE.Mesh(movieGeometry, movieMaterial);
        const position = {x: 0, y: 0, z: 0};
        movieScreen.position.set(position.x, position.y, position.z);

        movieScreen.scale.x = -1;
        movieScreen.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        this.scene.add(movieScreen);
    }

    animate() {
        if (!this.running) {
            return;
        }

        requestAnimationFrame(this.animate.bind(this));

        // TODO: animation
        const rotation = orientationToRotation(this.camera.orientation.to);

        this.threeCamera.rotation.set(rotation.x, rotation.y, rotation.z, 'YXZ');

        this.renderer.render(this.scene, this.threeCamera);
    }

    mount(target: HTMLElement) {
        this.init();

        target.appendChild(this.renderer.domElement);

        requestAnimationFrame(this.animate.bind(this));

        this.needsTextureUpdateCallback = this.needsTextureUpdate.bind(this);
        this.camera.device.canvas.onNeedsTextureUpdate(this.needsTextureUpdateCallback);
    }

    unmount() {
        this.camera.device.canvas.offNeedsTextureUpdate(this.needsTextureUpdateCallback);
        this.running = false;
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }

    needsTextureUpdate() {
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
    }
}

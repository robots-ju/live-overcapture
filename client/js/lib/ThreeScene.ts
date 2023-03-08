import * as THREE from 'three';
import {DeviceInterface} from './Device';

const SPHERE_RADIUS = 256;
const SPHERE_DETAIL = 32;

export default class ThreeScene {
    device: DeviceInterface
    scene?: THREE.Scene
    texture?: THREE.CanvasTexture
    needsTextureUpdateCallback: (() => void) | null = null

    constructor(device: DeviceInterface) {
        this.device = device;
    }

    init() {
        // Already initialized
        if (this.scene) {
            return;
        }

        this.scene = new THREE.Scene();
        this.texture = new THREE.CanvasTexture(this.device.canvas.canvas);

        this.texture.generateMipmaps = false;
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.format = THREE.RGBAFormat;

        const movieGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, SPHERE_DETAIL, SPHERE_DETAIL);
        const movieMaterial = new THREE.MeshBasicMaterial({map: this.texture, side: THREE.BackSide});

        const movieScreen = new THREE.Mesh(movieGeometry, movieMaterial);
        const position = {x: 0, y: 0, z: 0};
        movieScreen.position.set(position.x, position.y, position.z);

        movieScreen.scale.x = -1;
        movieScreen.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
        this.scene.add(movieScreen);

        this.needsTextureUpdateCallback = this.needsTextureUpdate.bind(this);
        this.device.canvas.onNeedsTextureUpdate(this.needsTextureUpdateCallback);
    }

    destroy() {
        this.device.canvas.offNeedsTextureUpdate(this.needsTextureUpdateCallback);
    }

    needsTextureUpdate() {
        if (this.texture) {
            this.texture.needsUpdate = true;
        }
    }
}

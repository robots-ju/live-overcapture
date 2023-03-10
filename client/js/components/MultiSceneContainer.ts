import * as m from 'mithril';
import ThreeScene from '../lib/ThreeScene';
import SceneContainer from './SceneContainer';
import Camera from '../lib/Camera';
import App from '../lib/App';

interface ProgramAttrs {
    app: App
    cameras: Camera[]
}

export default class MultiSceneContainer implements m.ClassComponent<ProgramAttrs> {
    scene: ThreeScene

    oninit(vnode: m.Vnode<ProgramAttrs, this>) {
        const {cameras, app} = vnode.attrs;

        if (cameras.length === 0) {
            console.error('No cameras passed to MultiSceneContainer');
            return;
        }

        const device = cameras[0].device;

        cameras.forEach(camera => {
            app.toggleCamera(camera.key, true);

            if (camera.device !== device) {
                console.warn('Not all cameras are connected to the same device, this is not supported');
                // We can let the script continue anyway, the camera will just frame the wrong device
            }
        });

        this.scene = new ThreeScene(device);
        this.scene.init();
    }

    view(vnode: m.VnodeDOM<ProgramAttrs, this>) {
        const {cameras} = vnode.attrs;

        return m('.MultiSceneContainer', cameras.map(camera => {
            return m(SceneContainer, {
                camera,
                // If there are multiple cameras, shrink them as necessary to fit the screen
                // If there is enough space to fit the configured ratio, don't stretch them any further
                // We'll use CSS to create the space between them
                width: cameras.length === 1 ? window.innerWidth : Math.floor(Math.min(window.innerWidth / cameras.length, window.innerHeight * camera.ratio)),
                height: window.innerHeight,
                scene: this.scene,
            });
        }));
    }
}

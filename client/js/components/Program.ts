import * as m from 'mithril';
import Scene from '../lib/Scene';
import SceneContainer from './SceneContainer';
import App from '../lib/App';

interface ProgramAttrs {
    app: App
}

export default class Program implements m.ClassComponent<ProgramAttrs> {
    scene: Scene

    oninit(vnode: m.Vnode<ProgramAttrs, this>) {
        vnode.attrs.app.changeQuality('original');
    }

    view(vnode: m.VnodeDOM<ProgramAttrs, this>) {
        const camera = vnode.attrs.app.cameras[m.route.param('camera')];

        if (!camera) {
            return m('p', 'Loading camera...');
        }

        // Doesn't hurt to call it repeatedly, but it has to be done when the camera object exists
        vnode.attrs.app.toggleCamera(camera.key, true);

        return m(SceneContainer, {
            camera,
            width: window.innerWidth,
            height: window.innerHeight, // TODO: ratio
        });
    }
}

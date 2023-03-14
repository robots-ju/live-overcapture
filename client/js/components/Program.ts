import * as m from 'mithril';
import App from '../lib/App';
import MultiSceneContainer from './MultiSceneContainer';

interface ProgramAttrs {
    app: App
}

export default class Program implements m.ClassComponent<ProgramAttrs> {

    oninit(vnode: m.Vnode<ProgramAttrs, this>) {
        vnode.attrs.app.changeQuality('original');

        document.title = 'Live Overcapture - ' + vnode.attrs.app.uri + ' - Program - ' + m.route.param('camera');
    }

    view(vnode: m.VnodeDOM<ProgramAttrs, this>) {
        const {app} = vnode.attrs;

        const heights = [];
        const cameraKeys = m.route.param('camera').split('+').map(key => {
            const parts = key.split('(');

            heights.push(parts.length > 1 ? parseInt(parts[1].replace(')', '')) : null);

            return parts[0];
        });

        const cameras = [];

        for (let i = 0; i < cameraKeys.length; i++) {
            const camera = app.cameras[cameraKeys[i]];

            if (!camera) {
                return m('p', 'Loading camera...');
            }

            cameras.push(camera);
        }

        return m(MultiSceneContainer, {
            app,
            cameras,
            heights,
        });
    }
}

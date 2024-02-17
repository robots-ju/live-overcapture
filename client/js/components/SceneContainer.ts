import * as m from 'mithril';
import Camera from '../lib/Camera';
import ThreeScene from '../lib/ThreeScene';
import ThreeCamera from '../lib/ThreeCamera';

interface SceneContainerAttrs {
    scene: ThreeScene
    camera: Camera
    width: number
    height: number
}

export default class SceneContainer implements m.ClassComponent<SceneContainerAttrs> {
    camera: ThreeCamera

    view(vnode: m.VnodeDOM<SceneContainerAttrs, this>) {
        return m('.SceneContainer', m('.SceneDry', {
            className: vnode.attrs.camera.device.canvas.isDry ? 'is-dry' : '',
        }, m('.SceneDryIcon', m('i.fas.fa-spinner.fa-pulse'))));
    }

    oninit(vnode: m.Vnode<SceneContainerAttrs, this>) {
        const {camera, width, height} = vnode.attrs;

        this.camera = new ThreeCamera(camera, width, height, vnode.attrs.scene);
    }

    oncreate(vnode: m.VnodeDOM<SceneContainerAttrs, this>) {
        this.camera.mount(vnode.dom as HTMLElement);
    }

    onremove() {
        this.camera.unmount();
    }
}

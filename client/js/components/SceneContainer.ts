import * as m from 'mithril';
import Camera from '../lib/Camera';
import Scene from '../lib/Scene';

interface SceneContainerAttrs {
    camera: Camera
    width: number
    height: number
}

export default class SceneContainer implements m.ClassComponent<SceneContainerAttrs> {
    scene: Scene

    view(vnode: m.VnodeDOM<SceneContainerAttrs, this>) {
        return m('.SceneContainer', m('.SceneDry', {
            className: vnode.attrs.camera.device.canvas.isDry ? 'is-dry' : '',
        }, 'Waiting for data...'));
    }

    oninit(vnode: m.Vnode<SceneContainerAttrs, this>) {
        const {camera, width, height} = vnode.attrs;

        this.scene = new Scene(camera, width, height);
    }

    oncreate(vnode: m.VnodeDOM) {
        this.scene.mount(vnode.dom as HTMLElement);
    }

    onremove() {
        this.scene.unmount();
    }
}

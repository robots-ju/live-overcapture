import * as m from 'mithril';
import Camera from '../lib/Camera';
import App from '../lib/App';
import CameraOrientation from '../lib/CameraOrientation';

interface AutoZoomControlAttrs {
    app: App
    camera: Camera
}

export default class AutoZoomControl implements m.ClassComponent<AutoZoomControlAttrs> {
    view(vnode: m.Vnode<AutoZoomControlAttrs, this>) {
        const {app, camera} = vnode.attrs;

        const checked = camera.targetOrientation.to.fov === 'auto';

        return m('label', [
            m('input', {
                type: 'checkbox',
                checked,
                onchange: () => {
                    let orientation = checked ? camera.convertToAbsoluteOrientation(camera.targetOrientation.to) : {
                        ...camera.targetOrientation.to,
                        fov: 'auto',
                    };

                    app.sendCameraTarget(camera.key, orientation as CameraOrientation);
                },
            }),
            ' Auto Fov (zoom)',
        ]);
    }
}

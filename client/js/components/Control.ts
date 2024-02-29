import * as m from 'mithril';
import App from '../lib/App';
import CameraFlatControl from './CameraFlatControl';
import Camera3DControl from './Camera3DControl';
import CameraGyroControl from './CameraGyroControl';
import AutoZoomControl from './AutoZoomControl';

interface ControlAttrs {
    app: App
}

export default class Control implements m.ClassComponent<ControlAttrs> {
    oninit(vnode: m.Vnode<ControlAttrs, this>) {
        document.title = 'Live Overcapture - ' + vnode.attrs.app.uri + ' - Control';
    }

    view(vnode: m.VnodeDOM<ControlAttrs, this>) {
        const {app} = vnode.attrs;

        const deviceKeys = Object.keys(app.devices);
        const cameraKeys = Object.keys(app.cameras);

        return m('.ControlPanel', [
            m('div', [
                m('button', {
                    onclick: () => {
                        app.toggleDebug();
                    },
                }, 'Toggle debug'),
                ' ',
                m('button', {
                    onclick: () => {
                        app.forceRefresh();
                    },
                }, 'Force refresh all program windows'),
                ' ',
                m('label', [
                    m('input', {
                        type: 'checkbox',
                        checked: app.quality === 'original',
                        onchange: () => {
                            app.changeQuality(app.quality === 'original' ? 'low' : 'original');
                        },
                    }),
                    ' Preview in original quality',
                ]),
            ]),
            m('h2', 'Devices'),
            deviceKeys.length ? m('ul', deviceKeys.map(key => {
                const device = app.devices[key];

                return m('li', [
                    key + ' / ' + device.description,
                ]);
            })) : m('p', 'No devices available'),
            m('h2', 'Cameras'),
            cameraKeys.length ? m('ul', cameraKeys.map(key => {
                const camera = app.cameras[key];

                return m('li', m('label', [
                    m('input', {
                        type: 'checkbox',
                        checked: camera.enabled,
                        onchange: () => {
                            app.toggleCamera(key, !camera.enabled);
                        },
                    }),
                    ' ' + key + ' ',
                    m(CameraGyroControl, {
                        app,
                        camera,
                    }),
                    m(AutoZoomControl, {
                        app,
                        camera,
                    }),
                ]));
            })) : m('p', 'No devices available'),
            m('h2', 'Control'),
            cameraKeys.length ? m('.CameraControlList', cameraKeys.map(key => {
                const camera = app.cameras[key];

                if (!camera.enabled) {
                    return null;
                }

                return m('.CameraControl', [
                    m(CameraFlatControl, {
                        app,
                        camera,
                    }),
                    m(Camera3DControl, {
                        app,
                        camera,
                    }),
                ]);
            })) : m('p', 'No cameras selected'),
        ]);
    }
}

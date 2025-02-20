import * as m from 'mithril';
import App from '../lib/App';
import DeviceEquirectangularView from './DeviceEquirectangularView';

interface EquirectangularAttrs {
    app: App
}

export default class Equirectangular implements m.ClassComponent<EquirectangularAttrs> {
    oninit(vnode: m.Vnode<EquirectangularAttrs, this>) {
        document.title = 'Live Overcapture - ' + vnode.attrs.app.uri + ' - Program - ' + m.route.param('device');
    }

    view(vnode: m.VnodeDOM<EquirectangularAttrs, this>) {
        const {app} = vnode.attrs;

        const deviceKey = m.route.param('device');

        const device = app.devices[deviceKey];

        if (!device) {
            return m('p', 'Loading...');
        }

        const params = new URLSearchParams(window.location.search);
        const offset = params.get('offset');
        const width = params.get('width');

        return m(DeviceEquirectangularView, {
            device,
            yawOffsetPixels: offset ? parseInt(offset) : 0,
            width: width ? parseInt(width) : 0,
        });
    }
}

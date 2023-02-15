import * as m from 'mithril';
import App from './lib/App';
import Control from './components/Control';
import Program from './components/Program';

let uri: string = m.parseQueryString(window.location.search).host as string || window.location.hostname;
if (!/:[0-9+]$/.test(uri)) {
    // Add default port if unspecified
    uri += ':8890';
}
if (!/^https?:\/\//.test(uri)) {
    // Add default protocol if unspecified
    uri = 'http://' + uri;
}

const app = new App();
app.connect(uri);

m.route(document.getElementById('js-app'), '/control', {
    '/control': {
        view() {
            return m(Control, {
                app,
            });
        },
    },
    '/program/:camera': {
        view() {
            return m(Program, {
                app,
            });
        },
    },
});

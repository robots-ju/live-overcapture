import * as m from 'mithril';
import App from './lib/App';
import Control from './components/Control';
import Program from './components/Program';

const app = new App();
app.connect(m.parseQueryString(window.location.search).host as string || ('http://' + window.location.hostname + ':8890'));

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

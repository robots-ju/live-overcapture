# Live Overcapture

This project enables the use of 360 cameras in a 2D live production.
Virtual cameras can be placed in spherical scenes and controlled via a different device on the network.

Gstreamer is used to read and decode data streams from the cameras, create smaller preview feeds and master recording.
NodeJS is used to send the individual JPEG frames created by Gstreamer over websocket on the network and provides the control server.
An HTML5 webapp using Socket.io and THREE.js powers the control interface and program outputs.

The server only supports Ricoh Theta cameras (tested with Theta V) over USB but could probably support many other sources.
When the camera runs in 4K mode, each frame sent over the websocket is around 1MB in size, the maximum bandwidth required is about 30MB/s for each device*client.

## Installation

The commands below have been tested on Ubuntu 22.04 LTS

### Install the LIBUVC Theta fork

The [Theta UVC fork](https://github.com/ricohapi/libuvc-theta) is required for reading the h264 stream from the camera.

During my tests I had to customize the `LIBDIR` path to get things working consistently.
`gstreamer1.0-libav` is required to use hardware decoding for h264.

```sh
sudo apt install build-essential cmake git libusb-1.0-0-dev libjpeg-dev gstreamer1.0-libav
git clone https://github.com/ricohapi/libuvc-theta.git
cd libuvc-theta
mkdir build
cd build
cmake .. -DCMAKE_INSTALL_LIBDIR=/usr/lib/x86_64-linux-gnu
make
sudo make install
```

### Compile Theta video aggregator

The video aggregator binary is an adaptation from the [Theta Sample project](https://github.com/ricohapi/libuvc-theta-sample), which is why it's written in C.

```sh
cd live-overcapture/theta
make
```

### Install NodeJS dependencies

```sh
cd live-overcapture
npm i
npm run build
```

## Run

### Server

Edit `live-overcapture/server/config.json`.

```sh
cd live-overcapture/server
node server.js
```

### Control and preview

Serve the `client-dist` (generated above with `build` command) folder using a webserver, for example `php -S 0.0.0.0:4000`.

Access `http://<server ip>/#!/control` in a browser.

If the client is served from a different host than the NodeJS server, the server IP can be specified with the `host` query string: `http://<ui ip>/?host=<server ip>#/control`.

The program can be accessed at `http://<server ip>/#!/program/<camera key>`.

Multiple camera keys that belong to the same device can be specified with a `+`, like `http://192.168.1.10/#!/program/a+b`.
This improves performance by using a single websocket, decoder and THREE.js scene and texture.

### Adding as OBS source

The program page can be added as a Browser source in OBS, however it seems like OBS disables some of the hardware acceleration in the embedded Browser sources, so it just can't keep up with the framerate.

Instead, the page can be launched into a standalone window and captured with a window capture source.

To ensure the proper sizing and no browser UI, launch Chrome from the command line:

```sh
/opt/google/chrome/chrome --window-size=800,800 --app=http://<server ip>/#\!/program/<camera key>
```

`!` must be escaped, or it will be read as a hashbang!

## Miscellaneous

To quickly check the battery level or serial number of the Theta, switch out of streaming mode and run:

```sh
sudo apt install mtp-tools
mtp-detect | grep "   Model:\|   Device version:\|   Serial number:\|   Battery level"
```

MTP communication seems to unfortunately not be available when in streaming mode.

## License

Code in the `theta` folder is licensed under the BSD license.

All other code is licensed under the MIT license.

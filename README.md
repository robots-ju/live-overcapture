# Live Overcapture

This project enables the use of 360 cameras in a 2D live production.
Virtual cameras can be placed in spherical scenes and controlled via a different device on the network.

Gstreamer is used to read and decode data streams from the cameras, create smaller preview feeds and master recording.
NodeJS is used to send the individual JPEG frames created by Gstreamer over websocket on the network and provides the control server.
An HTML5 webapp using Socket.io and THREE.js powers the control interface and program outputs.

The server only supports Ricoh Theta cameras (tested with Theta V and Z1) over USB but could probably support many other sources.
When the camera runs in 4K mode, each frame sent over the websocket is around 1MB in size, the maximum bandwidth required is about 30MB/s for each device*client.

This project was only tested on Linux and Chrome.
Firefox 3D and jpeg decoding is not performant enough to keep up.

## Installation

The commands below have been tested on Ubuntu 22.04 LTS

### Install the LIBUVC Theta fork

The [Theta UVC fork](https://github.com/ricohapi/libuvc-theta) is required for reading the h264 stream from the camera.

During my tests I had to customize the `LIBDIR` path to get things working consistently.
`gstreamer1.0-libav` is required to use hardware decoding for h264.

Some combination of the gstreamer bad plugins is also necessary to handle h264 at all.
I'll try to update these instructions when I isolate which exact package is needed.
In the meantime I just installed all the `libgstreamer*` and `gstreamer*` packages available in the repo and it works.

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

`pipe-prefix` must be a valid directory name in which the process will be able to create FIFO files.

`raw-record-path` must be a valid directory in which to create recording files.
Files will automatically be named with the device key and date.
To disable recording, remove or rename the key.
For performance reasons, only the raw 4K stream is recorded without any processing.
This can use around 1GB per minute of stream!

Currently only one device with type `theta` is supported, and it will automatically pick the first camera available.

`playback` devices are mostly meant for testing.
The provided `uri` video absolute path will be played in a loop with GStreamer's `uridecodebin uri=`.
The program checks that a file exists on the filesystem at that address before starting the server.

For best performance, the video height after crop should be divisible by 2.

```sh
cd live-overcapture/server
node server.js
```

### Control and preview

Serve the `client-dist` (generated above with `build` command) folder using a webserver, for example `php -S 0.0.0.0:4000`.

Access `http://<server ip>/#!/control` in a browser.

If the client is served from a different host than the NodeJS server, the server IP can be specified with the `host` query string: `http://<ui ip>/?host=<server ip>#/control`.

To use the gyro control method without HTTPS, you can add the IP:port to Chrome's insecure-as-secure flag <chrome://flags/#unsafely-treat-insecure-origin-as-secure>

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

If the Chrome window is larger than the screen, you might need to move the window with the mouse to "un-constrain" it from the screen width.
This happened every time on XUbuntu where the width given in parameter would be ignored (but not lost) until the window was made free-floating, then it would adopt the intended size.

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

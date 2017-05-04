Conkie
======
NodeJS + Electron desktop widgets.

This project is designed to replace the seminal [Conky project](https://github.com/brndnmtthws/conky) by Brenden Matthews with a Browser based desktop widget (Yes this is similar to how Windows '98 worked but less horrifying).

Conkie relies on a few things to gather system statistics which is documented in the [Conkie-Stats module](https://github.com/hash-bang/Conkie-Stats). [Basic installation instructions](#installing) are provided below.


Themes
------

![conkie-theme-default](docs/img/full.jpg)

* [conkie-theme-default](https://github.com/hash-bang/conkie-theme-default) by [hash-bang](https://github.com/hash-bang)


![conkie-theme-material](https://raw.githubusercontent.com/Heziode/conkie-theme-material/master/screenshot.png)

* [conkie-theme-material](https://github.com/Heziode-dev/conkie-theme-material) by [Heziode](https://github.com/Heziode)



**ARE YOU A DESIGNER?**

Please [get in touch](https://github.com/hash-bang/Conkie/issues). I could really do with a bit of design help with perfecting this project. Even if you can't code - thats fine, I can help you or add the code myself. I need designs for this module to take off.

I'm happy to help anyone who has an existing Conky theme that needs to be converted over to Conkie. Please [contact me](mailto:matt@mfdc.biz).


Features
--------

* HTML based layout - style your desktop widgets just as you would a web page
* Theme based customizability - create your own skins or use the provided examples
* Modular themes - NPM managed themes can import their own dependencies as needed
* Low power mode - when using a battery (such as in a Laptop) the refresh rate changes (set with `--refresh` and `--refresh-battery`)
* Modular system statistics - lots of functionality including CPU, Memory, Disks, IO usage, Dropbox and more.



Installing
==========

	# Install Node + NPM - see https://nodejs.org/en/download

	# Install all Conkie's external statistics gathering tools
	sudo apt-get install bwm-ng lm-sensors iotop wmctrl

	# Install Conkie itself and a theme
	npm install -g conkie conkie-theme-default


Run Conkie as a background process (this also uses `nice` to make sure Conkie sits in the idle update time of your CPU):

	nice conkie --background

To specify a specific theme (instead of the default) either provide the path to the HTML file or the name of the NPM module:

	conkie --background --theme conkie-theme-foobar

	OR

	conkie --background --theme /path/to/your/index.html

Use `--help` for other command line help.


Themes
=======
Conkie themes are a single HTML file which links to other required assets. You can override the default theme file by specifying `--theme <path to html file|npm module name>`.

To create a Conkie theme simply design a web-page as required and make a call to `require('electron').ipcRenderer.on('updateStats', ...)` to gather system statistics. A simple example is provided in the [themes](./themes) folder and below. You may also be interested in the source of the [Conkie-Theme-Default module](https://github.com/hash-bang/conkie-theme-default) which is the default Conkie theme.


**Tips:**

* To keep NPM happy, all dependencies should be NPM modules themselves. For example if you require Bootstrap use the NPM version of Bootstrap and load via `var bootstrap = require('bootstrap')` somewhere in your themes JavaScript files. Make sure you include this as a dependency in your `package.json` file so NPM pulls in whats needed during the module installation.
* A lot of weird kludges and fixes exist to try and load and rewrite your widgets contents inline. See the bottom of this README for the nasty internal details. Should Conkie be screwing up your theme try using lots of verbosity (e.g. `-vvvv`) to see what its doing. If its still acting strange please get in touch or [open an issue](https://github.com/hash-bang/Conkie/issues).
* Running Conkie with the `--debug` flag opens the theme in a Electron development console. This is useful to see console output.
* Running Connie with the `--debug-stats` flag dumps the stats object to the console on each refresh.


Theme API Reference
-------------------
Conkie uses IPC to communicate between the web browser (your HTML, CSS and JavaScript display elements) and its core process.

**Simple example**

The following code within a themes JavaScript will register with the main Conkie process, request `cpu` and `memory` modules be loaded and then listen for data feeds.

	require('electron').ipcRenderer

		// Request data feeds
		.send('statsRegister', ['cpu', 'memory'])

		// Setup any stats options
		.send('statsSettings', {})

		// Set the window position
		.send('setPosition', {left: 10, top: 10, width: 200, height: 100%'})

		// Listen to stats updates
		.on('updateStats', function(e, data) {
			// data now has `system`, `ram`, `net` etc. subkeys
			// Do something with this data
		})


All system information is provided via the [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) NPM module. See its documentation for a list of modules and data feeds it supports.


**EVENT: updateStats(event, stats)**

Receive a stats object from the [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) module. The available data depends on what modules were registered using the `registerStats()` message.


**METHOD: setPosition(obj)**

Set the position of the widget on the screen. Since Conkie positions your widget, the theme needs to ask Conkie to move its screen position.

The payload for this message is an object composed of one or more of the following:

| Key             | Type                | Default              | Description                   |
|-----------------|---------------------|----------------------|-------------------------------|
| `left`          | Number, String      | 10                   | The left offset of the widget |
| `top`           | Number, String      | 10                   | The top offset of the widget  |
| `width`         | Number, String      | "33%"                | The width of the widget       |
| `height`        | Number, String      | "100%"               | The height of the widget      |

These values can be scalar Numbers, negative numbers for right / bottom alignment (e.g. `{left: -10}` means "align to right edge minus 10 pixels"), "center", "middle" or any other value accepted by the [box-sizing module](https://github.com/hash-bang/box-sizing). See its documentation for the full range of parameters it will accept.



**METHOD: statsRegister(...mods)**

Request the registration of the given modules from Conkie-Stats. This message can accept ether an array of modules or each module as a separate argument.


**METHOD: statsSettings(settingsObject)**

Set the Conkie-Stats settings object. This usually tweaks the behaviour of various modules to do things like ignoring specific network adapter or limiting the number of returned processes. See the Conkie-Stats module for valid settings.



Detailed Theme loading process
------------------------------
At the moment a number of workarounds are in place to fix up various weird Electron issues (such as loading inline CSS).

The theme file gets read into memory then re-written on the fly to read each external JS / CSS asset and insert it into the file as inline content. In *most* cases this should be sufficient but it is a pretty horrible kludge. This is because Electron apps straddle the boundary between desktop apps and web pages where operations like loading external CSS is still buggy. Please [get in touch](https://github.com/hash-bang/Conkie/issues) with feedback if the solution I've implemented is needlessly insane but I honestly couldn't find a decent method of loading CSS from NPM modules without using a full WebPack stack.


Theme options
-------------
Theme options can be specified in three ways:

1. Call via internal IPC function - See the [theme API reference](#theme-api-reference). These override any user specification in 3.
2. Options can be specified as meta tags within the themes main HTML file. All options should be prefixed with `conkie-` and should be in [kebab-case](https://en.wikipedia.org/wiki/Letter_case#Special_case_styles). e.g. `<meta name="conkie-window-type" content="desktop"/>` specifies that the window should have the type `desktop` (note that `conkie-window-type` is the HTML meta tag equivalent to `windowType` internally)
3. Options can be specified on the command line via `-o option=value` syntax (e.g. `-o windowType=desktop`). See the command line reference for exact syntax.


The full list of options are:

| Property             | Default    | Pre-show only | Description                                                    |
|----------------------|------------|:-------------:|----------------------------------------------------------------|
| `height`             | `1000`     |               | The initial height of the window                               |
| `title`              | `"Conkie"` |               | The initial window title                                       |
| `transparent`        | `true`     | yes           | Whether the window should render with a transparent background |
| `width`              | `200`      |               | The initial width of the window                                |
| `windowType`         | `desktop`  | yes           | What kind of window to display. [Possible values listed in the Electron project](https://github.com/electron/electron/blob/master/docs/api/browser-window.md) |
| `x`                  | `10`       |               | The initial X offset of the window                             |
| `y`                  | `10`       |               | The initial Y offset of the window                             |

**NOTE:** Due to the way Window creation is handled in Electron, certain options are only available *before* the window is actually created - i.e. cannot be scripted. These are indicated where `Pre-show only` is `yes` in the above table. The overall intention is as Electron matures these options will also be changeable but for the moment the only way a theme can override them is to specify them as meta options.


TODO
====

* **Mac compatibility** - Not being a Mac user I cant really help here until I manage to track a Mac user down. This applies equally to the Conkie-Stats package where system stats need to be gathered in a cross-platform way.
* **Windows compatibility** - As with Mac compatibility, this should be possible given enough time and inclination. If anyone wishes to volunteer their time to help I would be grateful.

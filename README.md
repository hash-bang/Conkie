Conkie
======
NodeJS + Electron desktop widgets.

This project is designed to replace the seminal [Conky project](https://github.com/brndnmtthws/conky) by Brenden Matthews with a Browser based desktop widget.

Conkie relies on a few things to gather system statistics. The upstream repo [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) details these. Basic install info is provided below.

![Fullscreen Widget Setup](docs/img/full.jpg)


**ARE YOU A DESIGNER?**

Please get in touch. I could really do with a bit of design help with perfecting this project.

I'm happy to help anyone who has an existing Conky theme that needs to be converted over to Conkie. Please [contact me](mailto:matt@mfdc.biz).


Installing
==========

	# Install Node + NPM - see https://nodejs.org/en/download

	# Install all Conkie's external statistics gathering tools
	sudo apt-get install bwm-ng lm-sensors iotop

	# Install Conkie itself
	npm install -g conkie


Run Conkie as a background process with:

	conkie -b


Use `--help` for other command line help.


Themes
=======
Conkie themes are a single HTML file which links to other required assets. You can override the default theme file by specifying `--theme <path to file>`.

To create a Conkie theme simply design your webpage as you require and make a call to `require('electron').ipcRenderer.on('updateStats', ...)` to gather system statistics. Some examples are provided in the [themes](./themes) folder using AngularJS.

**Tips:**

* To keep NPM happy, all dependencies should be NPM modules themselves. For example if you require Bootstrap use the NPM version of Bootstrap and load via `var bootstrap = require('bootstrap')` somewhere in your themes JavaScript files.
* A lot of weird kludges and fixes exist to try and load and rewrite your widgets contents inline. See the bottom of this README for the nasty internal details. Should Conkie be screwing up your theme try using lots of verbosity (e.g. `-vvvv`) to see what its doing. If its still acting strange please get in touch.


Theme API Reference
-------------------
The following objects are provided as callbacks within the internal IPC `updateState` listener.

All system information is provided via the [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) NPM module. See its documentation for a list of modules and data feeds it supports.

**Simple example**

The following code within a themes JavaScript will register with the main Conkie process, request `cpu` and `memory` modules be loaded and then listen for data feeds.

	require('electron').ipcRenderer

		// Listen to stats updates
		.on('updateStats', function(e, data) {
			// data now has `system`, `ram`, `net` etc. subkeys
			// Do something with this data
		})

		// Request statistics feeds
		.send('statsRegister', ['cpu', 'memory'])

		// Setup any stats options
		.send('statsSettings', {})

		// Setup the window position
		.send('setPosition', {left: 10, top: 10, width: 200, height: 100%'})


**EVENT: updateStats(event, stats)**

Receive a stats object from the [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) module. The available data depends on what modules were registered using the `registerStats()` message.


**METHOD: setPosition(obj)**

Set the position of the widget on the screen.

The payload for this message is an object composed of one or more of the following:

| Key             | Type                | Default              | Description                   |
|-----------------|---------------------|----------------------|-------------------------------|
| `left`          | Number, String      | 10                   | The left offset of the widget |
| `top`           | Number, String      | 10                   | The top offset of the widget  |
| `width`         | Number, String      | "33%"                | The width of the widget       |
| `height`        | Number, String      | "100%"               | The height of the widget      |

These values can be straight Numbers, negative numbers for right / bottom alignment (e.g. `{left: -10}` => align to right edge minus 10 pixels), "center", "middle" or any other value accepted by the [box-sizing](https://github.com/hash-bang/box-sizing) NPM utility module. See its documentation for the full range of parameters it will accept.



**METHOD: statsRegister(...mods)**

Request the registration of the given modules from Conkie-Stats. This message can accept an array of modules or each module as a separate argument.


**METHOD: statsSettings(settingsObject)**

Set the Conkie-Stats settings object. This usually tweaks the behaviour of various modules to do things like ignoring specific network adapter or limiting the number of returned processes. See the Conkie-Stats module for valid settings.



Detailed Theme loading process
------------------------------
At the moment a fair amount of workarounds are in place to fix up various weird Electron issues (such as loading inline CSS).

The theme file gets read into memory then re-written on the fly to read each external JS / CSS asset and insert it into the file as inline content. In *most* cases this should be sufficient but it is a pretty horrible kludge. This is because Electron apps straddle the boundary between desktop apps and web pages where stuff like loading external CSS is still a bit iffy. Please get in touch with feedback if the solution I've implemented is needlessly insane but I honestly couldn't find a decent method of loading CSS from NPM modules.


TODO
====

* **Low power mode** - Conky has a feature where the refresh rate of the widget can be adjusted if running off battery. Adding this could cut down on CPU usage when we need to preserve battery life.
* **Loading themes via NPM module** - It should be possible to load themes by direct path *or* via NPM module name - e.g. `conkie -t conkie-theme-fantastico`
* **Mac compatibility** - Not being a Mac user I cant really help here until I manage to track one down. This applies equally to the Conkie-Stats package where we need to gather system stats in a decently cross-platform way.
* **Windows compatibility** - Like Mac compatibility this should be possible given enough time and inclination. If anyone wishes to volunteer their time I would be grateful.

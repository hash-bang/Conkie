Conkie
======
NodeJS + Electron desktop widgets.

This project is designed to replace the seminal [Conky project](https://github.com/brndnmtthws/conky) by Brenden Matthews with a Browser based desktop widget.

Conkie relies on a few things to gather system statistics. The upstream repo [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) details these. Basic install info is provided below.


**ARE YOU A DESIGNER?**

Please get in touch. I could really do with a bit of design help with perfecting this project.


Installing
==========

	# Install all Conkie's external statistics gathering tools
	sudo apt-get install bwm-ng lm-sensors iotop

	# Install Conkie itself
	npm install -g conkie


Run with:

	conkie


Use `--help` for other command line help.


Themes
=======
Conkie themes are a single HTML file which links to other required assets. You can override the default by specifying `--theme <path to file>`.

To create a Conkie theme simply design your webpage as you require and make a call to `require('electron').ipcRenderer.on('updateStats', ...)` to gather system statistics. Some examples are provided in the [themes](./themes) folder using AngularJS.

Tips:

* To keep NPM happy all dependencies should be NPM modules themselves. For example if you require Bootstrap use `var bootstrap = require('bootstrap')` somewhere in your themes JavaScript.
* A lot of weird and wonderful kludges and fixes exist to try and load your widgets contents inline. See the bottom of this README for the nasty internal details.


Theme API Reference
-------------------
The following objects are provided as callbacks within the internal IPC `updateState` listener.

All statistics are provided via the [Conkie-Stats](https://github.com/hash-bang/Conkie-Stats) module. See its API for a list of modules and data feeds it supports.

e.g.

	require('electron').ipcRenderer

		// Listen to stats updates
		.on('updateStats', function(e, data) {
			// data now has `system`, `ram`, `net` etc. subkeys
			// Do something with this data
		})

		// Request statistics feeds
		.send('registerStats', ['cpu', 'memory'])


Detailed Theme loading process
------------------------------
At the moment a fair amount of workarounds are in place to fix up various weird Electron issues (such as loading inline CSS).

The theme file gets read into memory then re-written on the fly to read each external JS / CSS asset and insert it into the file as inline content. In *most* cases this should be sufficient but it is a pretty horrible work around. This is because Electron apps straddle the boundary between desktop apps and web pages where stuff like loading external CSS is still a bit iffy. Please get in touch with feedback if the solution I've implemented is needlessly insane but I honestly couldn't find a decent method of loading CSS from NPM modules.

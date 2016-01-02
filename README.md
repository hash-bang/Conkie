Conkie
======
NodeJS + Electron desktop widgets.

This project is designed to replace the venerable [Conky project](https://github.com/brndnmtthws/conky) by Brenden Matthews with a Browser based widget library.


Installing
==========

	sudo apt-get install bwm-ng lm-sensors iotop


Cross platform dev
==================
Conkie relies on a few things to gather system statistics:

* `ifconfig` / `iwconfig` - Base network interface libraries
* `bwm-ng` - Network bandwidth monitoring
* `lm-sensors` - The `sensors` binary provides information about various system temperatures
* `iotop` - Disk usage statistics

If you know a way to provide cross-platform support for these modules please either get in touch or submit a pull-request.



Theme API Reference
===================
The following objects are provided as callbacks within the internal IPC `updateState` listner.

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

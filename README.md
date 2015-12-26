Conker
======
NodeJS + Electron desktop widgets.

This project is designed to replace the venerable [Conky project](https://github.com/brndnmtthws/conky) by Brenden Matthews with a Browser based widget library.


Theme API Reference
===================
The following objects are provided as callbacks within the internal IPC `updateState` listner.

e.g.

	require('electron').ipcRenderer
		.on('updateState', function(e, data) {
			// data now has `system`, `ram`, `net` etc. subkeys
			// Do something with this data
		});


`net`
-----
An collection (array of objects) of all active network connections.

Each array item should have the following layout:

```
	{
		name: 'eth0',
		ip_address: '10.0.1.3',
		mac_address: '56:e5:f9:e4:38:1d',
		type: 'Wired' // or 'Wireless'
	}
```


`ram`
-----
The RAM object is made up of several values:

* `ram.free` - The amount of free system RAM as a long unformatted integer
* `ram.used` - The amount of used system RAM as a long unformatted integer
* `ram.total` - The total amount of system RAM as a long unformatted integer


`system`
--------
The system object is made up of several values:

* `system.cpuUsage` - Integer representing the CPU usage
* `system.hostname` - The hostname of the system e.g. `MyLaptop` / `localhost`
* `system.load` - A three part array listing the 1, 5 and 15 minute load readings as floats
* `system.platform` - Node compatible short platform name
* `system.uptime` - The system uptime in seconds

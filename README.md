Conker
======
NodeJS + Electron desktop widgets.

This project is designed to replace the venerable [Conky project](https://github.com/brndnmtthws/conky) by Brenden Matthews with a Browser based widget library.


Installing
==========

	sudo apt-get install bwm-ng


Cross platform dev
==================
Conker relies on a few things to get going:

* `ifconfig` / `iwconfig` - Base network interface libraries
* `bwm-ng` - Network bandwidth monitoring


If you know a way to provide cross-platform support for these modules please either get in touch or submit a pull-request.



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

Most network interfaces are populated via `ipconfig` but wireless devices have their information merged with `iwconfig`.

The result should resemble the following:

```
	[
		{
			type: 'ethernet',
			interface: 'lo',
			link: 'local',
			ipv6_address: '::1/128',
			ipv4_address: '127.0.0.1',
			ipv4_subnet_mask: '255.0.0.0',
			up: true,
			running: true,
			loopback: true,
			downSpeed: 0,
			upSpeed: 0,
		},
		{
			type: 'wireless',
			interface: 'wlp3s0',
			link: 'ethernet',
			address: '66:66:66:66:66:66',
			ipv6_address: '6666::6666:6666:6666:6666/64',
			ipv4_address: '192.168.1.1',
			ipv4_broadcast: '192.168.1.255',
			ipv4_subnet_mask: '255.255.255.0',
			up: true,
			broadcast: true,
			running: true,
			multicast: true,
			access_point: '66:66:66:66:66:67',
			frequency: 2.462,
			ieee: '802.11abgn',
			mode: 'managed',
			quality: 70,
			ssid: 'My WiFi point',
			downSpeed: 0,
			upSpeed: 0,
		}
	]
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

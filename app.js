var _ = require('lodash');
var async = require('async-chainable');
var asyncExec = require('async-chainable-exec');
var bwmNg = require('bwm-ng');
var childProcess = require('child_process');
var cpuUsage = require('cpu-usage');
var ejs = require('ejs');
var electron = require('electron');
var fs = require('fs');
var fspath = require('path');
var os = require('os');
var temp = require('temp').track();
var wirelessTools = require('wireless-tools');

var settings = {
	hasWifi: true, // FIXME: This should be auto-detected on each cycle rather than determined at the start
	topProcessCount: 5,
};

// Global objects {{{
var app;
var win;
// }}}

// Process command line args {{{
var program = require('commander');

program
	.version(require('./package.json').version)
	.option('-d, --debug', 'Enter debug mode. Show as window and enable dev-tools')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.option('-t, --theme [file]', 'Specify main theme HTML file', __dirname + '/themes/mc-sidebar/index.html')
	.option('--no-color', 'Disable colors')
	.parse(process.env.CONKER_ARGS ? JSON.parse(process.env.CONKER_ARGS) : '')
// }}}

// Storage for dynamically updated values {{{
var cpuUsage;
var ifSpeeds = {};
// }}}

// Data update cycle {{{
function updateCycle(finish) {
	// Base config structure {{{
	// NOTE: If this gets updated remember to also update the main README.md API reference
	var data = {
		system: {
			cpuUsage, cpuUsage, // Value gets updated via cpuUsage NPM module
			hostname: os.hostname(),
			load: os.loadavg(),
			platform: os.platform(),
			uptime: os.uptime(),
			temperature: {},
			processes: {},
		},
		io: {
			totalWrite: undefined,
			totalRead: undefined,
		},
		ram: {
			free: os.freemem(),
			total: os.totalmem(),
			used: null, // Calculated later
		},
		net: [],
	};
	// }}}

	// Post setting calculations {{{
	data.ram.used = data.ram.total - data.ram.free;
	// }}}

	async()
		.set('iwconfig', [])
		.parallel([
			// .dropbox {{{
			function(next) {
				async()
					.use(asyncExec)
					.exec('dropbox', ['dropbox', 'status'])
					.then(function(next) {
						data.dropbox = this.dropbox;
						next();
					})
					.end(next);
			},
			// }}}
			// .net {{{
			function(next) {
				wirelessTools.ifconfig.status(function(err, ifaces) {
					if (err) return next(err);
					data.net = ifaces;
					next();
				});
			},
			// }}}
			// Wlan adapers {{{
			function(next) {
				if (!settings.hasWifi) return next();
				var self = this;
				wirelessTools.iwconfig.status(function(err, ifaces) {
					self.iwconfig = ifaces;
					next();
				});
			},
			// }}}
			// Network bandwidth {{{
			function(next) {
				bwmNg.check(function(iface, bytesDown, bytesUp) {
					ifSpeeds[iface] = {
						downSpeed: bytesDown,
						upSpeed: bytesUp,
					};
				});
				next();
			},
			// }}}
			// .system.temperature {{{
			function(next) {
				var tempRe = /\+([^°]*)/g;
				childProcess.exec('sensors', function(err, stdout, stderr) {
					if (err) return next();
					stdout.toString().split('\n').forEach(function(line) {
						var temps = line.match(tempRe);
						if (line.split(':')[0].toUpperCase().indexOf('PHYSICAL') != -1) data.system.temperature.main = parseFloat(temps);
						if (line.split(':')[0].toUpperCase().indexOf('CORE ') != -1) {
							if (!data.system.temperature.cores) data.system.temperature.cores = [];
							data.system.temperature.cores.push(parseFloat(temps));
						}
					})
					next();
				});
			},
			// }}}
			// .system.processes {{{
			// Output from `top` {{{
			function(next) {
				var modes = [
					{
						'id': 'topCpu',
						'exec': [
							'top',
							'-Sb',
							'-n1',
							'-o%CPU',
						],
					},
					{
						'id': 'topRam',
						'exec': [
							'top',
							'-Sb',
							'-n1',
							'-o%MEM',
						],
					},
				];

				async()
					.forEach(modes, function(next, mode) {

						async()
							.use(asyncExec)
							.exec(mode.id, mode.exec)
							.then(function(next) {
								var topSlicer = /^\s*([0-9]+)\s+(.+?)\s+([0-9\-]+)\s+([0-9\-]+)\s+([0-9]+)\s+([0-9]+)\s+([0-9]+)\s+(.)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.:]+)\s+(.+)\s*$/;
								data.system.processes[mode.id] = _(this[mode.id])
									.map(function(line) { return line.split('\n') })
									.flatten()
									.slice(7, 7 + settings.topProcessCount)
									.map(function(line) {
										var bits = topSlicer.exec(line);
										if (!bits) return null;
										return {
											pid: bits[1],
											// user: bits[2],
											priority: bits[3],
											nice: bits[4],
											// virtual: bits[5],
											// res: bits[6],
											// shr: bits[7],
											mode: bits[8],
											cpuPercent: bits[9],
											ramPercent: bits[10],
											cpuTime: bits[11],
											name: bits[12],
										};
									})
									.value();
								next();
							})
							.end(next);
					})
					.end(next);
			},
			// }}}
			// Output from `iotop` {{{
			function(next) {
				async()
					.use(asyncExec)
					.exec('iotop', [
						'sudo',
						'iotop',
						'-b',
						'-n1',
						'-o',
						'-P',
						'-k',
					])
					.then(function(next) {
						var iotopSlicer = /^\s*([0-9]+)\s+(.+?)\s+(.+?)\s+([0-9\.]+) K\/s\s+([0-9\.]+) K\/s\s+([0-9\.]+) %\s+([0-9\.]+) %\s+(.*)$/;
						data.system.processes.topIo = _(this.iotop)
							.map(function(line) { return line.split('\n') })
							.tap(function(lines) {
								// Process first line of output which gives us the total system I/O {{{
								var bits = /Total DISK READ\s+:\s+([0-9\.]+) K\/s\s+\|\s+Total DISK WRITE\s+:\s+([0-9\.]+) K\/s/.exec(lines[0]);
								if (bits) {
									data.io.totalRead = bits[1];
									data.io.totalWrite = bits[2];
								}
								// }}}
							})
							.flatten()
							.slice(3, 3 + settings.topProcessCount)
							.map(function(line) {
								var bits = iotopSlicer.exec(line);
								if (!bits) return null;
								return {
									pid: bits[1],
									// priority: bits[2],
									// user: bits[3],
									ioRead: bits[4],
									ioWrite: bits[5],
									// swapPercent: bits[6],
									// ioPercent: bits[7],
									name: bits[8],
								};
							})
							.value();
						next();
					})
					.end(next);
			},
			// }}}
			// }}}
		])
		.parallel([
			// Post processing of data {{{
			// Merge .net + Wlan adapter info {{{
			function(next) {
				async()
					.set('iwconfig', this.iwconfig)
					.forEach(data.net, function(next, adapter) {
						// Match against known WLAN adapters to merge wireless info {{{
						var wlan = _.find(this.iwconfig, {interface: adapter.interface });
						if (wlan) { // Matching wlan adapter
							adapter.type = 'wireless';
							_.merge(adapter, wlan);
						} else { // Boring ethernet
							adapter.type = 'ethernet';
						}
						// }}}
						// Match against ifSpeeds to provide bandwidth speeds {{{
						if (ifSpeeds[adapter.interface]) {
							adapter.downSpeed = ifSpeeds[adapter.interface].downSpeed;
							adapter.upSpeed = ifSpeeds[adapter.interface].upSpeed;
						}
						// }}}
						next();
					})
					.end(next);
			},
			// }}}
			// }}}
		])
		.then(function(next) {
			if (program.verbose > 2) console.log('STATS', JSON.stringify(data, null, '\t'));
			win.webContents.send('updateState', data);
			next();
		})
		.end(finish);
}

function updateRepeater() {
	// Start main cycle update process {{{
	var updateCycleFunc = function() {
		updateCycle(function(err) {
			if (err) {
				console.log('Update cycle ERROR', err);
			} else {
				setTimeout(updateCycleFunc, 1000);
			}
		});
	};
	setTimeout(updateCycleFunc, 1000); // Initial kickoff
	// }}}

	// Start supplemental processes {{{
	cpuUsage(1000, function(load) {
		cpuUsage = load;
	});
	// }}}
}
// }}}

async()
	.then(function(next) {
		// Sanity checks {{{
		next();
		// }}}
	})
	.then('theme', function(next) {
		// Read in theme file {{{
		fs.readFile(program.theme, 'utf8', next);
		// }}}
	})
	.then('tempFile', function(next) {
		// Crate temp file (which is the EJS compiled template) {{{
		var tempFile = temp.path({suffix: '.html'}, next);
		fs.writeFile(tempFile, ejs.render(this.theme, {
			debugMode: true,
			root: 'file://' + __dirname,
			themeRoot: 'file://' + fspath.dirname(program.theme),
		}), function(err) {
			if (err) return next(err);
			next(null, tempFile);
		});
		// }}}
	})
	.then(function(next) {
		// Setup browser app {{{
		app = electron.app
			.on('window-all-closed', function() {
				if (process.platform != 'darwin') app.quit(); // Kill everything if we're on Darwin
			})
			.on('ready', function() {
				console.log('READY!');
			})
			.on('error', next);
		next();
		// }}}
	})
	.then(function(next) {
		// Setup page {{{
		var mainScreen = electron.screen.getPrimaryDisplay();

		// Create the browser window.
		win = new electron.BrowserWindow(
			program.debug
				? {
					width: 1000,
					height: 1000,
					frame: true,
					title: 'Conker',
					show: false,
				}
				: {
					width: 240,
					height: 1000,
					frame: false,
					resizable: false,
					skipTaskbar: true,
					title: 'Conker',
					type: 'desktop',
					show: false,
					transparent: true,
					x: mainScreen.size.width - 243,
					y: 30,
					center: false,
				}
		);

		win.on('page-title-updated', function(e) {
			// Prevent title changes so we can always find the window
			e.preventDefault();
		})

		win.loadURL('file://' + this.tempFile);

		win.webContents.on('dom-ready', function() {
			if (program.debug) {
				win.show();
				win.webContents.openDevTools();
			} else {
				win.showInactive();
			}

			// Kick off repeat cycle
			updateRepeater();
			return next();
		});
		// }}}
	})
	.then(function(next) {
		// Apply X window styles {{{
		if (program.debug) return next();
		async()
			.use(asyncExec)
			.execDefaults({
				log: function(cmd) { console.log('[RUN]', cmd.cmd + ' ' + cmd.params.join(' ')) },
				out: function(line) { console.log('[GOT]', line) },
			})
			.exec([
				'wmctrl', 
				'-F',
				'-r',
				'Conker',
				'-b',
				'add,below',
				'-vvv',
			])
			.exec([
				'wmctrl', 
				'-F',
				'-r',
				'Conker',
				'-b',
				'add,sticky',
				'-vvv',
			])
			.end(next);
		// }}}
	})
	.then(function(next) {
		// Everything done - wait for window to terminate {{{
		win.on('closed', function() {
			next();
		});
		// }}}
	})
	.end(function(err) {
		// Clean up references {{{
		if (app) app.quit();
		win = null; // Remove reference and probably terminate the program
		// }}}

		// Handle exit state {{{
		if (err) {
			console.log('ERROR', err.toString());
			process.exit(1);
		} else {
			console.log('Normal exit');
			process.exit(0);
		}
		// }}}
	});

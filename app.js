var async = require('async-chainable');
var asyncExec = require('async-chainable-exec');
var childProcess = require('child_process');
var electron = require('electron');
var fs = require('fs');
var os = require('os');

var win;

var program = {
	debug: true,
};

// Global functions {{{
function restyleWindow(finish) {
	console.log('PID', process.pid);
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
		.end(finish);
}

function updateCycle(finish) {
	// Base config structure {{{
	var data = {
		system: {
			hostname: os.hostname(),
			load: os.loadavg(),
			platform: os.platform(),
			uptime: os.uptime(),
		},
		ram: {
			free: os.freemem(),
			total: os.totalmem(),
			used: null, // Calculated later
		},
		net: os.networkInterfaces(),
	};
	// }}}

	// Post setting calculations {{{
	data.ram.used = data.ram.total - data.ram.free;
	// }}}

	async()
		.parallel([
			/*function(next) {
				// system.uptime {{{
				fs.readFile('/proc/uptime', function(err, contents) {
					if (err) return next(err);
					var bits = /^([0-9\.]+) /.exec(contents.toString());
					if (!bits) return next('Invalid proc uptime format');
					data.system.uptime = parseFloat(bits[1]) * 1000;
					next();
				});
				// }}}
			},
			function(next) {
				// system.load {{{
				data.system.load = os.loadavg();
				next();
				// }}}
			}, */
		])
		.then(function(next) {
			console.log('DUMP UPDATE', data);
			next();
		})
		.end(finish);
}

function updateRepeater() {
	updateCycle(function(err) {
		if (err) {
			console.log('Update cycle ERROR', err);
		} else {
			setTimeout(updateRepeater, 1000);
		}
	});
}
// }}}

var app = electron.app
	.on('window-all-closed', function() {
		if (process.platform != 'darwin') app.quit(); // Kill everything if we're on Darwin
	})
	.on('ready', function() {
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
					width: 250,
					height: 1000,
					frame: false,
					resizable: false,
					skipTaskbar: true,
					title: 'Conker',
					type: 'desktop',
					show: false,
					transparent: true,
					x: mainScreen.size.width - 250,
					y: 50,
					center: false,
				}
		);

		win
			.on('page-title-updated', function(e) {
				// Prevent title changes so we can always find the window
				e.preventDefault();
			})
			.on('closed', function() {
				win = null; // Remove reference and probably terminate the program
			});

		win.loadURL('file://' + __dirname + '/themes/mc-sidebar/index.html');

		win.webContents.on('dom-ready', function() {
			win.webContents.insertCSS(fs.readFileSync(__dirname + '/bower_components/font-awesome/css/font-awesome.min.css', 'utf8'));
			win.webContents.insertCSS(fs.readFileSync(__dirname + '/bower_components/bootstrap/dist/css/bootstrap.min.css', 'utf8'));
			win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/bower_components/angular/angular.min.js', 'utf8'));

			win.webContents.insertCSS(fs.readFileSync(__dirname + '/themes/mc-sidebar/style.css', 'utf8'));
			win.webContents.executeJavaScript(fs.readFileSync(__dirname + '/themes/mc-sidebar/javascript.js', 'utf8'));

			if (program.debug) {
				win.show();
				win.webContents.openDevTools();
			} else {
				win.showInactive();
			}

			restyleWindow();
			updateRepeater();
		});

		console.log(win);
	});

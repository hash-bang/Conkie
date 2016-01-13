var _ = require('lodash');
var async = require('async-chainable');
var asyncExec = require('async-chainable-exec');
var boxSizing = require('box-sizing');
var colors = require('colors');
var conkieStats = require('conkie-stats');
var ejs = require('ejs');
var electron = require('electron');
var electronDetach = require('electron-detach');
var fs = require('fs');
var fspath = require('path');
var moduleFinder = require('module-finder');
var os = require('os');
var temp = require('temp').track();
var util = require('util');

// Global objects {{{
var app;
var win;
var onBattery; // Whether we are running in low-refresh mode
var tempFile; // File compiled at boot containing main HTML body
// }}}

// Global processes {{{
// Exposed functions designed to work as async callbacks

/**
* Load the theme
* @param function finish The callback to invoke when done
* This process breaks down as follows:
* 1. Read in the main HTML file for the theme
* 2. Figure out all the linked JS / CSS assets
* 3. Read the contents of all assets discovered
* 4. Insert contents inline into HTML stream
* 5. Write a file with all the above
*/
function loadTheme(finish) {
	async()
		.then('content', function(next) {
			// Read in theme file {{{
			fs.readFile(program.theme, 'utf8', next);
			// }}}
		})
		.then('content', function(next) {
			// Scoop all CSS / JS asset links {{{
			// Prepare Async process loader {{{
			var baseContent = this.content;
			var findModules = []; // List of modules we will be needing (fed into module-finder query)
			var modules; // Result of module search
			var scooper = async()
				.then(function(next) {
					if (program.verbose > 2) console.log(colors.blue('[Theme/Preparser]'), 'Find modules', colors.cyan(findModules.map(function(m) { return colors.cyan(m) }).join(', ')));
					moduleFinder({
						local: true,
						global: true,
						cwd: __dirname,
						filter: {
							name: {'$in': findModules}
						},
					}).then(function(res) { modules = res; return next() }, next);
				});
			// }}}

			// Precompile various RegExps {{{
			var linkExtract = /<link.+?href="<%=paths.modules%>\/(.+?)\/(.+?)"/;
			var scriptExtract = /<script.+?src="<%=paths.modules%>\/(.+?)\/(.+?)"/;
			// }}}
			baseContent = baseContent
				// Inline re-write all CSS assets {{{
				.replace(/<link.+?href="<%=paths.modules%>\/.+?".*?>/g, function(block) {
					var bits = linkExtract.exec(block);
					var module = bits[1];
					var cssFile = bits[2];
					var marker = '<!-- CSS FOR [' + module + '/' + cssFile + '] -->';

					findModules.push(module);
					scooper.defer('css-' + cssFile, function(next) {
						var mod = modules.find(function(m) { return m.pkg.name == module });
						if (!mod) return next('Cannot find module "' + module + '" required by CSS pre-load of "' + cssFile + '"');

						var cssPath = fspath.join(fspath.dirname(mod.path), cssFile);

						if (program.verbose > 2) console.log(colors.blue('[Theme/Preparser]'), 'Read CSS asset', colors.cyan(cssPath));
						fs.readFile(cssPath, 'utf8', function(err, content) {
							if (err) return finish(err);
							baseContent = baseContent.replace(marker, marker + '\n' + '<style>' + content + '</style>');
							next();
						});
					});
					return marker;
				})
				// }}}
				// Inline re-write all JS assets {{{
				.replace(/<script.+src="<%=paths.modules%>\/.+?".*?>/g, function(block) {
					var bits = scriptExtract.exec(block);
					var module = bits[1];
					var jsFile = bits[2];
					var marker = '<!-- JS FOR [' + module + '/' + jsFile + '] -->';

					findModules.push(module);
					scooper.defer('js-' + jsFile, function(next) {
						var mod = modules.find(function(m) { return m.pkg.name == module });
						if (!mod) return next('Cannot find module "' + module + '" required by JS pre-load of "' + jsFile + '"');

						var jsPath = fspath.join(fspath.dirname(mod.path), jsFile);

						if (program.verbose > 2) console.log(colors.blue('[Theme/Preparser]'), 'Read JS asset', colors.cyan(jsPath));
						fs.readFile(jsPath, 'utf8', function(err, content) {
							if (err) return finish(err);
							baseContent = baseContent.replace(marker, marker + '\n' + '<script>' + content + '</script>');
							next();
						});
					});
					return marker;
				})
				// }}}

			// Kick all the defered processes off {{{
			scooper
				.await()
				.end(function(err) {
					next(err, baseContent);
				});
			// }}}
			// }}}
		})
		.then(function(next) {
			// Create temp file (which is the EJS compiled template) {{{
			if (tempFile) return next(); // tempFile already setup
			tempFile = temp.path({suffix: '.html'});
			if (program.verbose > 1) console.log(colors.blue('[Conkie]'), 'Setup temp file', colors.cyan(tempFile));
			fs.writeFile(tempFile, ejs.render(this.content, {
				debugMode: program.debug,
				paths: {
					root: 'file://' + __dirname,
					theme: 'file://' + fspath.dirname(program.theme),
					modules: 'file://' + __dirname + '/node_modules',
				},
			}), function(err) {
				if (err) return next(err);
				next(null, tempFile);
			});
			// }}}
		})
		.end(finish);
}
// }}}

// Process command line args {{{
var program = require('commander');

program
	.version(require('./package.json').version)
	.option('-d, --debug', 'Enter debug mode. Show as window and enable dev-tools')
	.option('-v, --verbose', 'Be verbose. Specify multiple times for increasing verbosity', function(i, v) { return v + 1 }, 0)
	.option('-t, --theme [file]', 'Specify main theme HTML file', __dirname + '/themes/default/index.html')
	.option('-b, --background', 'Detach from parent (prevents quitting when parent process dies)')
	.option('--refresh [ms]', 'Time in MS to refresh all system statistics (when on power, default = 1s)', 1000)
	.option('--refresh-battery [ms]', 'Time in MS to refresh system stats (when on battery, default = 10s)', 10000)
	.option('--debug-stats', 'Show stats object being transmitted to front-end')
	.option('--watch', 'Watch the theme directory and reload on any changes')
	.option('--no-color', 'Disable colors')
	.parse(process.env.CONKIE_ARGS ? JSON.parse(process.env.CONKIE_ARGS) : '')
// }}}

// Storage for dynamically updated values {{{
var cpuUsage;
var ifSpeeds = {};
// }}}

async()
	.then(function(next) {
		//  checks {{{
		next();
		// }}}
	})
	.then(function(next) {
		// Setup browser app {{{
		app = electron.app
			.once('window-all-closed', function() {
				if (program.verbose > 2) console.log(colors.blue('[Conkie]'), 'All windows closed');
				if (process.platform != 'darwin') app.quit(); // Kill everything if we're on Darwin
			})
			.once('ready', function() {
				if (program.verbose > 2) console.log(colors.blue('[Conkie]'), 'Electron app ready');
				next();
			})
			.once('error', next);
		// }}}
	})
	.then(function(next) {
		if (!program.background) return next();
		if (electronDetach({requireCmdlineArg: false})) {
			if (program.verbose) console.log(colors.blue('[Conkie]'), 'Detached from parent');
			next();
		} else {
			process.exit(0);
		}
	})
	.then(loadTheme)
	.then(function(next) {
		// Setup page {{{
		// Create the browser window.
		win = new electron.BrowserWindow(
			program.debug
				? {
					width: 1000,
					height: 1000,
					frame: true,
					title: 'Conkie',
					show: false,
				}
				: {
					width: 200,
					height: 1000,
					frame: false,
					resizable: false,
					skipTaskbar: true,
					title: 'Conkie',
					type: 'desktop',
					show: false,
					transparent: true,
					x: 10,
					y: 10,
					center: false,
				}
		);

		win.on('page-title-updated', function(e) {
			// Prevent title changes so we can always find the window
			e.preventDefault();
		})

		win.loadURL('file://' + tempFile);

		win.webContents.once('dom-ready', function() {
			if (program.debug) {
				win.show();
				win.webContents.openDevTools();
			} else {
				win.showInactive();
			}

			return next();
		});
		// }}}
	})
	.parallel([
		// Listen for messages {{{
		function(next) {
			conkieStats
				.on('error', function(err) {
					console.log(colors.blue('[Stats/Error]'), colors.red('ERR', err));
				})
				.on('update', function(stats) {
					if (program.debugStats) console.log(colors.blue('[Stats]'), JSON.stringify(stats, null, '\t'));
					var batStatus = _.get(stats, 'power[0].status');
					if (!onBattery && batStatus == 'discharging') {
						if (program.verbose > 1) console.log(colors.blue('[Stats]'), 'Detected battery mode - adjusting stats poll to', colors.cyan(program.refreshBattery + 'ms'));
						conkieStats.setPollFreq(program.refreshBattery);
						onBattery = true;
					} else if (onBattery && batStatus != 'discharging') {
						if (program.verbose > 1) console.log(colors.blue('[Stats]'), 'Detected powered mode - adjusting stats poll to', colors.cyan(program.refresh+ 'ms'));
						conkieStats.setPollFreq(program.refresh);
						onBattery = false;
					}
					win.webContents.send('updateStats', stats);
				});

			electron.ipcMain
				.on('statsRegister', function() {
					var mods = _.flatten(Array.prototype.slice.call(arguments).slice(1));
					if (program.debug) console.log(colors.blue('[Stats/Debug]'), 'Register stats modules', mods.map(function(m) { return colors.cyan(m) }).join(', '));
					conkieStats.register(mods);
				});

			electron.ipcMain
				.on('statsSettings', function(e, options) {
					if (program.verbose > 2) console.log(colors.blue('[Stats]'), 'Register stats settings', util.inspect(options, {depth: null, colors: true}));
					conkieStats.settings(options);
				});

			electron.ipcMain
				.on('setPosition', function(e, position) {
					if (program.debug) {
						console.log(colors.blue('[Conkie]'), 'Set window position', colors.red('ignored in debug mode'));
						return;
					}

					if (program.verbose > 2) console.log(colors.blue('[Conkie]'), 'Set window position', util.inspect(position, {depth: null, colors: true}));

					var mainScreen = electron.screen.getPrimaryDisplay();
					var calcPosition = boxSizing(position, {
						left: 10,
						top: 10,
						width: '33%',
						height: '33%',
						maxWidth: mainScreen.size.width,
						maxHeight: mainScreen.size.height,
					});

					if (program.verbose > 3) console.log(colors.blue('[Conkie]'), 'Set window position (actual)', util.inspect(calcPosition, {depth: null, colors: true}));

					if (calcPosition) {
						win.setBounds({
							x: calcPosition.left,
							y: calcPosition.top,
							width: calcPosition.width,
							height: calcPosition.height,
						});
					} else {
						if (program.verbose > 2) console.log(colors.blue('[Conkie/setPosition]'), colors.red('ERROR'), 'Invalid window position object', position);
					}
				});

			if (program.debug) {
				conkieStats.on('debug', function(msg) {
					console.log(colors.blue('[Stats/Debug]'), msg);
				})
			}
			next();
		},
		// }}}
		// Apply X window styles {{{
		function(next) {
			if (program.debug) return next();
			async()
				.use(asyncExec)
				.execDefaults({
					log: function(cmd) { console.log(colors.blue('[Conkie/XSetup]'), cmd.cmd + ' ' + cmd.params.join(' ')) },
					out: function(line) {
						line.split('\n').forEach(function(l) {
							console.log(colors.blue('[Conkie/XSetup]'), colors.grey('>'), l);
						});
					},
				})
				.exec([
					'wmctrl', 
					'-F',
					'-r',
					'Conkie',
					'-b',
					'add,below',
					'-vvv',
				])
				.exec([
					'wmctrl', 
					'-F',
					'-r',
					'Conkie',
					'-b',
					'add,sticky',
					'-vvv',
				])
				.end(next);
		},
		// }}}
		// (Optional) Watch theme directory if `--watch` is specified {{{
		function(next) {
			if (!program.watch) return next();

			var dir = fspath.dirname(program.theme);
			if (program.verbose > 1) console.log(colors.blue('[Conkie/Theme/Watcher]'), 'Watching', colors.cyan(dir));
			fs.watch(dir, {
				persistant: true,
				recursive: true,
			}, function(e, path) {
				if (program.verbose) console.log(colors.blue('[Conkie/Theme/Watcher]'), 'Detected', colors.cyan(e), 'on', colors.cyan(path));
				loadTheme(function(err) {
					if (err) {
						console.log(colors.blue('[Conkie/Theme/Watcher]'), colors.red('ERR'), 'Error while re-loading theme - ' + err.toString());
					} else {
						if (program.verbose) console.log(colors.blue('[Conkie/Theme/Watcher]'), 'Theme reloaded');
						win.webContents.reload();
					}
				});
			});
			next();
		},
		// }}}
	])
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
			console.log(colors.blue('[Conkie]'), colors.red('ERR', err.toString()));
			process.exit(1);
		} else {
			console.log(colors.blue('[Conkie]'), 'Exit');
			process.exit(0);
		}
		// }}}
	});

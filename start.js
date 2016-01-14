#!/usr/bin/env node
/**
* Helper application to bundle up the command line into an Electron application
* This program really just relaunches the electron shell encoding the process.argv structure into the process.env.CONKIE_ARGS as a JSON array
*/

var childProcess = require('child_process');
var electron = require('electron-prebuilt');

// Determine whether to detach from parent if the --background || -b flag is present as an arg
var detach = process.argv.some(function(i) {
	return (
		i == '--background' || // Is the longhand flag
		/^-(?!-).*b.*$/.test(i) // Is contained in a shorthand flag
	);
});

// Change to this directory to keep Electron's require() statements happy
process.chdir(__dirname);

childProcess.spawn(electron, [
	'--enable-transparent-visuals',
	'--disable-gpu',
	__dirname + '/app.js',
], {
	stdio: 'inherit',
	detached: detach,
	env: function() { // Inherit this envrionment but glue CONKIE_ARGS to the object
		var env = process.env;
		env.CONKIE_ARGS = JSON.stringify(process.argv);
		return env;
	}(),
});

if (detach) process.exit(0);

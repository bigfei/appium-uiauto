var system = UIATarget.localTarget().host();
var waitForDataTimeout = 3600;
var curAppiumCmdId = -1;
var user = null;
var settings = null;

var fileExists = function (filename) {
  var params = [];
  params = params.concat(['-f', filename]);
  var res = system.performTaskWithPathArgumentsTimeout("/bin/test", params, 3);
  if (res.exitCode === 0) {
    return true;
  } else {
    return false;
  }
};

var sysExec = function (cmd) {
  var params = [];
  if (user !== null) {
    if (fileExists('/Users/' + user + '/.profile')) {
      params = params.concat(['--rcfile', '/Users/' + user + '/.profile']);
    } else {
      if (fileExists('/Users/' + user + '/.bash_profile')) {
        params = params.concat(['--rcfile', '/Users/' + user + '/.bash_profile']);
      } else {
        if (fileExists('/Users/' + user + '/.bashrc')) {
          params = params.concat(['--rcfile', '/Users/' + user + '/.bashrc']);
        }
      }
    }
  }
  params = params.concat(['-c', cmd]);
  var res = system.performTaskWithPathArgumentsTimeout("/bin/bash",
      params, 3);
  if (res.exitCode !== 0) {
    throw new Error("Failed executing the command " + cmd + " (exit code " + res.exitCode + ")");
  } else {
    var output = res.stdout.trim();
    if (output.length) {
      return output;
    } else {
      throw new Error("Executing " + cmd + " failed since there was no output");
    }
  }
};

user = function () {
  try {
    var ret = sysExec("whoami");
    console.log("Instruments shell user: " + ret);
    return ret;
  } catch (e) {
    console.log("Error getting user: " + e.message);
    return null;
  }
}();

settings = function () {
  var data = {};
  var settingsFile = "/Users/" + user + "/.instruments.conf";

  if (fileExists(settingsFile)) {
    var lines = sysExec("/bin/cat " + settingsFile).split('\n');
    for (var index = 0; index < lines.length; index++) {
      var line = lines[index];
      if (line[0] === '#') continue;
      if (line.indexOf('=') !== -1) {
        var parts = line.split('=');
        if (parts.length !== 2) {
          throw new Error("Error reading " + settingsFile);
        }
        data[parts[0]] = parts[1];
      }
    }
    if (data.length > 0) {
      console.log("Read in settings: ");
    }
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        console.log("  " + key + ": " + data[key]);
      }
    }
    return data;
  }
}();

/* exported isVerbose */
var isVerbose = (typeof settings !== "undefined" && 'verbose' in settings && settings.verbose === 'true');

// figure out where instruments client is (relative to where appium is run)
var clientPath = (function() {
  var possiblePaths = [
    './node_modules/.bin/instruments-client.js',
    './node_modules/appium/node_modules/.bin/instruments-client.js'
  ];
  for(var i=0; i<possiblePaths.length; i++){
    if(fileExists(possiblePaths[i])) {
      return possiblePaths[i];
    }
  }
})();

console.log('Using instrument client with path: ' + clientPath);


var sendResultAndGetNext = function (result) {
  curAppiumCmdId++;
  var args = ['-s', '/tmp/instruments_sock'], res
    , binaryPath = clientPath;
  if (typeof result !== "undefined") {
    args = args.concat(['-r', JSON.stringify(result)]);
  }
  try {
    res = system.performTaskWithPathArgumentsTimeout(binaryPath, args, waitForDataTimeout);
  } catch (e) {
    console.log(e.name + " error getting command " + curAppiumCmdId + ": " + e.message);
    return null;
  }

  if (res.exitCode !== 0) {
    var cmd = binaryPath + " " + args.join(" ");
    console.log("Instruments client (" + cmd + ") exited with " + res.exitCode +
                ", here's stderr:");
    console.log(res.stderr);
    console.log("And stdout:");
    console.log(res.stdout);
    return null;
  }
  return res.stdout;
};

/* exported getFirstCommand */
var getFirstCommand = function () {
  return sendResultAndGetNext();
};

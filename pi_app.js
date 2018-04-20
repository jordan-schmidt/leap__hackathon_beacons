var noble = require('noble');
var Bleacon = require('bleacon');
var KalmanFilter = require('kalmanjs').default;
var socket = require('socket.io-client')('http://172.21.42.86:3000/scanner');
// var socket = require('socket.io-client')('http://192.168.137.1:3000/scanner');

// estimote Telemetry addresses
// var addressesToTrack = {'c22a0e0bbd1d': 'blueberry', 'e176fe263a2d': 'mint', 'f07398a3e067': 'ice'}; //blueberry, mint, ice
// iBeacon uuid, majors, minors
var iBeacon_uuid = 'b9407f30f5f8466eaff925556b57fe6d';
var iBeacon_major = 1234;
var iBeacon_minorToTrack = {41044: 'blueberry', 41480: 'mint', 42399: 'ice'};
// need a way to get an id from the pi itself
var scanner_id = '1234';

// will need one filter per beacon per scanner
var kf = new KalmanFilter({R: 0.1, Q: 3});
var kFilters = {};

function initFilters(minor_list) {
    minor_list.forEach(function(minor) {
        kFilters[minor] = new KalmanFilter({R: 0.1, Q:3});
    });
};

function calculateDistance(rssi, txPower) {
    if (rssi == 0) {
        return -1;
    }

    // for indoor from Kalman library guy
    var n = 2;
    var ratio = rssi/txPower;
    if (ratio < 1.0) {
        return Math.pow(ratio, 10);
    } else {
        // var a = 8302.7748;
        // var b = 0.00001814217;
        // var offset = -8301.7062;
        // var distance = (a)*Math.pow(ratio,b) + offset;
        var distance = Math.pow(10, (rssi-txPower)/(-10*n));
        // var distance = (0.89976)*Math.pow(ratio,7.7095) + 0.111;
        return distance;
    }
};

Bleacon.on('discover', function(peripheral) {
    if (Object.keys(iBeacon_minorToTrack).includes(peripheral.minor.toString())) {
        var kFilter = kFilters[peripheral.minor.toString()];
        var rssi = kFilter.filter(peripheral.rssi);
        var txPower = peripheral.measuredPower;
        var distance = calculateDistance(rssi, txPower);
        console.log('Found Estimote device: ', iBeacon_minorToTrack[peripheral.minor], ' ', rssi, ' ', distance);
        socket.emit('sendMessage', {"beacon_id": peripheral.minor,
                                    "scanner_id": scanner_id,
                                    "rssi": peripheral.rssi,
                                    "time": new Date()});
    }
});

// Used for creating best fit curve
// Bleacon.on('discover', function(peripheral) {
//     var rssi = peripheral.rssi;
//     // var distance = calculateDistance(rssi);
//     console.log(rssi);
// })

socket.on('connect', function(){
    console.log('connected to server');
});

// noble.startScanning(['fe9a'], true);
initFilters(Object.keys(iBeacon_minorToTrack));
Bleacon.startScanning(iBeacon_uuid, iBeacon_major);

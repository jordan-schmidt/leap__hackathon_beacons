// npm package that creates directories
var mkdirp = require('mkdirp');
var fs = require('fs');
var Connection = require('tedious').Connection;
var Request = require('tedious').Request;
var config = require('./config/config.js');

var connect_config = {
    userName: 'beacon',
    password: 'password',
    server: '172.21.42.127',
    options: {
        database: 'leapdb',
        readonlyIntent: false
    }
}; 

var connection = new Connection(connect_config);

connection.on('connect', function(err) {
    if (err) {
        console.log(err);
    } else {
        console.log('Connected');
    }
});

var LogBuilder = function () {};

// converts Date to mm_dd_yyyy String, uses UTC here to get correct date
function dateToString(date) {
    // way to have "default" arguments pre ES6
    date = typeof date !== 'undefined' ? new Date(date) : new Date();
    var dd = date.getUTCDate();
    var mm = date.getUTCMonth()+1;
    var yyyy = date.getUTCFullYear();

    return [(mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd, yyyy].join('_');
};

// converts Date to string 'Date(Year, Month, etc.)' for google charts, no UTC because of timezone
function dateToGoogleChartsString(date) {
    // year month date might be redundant at some point since file is for single day
    date = new Date(date);
    var yyyy = date.getFullYear();
    var mm = date.getMonth();
    var dd = date.getDate();
    var hh = date.getHours();
    var min = date.getMinutes();
    var ss = date.getSeconds();

    return 'Date(' + [yyyy, mm, dd, hh, min, ss].join(', ') + ')';
};

// converts entire JSON object to list of strings that work in a Google Charts DataTable
function JSONToDataTable(json) {
    var tableData = [];
    var history = json['history'];
    var beacon_ids = config.beacon_ids;
    var scanner_ids = config.scanner_ids;

    for (var i = 0; i < history.length; i++) {
        var start = dateToGoogleChartsString(history[i]['start_time']);
        var end = dateToGoogleChartsString(history[i]['end_time']);
        tableData.push(['Room ' + scanner_ids[json['scanner_id']], beacon_ids[history[i]['beacon_id']], start, end]);
    }

    return tableData;
};

function getLatestHistory(json, beacon_id) {
    // grab all scanner history, loop backward to find most recent for specific beacon
    var history = json['history'];
    for (var i = history.length-1; i >= 0; i--) {
        if (history[i]['beacon_id'] == beacon_id) {
            return history[i];
        } 
    }
}

LogBuilder.prototype.getDateLogs = function(date) {
    var self = this;
    var rootDir = './scanner_logs/' + dateToString(date) + '/';
    var dateLogs = [];
    var tableData = [];

    //TODO: similar issue to readFile, just using synchronous for now
    try {
        var files = fs.readdirSync(rootDir);
    } catch(error) {
        // if directory does not exist, return empty tableData list
        return [];
    };
    
    for (var i in files) {
        dateLogs.push(rootDir + files[i]);
        tableData = tableData.concat(this.convertJSONToDataTable(rootDir + files[i]));
    };

    return tableData;
}

LogBuilder.prototype.updateLogs = function(scanner_msg) {
    var self = this;

    var dateString = dateToString();
    var file_name = 'scanner' + scanner_msg['scanner_id'] + '_' + dateString + '.json';
    var file_path = './scanner_logs/' + dateString + '/'

    // TODO: possibly some issue here with async creation of directory, currently just using synchronous version
    mkdirp.sync(file_path, function(err) {
        if (err) console.log(err)
        else console.log('directory created');
    });

    fs.readFile(file_path + file_name, 'utf8', function(err, data) {
        if (err) console.log(err);
        var json = self.buildBeaconHistory(data, scanner_msg);
        fs.writeFile(file_path + file_name, JSON.stringify(json, null, 4), 'utf8', function (err) {
            if (err) console.log(err);
        });
    });
};

// LogBuilder.prototype.updateLogs = function(scanner_msg) {
//     // beacon_major, beacon_minor, timestamp_start, timestamp_start, receiver_id
//     connection.query('SELECT * from stuff', function (err, rows, fields) {
//         if (err) throw err;
      
//         console.log('The solution is: ', rows[0])
//       });
// }

LogBuilder.prototype.buildBeaconHistory = function(data, scanner_msg) {
    // store max time diff (in ms) used to determine if visit is extended or new visit created
    // TODO: need min RSSI or something similar after conversion
    var max_time_diff = 1000*60*1;
    var beacon_id = scanner_msg['beacon_id'];
    var scanner_id = scanner_msg['scanner_id'];
    var msg_timestamp = scanner_msg['time'];

    if (data === undefined) {
        var inital_history = {'beacon_id': beacon_id, 'start_time': msg_timestamp, 'end_time': msg_timestamp};
        var json = {'scanner_id': scanner_id, 'history': [inital_history]};
    } else {
        console.log(data);
        var json = JSON.parse(data);
        var latest_history = getLatestHistory(json, beacon_id);

        if (latest_history === undefined) {
            json.history.push({'beacon_id': beacon_id, 'start_time': msg_timestamp, 'end_time': msg_timestamp})
        } else {
            var time_diff = new Date(msg_timestamp) - new Date(latest_history['end_time']);

            // extend end time if same scanner and within max_time_diff else create new history for same scanner
            // Issue here? What if scanner 1 and 2 both pick up signal? need to check if rssi is high enough, maybe even track avg rssi for history
            if (time_diff <= max_time_diff) {
                latest_history['end_time'] = msg_timestamp;
            } else {
                json.history.push({'beacon_id': beacon_id, 'start_time': msg_timestamp, 'end_time': msg_timestamp})
            }
        }
    }
    return json;
};

LogBuilder.prototype.convertJSONToDataTable = function(file_path) {
    var tableData = [];
    var json = JSON.parse(fs.readFileSync(file_path, 'utf8'));
    return JSONToDataTable(json);
};

module.exports = LogBuilder;
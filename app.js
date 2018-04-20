var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var LogBuilder = require('./logBuilder.js')

var logBuilder = new LogBuilder();

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/schedule', function(req, res) {
    res.sendFile(__dirname + '/schedule.html')
});

app.use(express.static(__dirname + '/public'));

http.listen(3000, function() {
    console.log('listening on *:3000');
});

io.on('connection', function(socket) {
    console.log('a user connected');

    socket.on('sendMessage', function(data){
        // sent by index.html to simulate advertisement from beacon
        logBuilder.updateLogs(data);
    });

    socket.on('requestDataTable', function(date){
        // sent by schedule.html on initial page load
        io.emit('requestDataTable', logBuilder.getDateLogs(date));
    });

    socket.on('updateDataTable', function(date){
        // sent by schedule.html on date picker submit
        io.emit('updateDataTable', logBuilder.getDateLogs(date));
    })

    socket.on('disconnect', function() {
        console.log('user disconnected');
    });
});

var scanner = io.of('/scanner');

scanner.on('connection', function(socket) {
    console.log('Scanner connected');

    socket.on('sendMessage', function(data){
        logBuilder.updateLogs(data);
    })

    socket.on('disconnect', function() {
        console.log('Scanner disconnected');
    });
});
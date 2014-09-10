
var express = require("express");
var app = express();
var port = process.env.PORT || 8080;

//var game = require('./game');

app.set('views', __dirname + '/views');
app.set('view engine', "jade");
app.engine('jade', require('jade').__express);
app.get("/", function(req, res){
	res.render("index");
});

app.use(express.static(__dirname + '/public'));

global.io = require('socket.io').listen(app.listen(port));
console.log("Listening on port " + port);

io.sockets.on('connection', function (socket) {
	socket.emit('message', { message: 'Welcome to the lobby.' });
});

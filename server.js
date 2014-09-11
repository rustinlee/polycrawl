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

function createArray(length) {
	var arr = new Array(length || 0),
		i = length;

	if (arguments.length > 1) {
		var args = Array.prototype.slice.call(arguments, 1);
		while(i--) arr[length-1 - i] = createArray.apply(this, args);
	}

	return arr;
}

function generateDungeon(width, height) { //for now, this function just makes a 2d array and fills it with '1'
	var dungeon = createArray(width, height);

	for(var i = 0; i < dungeon.length; i++) {
		var column = dungeon[i];
			for(var j = 0; j < column.length; j++) {
				column[j] = 1;
				//console.log("dungeon[" + i + "][" + j + "] = " + column[j]);
			}
	}

	return dungeon;
}

var MAP_WIDTH = 10;
var MAP_HEIGHT = 10;
var dungeon = generateDungeon(MAP_WIDTH, MAP_HEIGHT);
console.log(dungeon);

io.sockets.on('connection', function (socket) {
	socket.emit('message', { message: 'Welcome to the lobby.' });
	socket.emit('mapData', dungeon);
});

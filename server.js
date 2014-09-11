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

function Tile(solid, symbol) { //map tile constructor
	this.creatures = []; //array of creatures within the tile
	this.items = []; //array of items dropped on the tile
	this.solid = solid || false; //does this tile impede movement
	this.symbol = symbol; //the ASCII symbol to draw for the tile
}

function Creature(symbol) {
	this.symbol = symbol;
}

function generateDungeon(width, height) { //for now, this function just makes a 2d array and fills it with '1'
	var dungeon = createArray(width, height);

	for(var i = 0; i < dungeon.length; i++) {
		var column = dungeon[i];
			for(var j = 0; j < column.length; j++) {
				//box in the map by making the edges collidable
				if (i === 0 || i === dungeon.length - 1 || j === 0 || j === dungeon.length - 1) {
					column[j] = new Tile(true, '#');
				} else {
					column[j] = new Tile(false, ',');
				}
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
	socket.game_player = new Creature('@');
	socket.game_player.position = [5,5];
	dungeon[socket.game_player.position[0]][socket.game_player.position[1]].creatures.push(socket.game_player);
	socket.emit('mapData', dungeon);
});

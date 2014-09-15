var express = require("express");
var _und = require('underscore');
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

var creatureID = 0;

function Creature(symbol, x, y) {
	this.symbol = symbol;
	this.x = x;
	this.y = y;
	this.id = creatureID;
	creatureID++;

	this.move = function(x, y, mapData) {
		if (mapData[this.x + x][this.y + y] !== '#') {
			this.x += x;
			this.y += y;
		}
	};
}

function Level(mapData) {
	this.gameEntities = [];
	this.mapData = mapData;
}

function Vector2(x, y) {
	this.x = x;
	this.y = y;

	this.isEqual = function (vec) { //underscore has a func for this
		return (this.x === vec.x) && (this.y === vec.y);
	};

	this.add = function (x, y) {
		this.x += x;
		this.y += y;
	};
}

function vec2RandomAdd(vec2, amt) {
	switch (Math.floor(Math.random() * 4)) {
		case 0:
			vec2.add(amt, 0);
			break;
		case 1:
			vec2.add(-amt, 0);
			break;
		case 2:
			vec2.add(0, amt);
			break;
		case 3:
			vec2.add(0, -amt);
			break;
	}

	return vec2;
}

function generateDungeon(size) {
	var startPoint = new Vector2(0, 0);
	var points = [];
	points.push(startPoint);

	var currentPoint = new Vector2(startPoint.x, startPoint.y);

	var i = 0;
	var j = 0;

	for (i = 0; i < size - 1; i++) {
		var generatingUniquePoint = true;
		while (generatingUniquePoint) {
			var currentPoint = vec2RandomAdd(new Vector2(currentPoint.x, currentPoint.y), 1);

			var searching = true;
			var duplicate = false;

			while (searching) {
				//console.log('checking to see if (' + currentPoint.x + ',' + currentPoint.y + ') is equal to points[' + j + '] (' + points[j].x + ',' + points[j].y + ')');
				if (currentPoint.isEqual(points[j])) {
					duplicate = true;
					searching = false;
					//console.log('(' + currentPoint.x + ',' + currentPoint.y + ') is equal to points[' + j + '] (' + points[j].x + ',' + points[j].y + ')');
					j = 0;
				}

				j++;

				if (j === points.length) {
					searching = false;
					generatingUniquePoint = false;
					j = 0;
					k = 0;
					//console.log('reached end of current points array and (' + currentPoint.x + ',' + currentPoint.y + ') is unique');
				}
			}

			if (!duplicate) {
				points.push(currentPoint);
			}
		}
	}
	//console.log(points);

	//find range and domain
	var lowestX = 0;
	var lowestY = 0;
	var greatestX = 0;
	var greatestY = 0;
	for (i = 0; i < points.length; i++) {
		if (points[i].x < lowestX) {
			lowestX = points[i].x;
		} else if (points[i].x > greatestX) {
			greatestX = points[i].x;
		}

		if (points[i].y < lowestY) {
			lowestY = points[i].y;
		} else if (points[i].y > greatestY) {
			greatestY = points[i].y;
		}

		//console.log('currently on #' + i + ' for range calculations');
	}

	//console.log('lowest x and y: ' + lowestX + ' ' + lowestY);
	//console.log('highest x and y: ' + greatestX + ' ' + greatestY);

	//shift values so lowest value is 0
	for (i = 0; i < points.length; i++) {
		points[i].add(Math.abs(lowestX), Math.abs(lowestY));
	}

	var domain = greatestX + Math.abs(lowestX);
	var range = greatestY + Math.abs(lowestY);
	//console.log('domain : ' + domain);
	//console.log('range : ' + range);

	//generate a blank map
	var mapArray = [];
	var mapX = '';
	for (i = 0; i <= domain; i++) {
		mapX += '#';
	}

	for (i = 0; i <= range; i++) {
		mapArray.push(mapX);
	}

	//add points to map
	for (i = 0; i < points.length; i++) {
		var string = mapArray[points[i].y];
		mapArray[points[i].y] = string.substring(0, points[i].x) + '.' + string.substring(points[i].x + 1, string.length);
	}

	return new Level(mapArray);
}

var mapSize = 2500; //number of walkable tiles in the final map
var dungeon = generateDungeon(mapSize);
//console.log(dungeon);

io.sockets.on('connection', function (socket) {
	socket.emit('message', { message: 'Welcome to the lobby.' });
	socket.game_player = new Creature('@', 5, 5);
	dungeon.gameEntities.push(socket.game_player);
	socket.emit('levelData', [dungeon, {x: socket.game_player.x, y: socket.game_player.y}]);
	socket.broadcast.emit('levelData', [dungeon]);

	socket.on('moveCommand', function (data) {
		socket.game_player.move(data.x, data.y, dungeon.mapData);
		socket.emit('levelData', [dungeon, {x: socket.game_player.x, y: socket.game_player.y}]);
		socket.broadcast.emit('levelData', [dungeon]);
	});

	socket.on('disconnect', function() {
		dungeon.gameEntities = _und.reject(dungeon.gameEntities, function(el) {
			return el.id === socket.game_player.id;
		});
		socket.broadcast.emit('levelData', [dungeon]);
	});
});

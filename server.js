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

var playerSpawn = new Vector2(0, 0);

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
	var mapY = '';
	for (i = 0; i <= range; i++) {
		mapY += '#';
	}

	for (i = 0; i <= domain; i++) {
		mapArray.push(mapY);
	}

	//add points to map
	for (i = 0; i < points.length; i++) {
		if (i === points.length - 1) {
			playerSpawn = new Vector2(points[i].x + 1, points[i].y + 1); //add 1 to compensate for boundary addition
		}

		var string = mapArray[points[i].x];
		mapArray[points[i].x] = string.substring(0, points[i].y) + '.' + string.substring(points[i].y + 1, string.length);
	}

	//box off the edges
	mapArray.unshift(mapY);
	mapArray.push(mapY);

	for (i = 0; i < mapArray.length; i++) {
		mapArray[i] = '#' + mapArray[i] + '#';
	}

	//clean up the unnecessary walls
	for (var x = 0; x < mapArray.length; x++) {
		for (var y = 0; y < mapArray[x].length; y++) {
			//todo: figure out a way to do this ~programmatically~
			var adj1;
			var adj3;
			var adj4;
			var adj5;
			var adj6;
			var adj8;

			if (mapArray[x - 1] != undefined) {
				adj1 = (mapArray[x - 1][y - 1] === '.');
				adj4 = (mapArray[x - 1][y] === '.');
				adj6 = (mapArray[x - 1][y + 1] === '.');
			}

			if (mapArray[x + 1] != undefined) {
				adj3 = (mapArray[x + 1][y - 1] === '.');
				adj5 = (mapArray[x + 1][y] === '.');
				adj8 = (mapArray[x + 1][y + 1] === '.');
			}

			var adj2 = (mapArray[x][y - 1] === '.');
			var adj7 = (mapArray[x][y + 1] === '.');

			var adj = adj1 || adj2 || adj3 || adj4 || adj5 || adj6 || adj7 || adj8; //is this cell adjacent to a '.'

			if (!adj) {
				var string = mapArray[x];
				mapArray[x] = string.substring(0, y) + ' ' + string.substring(y + 1, string.length);
			}
		}
	}

	return new Level(mapArray);
}

var mapSize = 2500; //number of walkable tiles in the final map
var dungeon = generateDungeon(mapSize);
//console.log(dungeon);

var claimedNicknames = [];

function changeNickname (socket, nickname) {
	if (nickname !== undefined && nickname.length > 2) {
		if (claimedNicknames.indexOf(nickname) === -1) {
			var index = claimedNicknames.indexOf(socket.nickname);
			if (index !== -1)
				claimedNicknames.splice(index, 1);
			claimedNicknames.push(nickname);
			io.sockets.emit('chatMessage', { message: socket.nickname + ' has changed their name to ' + nickname + '.'});
			socket.nickname = nickname;
		} else {
			socket.emit('chatMessage', { message: 'That name has already been claimed.'});
		}
	} else {
		socket.emit('chatMessage', { message: 'That nickname is too short. '});
	}
}

io.sockets.on('connection', function (socket) {
	socket.emit('chatMessage', { message: 'Welcome to the lobby.' });
	socket.emit('chatMessage', { message: 'Type /nick to set a nickname.' });
	socket.game_player = new Creature('@', playerSpawn.x, playerSpawn.y);
	dungeon.gameEntities.push(socket.game_player);
	socket.emit('levelData', [dungeon, {x: socket.game_player.x, y: socket.game_player.y}]);
	socket.broadcast.emit('levelData', [dungeon]);
	socket.nickname = 'Player ' + socket.id.substring(0, 5);
	socket.lastMsgTime = Date.now();

	socket.on('moveCommand', function (data) {
		socket.game_player.move(data.x, data.y, dungeon.mapData);
		socket.emit('levelData', [dungeon, {x: socket.game_player.x, y: socket.game_player.y}]);
		socket.broadcast.emit('levelData', [dungeon]);
	});

	socket.on('chatMessage', function (data) {
		if (data.message.length) {
			if (data.message.substring(0, 1) !== '/') {
				if (Date.now() - socket.lastMsgTime > 500) {
					data.nickname = socket.nickname;
					io.sockets.emit('chatMessage', data);

					socket.lastMsgTime = Date.now();
				} else {
					socket.emit('chatMessage', { message: 'Please slow down your messages.'});
				}
			} else {
				var cmd = data.message.split(' ');
				switch (cmd[0]) {
					case '/nickname':
					case '/nick':
						changeNickname(socket, cmd[1]);
						break;
					default:
						socket.emit('chatMessage', { message: 'Command not recognized.'});
				}
			}
		}
	});

	socket.on('disconnect', function() {
		dungeon.gameEntities = _und.reject(dungeon.gameEntities, function(el) {
			return el.id === socket.game_player.id;
		});
		socket.broadcast.emit('levelData', [dungeon]);
	});
});

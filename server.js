var express = require("express");
var _und = require('underscore');
var validator = require('validator');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
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

function randomString(len, charSet) {
    charSet = charSet || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < len; i++) {
    	var randomPoz = Math.floor(Math.random() * charSet.length);
    	randomString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomString;
}

var adminPass = randomString(5);
console.log("Admin commands passcode: " + adminPass);

function createArray(length) {
	var arr = new Array(length || 0),
		i = length;

	if (arguments.length > 1) {
		var args = Array.prototype.slice.call(arguments, 1);
		while(i--) arr[length-1 - i] = createArray.apply(this, args);
	}

	return arr;
}

function simulateCombat (aggressor, target, level, aggressorSocketID, targetSocketID) {
	//very simple placeholder calculations
	var dmg = aggressor.atk;
	target.HP -= dmg;

	if (aggressorSocketID) {
		var targetNameStr;
		if (targetSocketID) {
			targetNameStr = '<span style="color: rgb(' + io.sockets.connected[targetSocketID].rgb + ')">' + io.sockets.connected[targetSocketID].nickname + '</span>';
		} else {
			targetNameStr = 'the ' + target.fullName.toLowerCase();
		}

		var aggressorSocket = io.sockets.connected[aggressorSocketID];
		aggressorSocket.emit('chatMessage', { message: 'You have hit ' +  targetNameStr + ' for ' + dmg + ' damage.'});
	}

	if (targetSocketID) {
		var aggressorNameStr;
		if (aggressorSocketID) {
			aggressorNameStr = '<span style="color: rgb(' + io.sockets.connected[aggressorSocketID].rgb + ')">' + io.sockets.connected[aggressorSocketID].nickname + '</span>';
		} else {
			aggressorNameStr = 'The ' + aggressor.fullName.toLowerCase();
		}

		var targetSocket = io.sockets.connected[targetSocketID];
		targetSocket.emit('chatMessage', { message: aggressorNameStr + ' has hit you for ' + dmg + ' damage.' });
		targetSocket.emit('hpBarUpdate', (target.HP / target.maxHP) * 100);
	}

	if (target.HP <= 0) {
		level.gameEntities = _und.reject(level.gameEntities, function (creature) {
			return creature.id === target.id;
		});

		if (targetSocket) { //respawn creature if a player is controlling it
			targetSocket.emit('chatMessage', { message: 'You have died!' });
			targetSocket.game_player = new Creature(mobDefinitions['human'], playerSpawn.x, playerSpawn.y, targetSocket.color, targetSocket.id);
			level.gameEntities.push(targetSocket.game_player);
			targetSocket.emit('hpBarUpdate', (targetSocket.game_player.HP / targetSocket.game_player.maxHP) * 100);
		}
	}

	io.sockets.emit('entitiesData', [level.gameEntities]);
}

var mobDefinitions = JSON.parse(stripJsonComments(fs.readFileSync('./data/mobs.json', 'utf8')));

var creatureID = 0;

function Creature(template, x, y, color, socketID) {
	this.fullName = template.fullName;
	this.symbol = template.symbol;
	this.color =  color || [255, 255, 255];
	this.x = x;
	this.y = y;
	this.id = creatureID;
	creatureID++;

	if (socketID) {
		this.socketID = socketID;
	} else {
		this.socketID = null;
	}

	this.con = template.stats.con;
	this.str = template.stats.str;

	this.maxHP = this.con * 10;
	this.HP = this.maxHP;
	this.atk = this.str;

	this.limbs = template.limbs;

	this.move = function(x, y, level) {
		var targetX = this.x + x;
		var targetY = this.y + y;
		if (level.mapData[targetX][targetY] !== '#') {
			var creaturesAtPosition = getCreaturesAtPosition(targetX, targetY, level);
			if (creaturesAtPosition.length === 0) {
				this.x += x;
				this.y += y;
			} else {
				var targetSocketID = creaturesAtPosition[0].socketID;
				simulateCombat(this, creaturesAtPosition[0], level, this.socketID, targetSocketID);
			}
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
				if (currentPoint.isEqual(points[j])) {
					duplicate = true;
					searching = false;
					j = 0;
				}

				j++;

				if (j === points.length) {
					searching = false;
					generatingUniquePoint = false;
					j = 0;
					k = 0;
				}
			}

			if (!duplicate) {
				points.push(currentPoint);
			}
		}
	}

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
	}

	//shift values so lowest value is 0
	for (i = 0; i < points.length; i++) {
		points[i].add(Math.abs(lowestX), Math.abs(lowestY));
	}

	var domain = greatestX + Math.abs(lowestX);
	var range = greatestY + Math.abs(lowestY);

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

var claimedNicknames = [];

function changeNickname (socket, nickname) {
	var valid = validator.isAlphanumeric(nickname);

	if (valid) {
		if (nickname !== undefined && nickname.length > 2 && nickname.length < 13) {
			if (claimedNicknames.indexOf(nickname) === -1) {
				var index = claimedNicknames.indexOf(socket.nickname);
				if (index !== -1)
					claimedNicknames.splice(index, 1);
				claimedNicknames.push(nickname);
				io.sockets.emit('chatMessage', { message: '<span style="color: rgb(' + socket.rgb + ')">' + socket.nickname + '</span> has changed their name to <span style="color: rgb(' + socket.rgb + ')">' + nickname + '</span>.'});
				socket.nickname = nickname;
			} else {
				socket.emit('chatMessage', { message: 'That name has already been claimed.'});
			}
		} else if (nickname.length < 2) {
			socket.emit('chatMessage', { message: 'That nickname is too short.'});
		} else if (nickname.length > 13) {
			socket.emit('chatMessage', { message: 'That nickname is too long.'});
		} else {
			socket.emit('chatMessage', { message: 'Invalid command. Usage: /nick {nickname}'});
		}
	} else {
		socket.emit('chatMessage', { message: 'Nickname may only contain letters and numbers.'});
	}
}

function checkAdminPass (socket, pass) {
	if (socket.isAdmin) {
		socket.emit('chatMessage', { message: 'You are already authenticated as an admin.'});
		return;
	}

	if (pass === adminPass) {
		socket.emit('chatMessage', { message: 'Authentication code accepted, admin rights granted.'});
		socket.isAdmin = true;
	} else {
		socket.emit('chatMessage', { message: 'Authentication code incorrect. There will probably be repercussions for this in the future.'});
	}
}

function verifyAdminPermissions (socket) {
	if (!socket.isAdmin) {
		socket.emit('chatMessage', { message: 'Insufficient permissions.'});
		return false;
	}

	return true;
}

function validatePosition (x, y, mapData) {
	var results = {};

	var outOfBoundsX = x < 0 || x > mapData.length;
	var outOfBoundsY = y < 0 || y > mapData[0].length;
	results.outOfBounds = outOfBoundsX || outOfBoundsY;

	if (!results.outOfBounds) {
		results.isWalkable = mapData[x][y] !== '#' && mapData[x][y] !== ' '; //would like to move this to something more configurable later
	} else {
		results.isWalkable = false;
	}

	return results;
}

function getCreaturesAtPosition (x, y, level) {
	var a = _und.filter(level.gameEntities, function(entity) {
		var matchesX = entity.x === parseInt(x);
		var matchesY = entity.y === parseInt(y);
		return (matchesX && matchesY);
	});

	return a;
}

function getCreaturesAtPositionCommand (socket, cmd, level) {
	if (!verifyAdminPermissions(socket)) {
		return;
	}

	var x = parseInt(cmd[1]);
	var y = parseInt(cmd[2]);

	if (cmd.length === 3 && x !== NaN && y !== NaN) {
		var validationResults = validatePosition(x, y, level.mapData);

		if (validationResults.outOfBounds) {
			socket.emit('chatMessage', { message: 'Target location is out of the map boundaries.' });
		} else {
			if (!validationResults.isWalkable) {
				socket.emit('chatMessage', { message: 'Target location is not a walkable tile.' });
			} else {
				var creatures = getCreaturesAtPosition(x, y, level);
				socket.emit('chatMessage', { message: JSON.stringify(creatures) });
			}
		}
	} else {
		socket.emit('chatMessage', { message: 'Usage: /findat {x} {y}'});
	}
}

function spawnCreature (socket, cmd, level) {
	if (!verifyAdminPermissions(socket)) {
		return;
	}

	var x = parseInt(cmd[1]);
	var y = parseInt(cmd[2]);

	if (cmd.length === 4 && x !== NaN && y !== NaN) {
		var validationResults = validatePosition(x, y, level.mapData);

		if (validationResults.outOfBounds) {
			socket.emit('chatMessage', { message: 'Target location is out of the map boundaries.' });
		} else {
			if (!validationResults.isWalkable) {
				socket.emit('chatMessage', { message: 'Target location is not a walkable tile.' });
			} else {
				var template = mobDefinitions[cmd[3]];

				if (template) {
					var creature = new Creature(template, parseInt(cmd[1]), parseInt(cmd[2]), [255, 255, 255]);
					level.gameEntities.push(creature);
					io.sockets.emit('entitiesData', [dungeon.gameEntities]);
					socket.emit('chatMessage', { message: 'Spawned a ' + template.fullName + ' at (' + cmd[1] + ', ' + cmd[2] + ').' });
				} else {
					socket.emit('chatMessage', { message: 'Creature type not recognized.' });
				}
			}
		}
	} else {
		socket.emit('chatMessage', { message: 'Usage: /spawn {x} {y} {speciesName}'});
	}
}

function positionCommand (socket, dungeon, cmd) {
	if (!verifyAdminPermissions(socket)) {
		return;
	}

	if (cmd.length === 3 && !isNaN(parseInt(cmd[1])) && !isNaN(parseInt(cmd[2]))) {
		var x = parseInt(cmd[1]);
		var y = parseInt(cmd[2]);
		var validationResults = validatePosition(x, y, dungeon.mapData);
		if (validationResults.outOfBounds) {
			socket.emit('chatMessage', { message: 'Target location is out of the map boundaries.'});
		} else {
			if (!validationResults.isWalkable) {
				socket.emit('chatMessage', { message: 'Target location is not a walkable tile.'});
			} else {
				socket.game_player.x = x;
				socket.game_player.y = y;
				socket.emit('entitiesData', [dungeon.gameEntities, {x: socket.game_player.x, y: socket.game_player.y}]);
				socket.broadcast.emit('entitiesData', [dungeon.gameEntities]);
				socket.emit('chatMessage', { message: 'Position changed to (' + socket.game_player.x + ', ' + socket.game_player.y + ').'});
			}
		}
	} else if (cmd.length === 1) {
		socket.emit('chatMessage', { message: 'Current position is (' + socket.game_player.x + ', ' + socket.game_player.y + ').'});
	} else {
		socket.emit('chatMessage', { message: 'Usage: /pos {x} {y}'});
	}
}

io.sockets.on('connection', function (socket) {
	socket.emit('chatMessage', { message: 'Welcome to the lobby.' });
	socket.emit('chatMessage', { message: 'Type /nick to set a nickname.' });
	socket.color = [Math.round(Math.random() * 105) + 150, Math.round(Math.random() * 105) + 150, Math.round(Math.random() * 105) + 150];
	socket.rgb = socket.color[0] + ',' + socket.color[1] + ',' + socket.color[2];
	socket.game_player = new Creature(mobDefinitions['human'], playerSpawn.x, playerSpawn.y, socket.color, socket.id);
	dungeon.gameEntities.push(socket.game_player);
	socket.emit('levelData', [dungeon, {x: socket.game_player.x, y: socket.game_player.y}]);
	socket.broadcast.emit('entitiesData', [dungeon.gameEntities]);
	socket.nickname = 'Player ' + socket.id.substring(0, 5);
	socket.lastMsgTime = Date.now();

	io.sockets.emit('chatMessage', { message: '<span style="color: rgb(' + socket.rgb + ')">' + socket.nickname + '</span> has connected.' });

	socket.on('moveCommand', function (data) {
		if (Math.abs(data.x) + Math.abs(data.y) === 1) {
			socket.game_player.move(data.x, data.y, dungeon);
			socket.emit('entitiesData', [dungeon.gameEntities, {x: socket.game_player.x, y: socket.game_player.y}]);
			socket.broadcast.emit('entitiesData', [dungeon.gameEntities]);
		}
	});

	socket.on('chatMessage', function (data) {
		data.message = validator.escape(data.message);

		if (data.message.length) {
			if (data.message.substring(0, 1) !== '/') {
				if (Date.now() - socket.lastMsgTime > 500) {
					data.nickname = '<span style="color: rgb(' + socket.rgb + ')">' + socket.nickname + '</span>';
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
					case '/auth':
						checkAdminPass(socket, cmd[1]);
						break;
					case '/position':
					case '/pos':
						positionCommand(socket, dungeon, cmd);
						break;
					case '/findat':
						getCreaturesAtPositionCommand(socket, cmd, dungeon);
						break;
					case '/spawn':
						spawnCreature(socket, cmd, dungeon);
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
		socket.broadcast.emit('entitiesData', [dungeon.gameEntities]);
		io.sockets.emit('chatMessage', { message: '<span style="color: rgb(' + socket.rgb + ')">' + socket.nickname + '</span> has disconnected.' });
	});
});

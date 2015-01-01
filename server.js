var express = require('express');
var _und = require('underscore');
var validator = require('validator');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var map = require('./lib/map');
var simulateCombat = require('./lib/combat').simulateCombat;
var chatUtils = require('./lib/chatUtils');
var getHTMLFormattedName = chatUtils.getHTMLFormattedName;
var app = express();
var port = process.env.PORT || 8080;

var TICKS_PER_SECOND = 30;
var NS_PER_TICK = 1000000000 / TICKS_PER_SECOND;

var debug = {
	timing: false
};

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.engine('jade', require('jade').__express);
app.get('/', function(req, res){
	res.render('index');
});

app.use(express.static(__dirname + '/public'));

global.io = require('socket.io').listen(app.listen(port));
console.log('Listening on port ' + port);

function randomSimpleString(len, charSet) {
    charSet = charSet || 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnprstuvwxyz0123456789';
    var randomSimpleString = '';
    for (var i = 0; i < len; i++) {
    	var randomPoz = Math.floor(Math.random() * charSet.length);
    	randomSimpleString += charSet.substring(randomPoz,randomPoz+1);
    }
    return randomSimpleString;
}

var adminPass = randomSimpleString(5);
console.log('Admin commands passcode: ' + adminPass);

function StoredTurn(type, data) {
	this.turnType = type;
	this.turnData = data;
}

var lateFlag = false;
var tickNum = 0;
var lastSecond = process.hrtime();
function serverTick() {
	var tickStart = process.hrtime();

	if (debug.timing) {
		tickNum++;
		if (tickNum % TICKS_PER_SECOND === 0)
			console.log('hrtime before tick: ' + tickStart);
	}

	var updateFlag = false;
	_und.each(dungeon.gameEntities, function(creature) {
		creature.AP++;

		if (creature.AP > creature.reqAP) {
			creature.AP = creature.reqAP;

			if (creature.socketID) { //if a player, execute stored turn
				if (creature.hasStoredTurn()) {
					creature.executeStoredTurn();
					updateFlag = true;
					creature.AP = 0;
					io.sockets.connected[creature.socketID].emit('apBarReset', {
						tickrate: TICKS_PER_SECOND,
						reqAP: creature.reqAP
					}); //tell the client the server tickrate and required AP so it can simulate AP bar progress on its own
				}
			} else {
				if (creature.AITarget !== null) { //can't just check truth because 0 is a valid creature ID
					var AITargetCreature = _und.find(dungeon.gameEntities, function(a) {
						return a.id == creature.AITarget;
					});

					if (AITargetCreature) {
						var path = dungeon.finder.findPath(creature.x, creature.y, AITargetCreature.x, AITargetCreature.y, dungeon.pfGrid.clone());
						creature.move(path[1][0] - creature.x, path[1][1] - creature.y, dungeon);
						updateFlag = true;
						creature.AP = 0;
					} else {
						creature.AITarget = null; //assume target is dead and remove target from AI
					}
				} else {
					//todo: AI for acquiring new target
				}
			}
		}
	});

	if (updateFlag) {
		io.sockets.emit('entitiesData', [dungeon.getTrimmedGameEntities()]);
	}

	var dtHrTime = process.hrtime(tickStart);
	var dt = dtHrTime[0] * 1e9 + dtHrTime[1];
	var timeout = 1000000000 / TICKS_PER_SECOND - dt;
	if (timeout < 0) { //I doubt this will ever be a problem but I went ahead and set up a flag for server running behind on ticks
		timeout = 0;
		lateFlag = true;
	} else {
		lateFlag = false;
	}

	if (lateFlag)
		console.log('Warning: server ticks running behind');

	if (debug.timing && tickNum % TICKS_PER_SECOND === 0) {
		console.log('hrtime after tick: ' + process.hrtime());
		var dtLastSecond = process.hrtime(lastSecond);
		console.log('Nanoseconds taken to process a second worth of ticks: ' + (dtLastSecond[0] * 1e9 + dtLastSecond[1]));
		console.log('Nanoseconds taken to perform a single tick: ' + dt);
		console.log('Nanoseconds to wait before next tick: ' + timeout);
		lastSecond = process.hrtime();
	}
}

var previousTick = process.hrtime();
function gameLoop() {
	var now = process.hrtime();

	if (previousTick[0] * 1e9 + previousTick[1] + NS_PER_TICK <= now[0] * 1e9 + now[1]) {
		previousTick = process.hrtime();
		serverTick();
	}

	var d = process.hrtime(previousTick);
	if (d[0] * 1e9 + d[1] < NS_PER_TICK - 1000000) {
		setTimeout(gameLoop);
	} else {
		setImmediate(gameLoop);
	}
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

	//primary stats
	this.stats = template.stats;

	//secondary (derived) stats
	this.maxHP = this.stats.con * 10;
	this.HP = this.maxHP;
	this.atk = this.stats.str;
	this.reqAP = Math.floor(30 * (1 * Math.pow(this.stats.agi*125*Math.E, (-this.stats.agi/1250))));
	this.AP = 0;

	this.limbs = template.limbs;

	var _storedTurn = {};

	this.storeTurn = function(type, data) {
		_storedTurn = new StoredTurn(type, data);
	};

	this.hasStoredTurn = function() {
		return !_und.isEmpty(_storedTurn);
	};

	this.executeStoredTurn = function() {
		if (_storedTurn.turnType === 'move') {
			this.move(_storedTurn.turnData.x, _storedTurn.turnData.y, dungeon);

			if (this.socketID) {
				var socket = io.sockets.connected[this.socketID];
				socket.emit('entitiesData', [dungeon.getTrimmedGameEntities(), {x: socket.game_player.x, y: socket.game_player.y}]);
				socket.broadcast.emit('entitiesData', [dungeon.getTrimmedGameEntities()]);
			}
		}

		_storedTurn = {};
	};

	this.move = function(x, y, level) {
		var targetX = this.x + x;
		var targetY = this.y + y;
		if (level.mapData[targetX][targetY] !== '#') {
			var creaturesAtPosition = level.getCreaturesAtPosition(targetX, targetY);
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

var mapSize = 2500; //number of walkable tiles in the final map
var dungeon = map.drunkardsWalk(mapSize);

var claimedNicknames = [];

function changeNickname(socket, nickname) {
	var valid = validator.isAlphanumeric(nickname);

	if (valid) {
		if (nickname !== undefined && nickname.length > 2 && nickname.length < 13) {
			if (claimedNicknames.indexOf(nickname) === -1) {
				var index = claimedNicknames.indexOf(socket.nickname);
				if (index !== -1)
					claimedNicknames.splice(index, 1);
				claimedNicknames.push(nickname);
				var msg = getHTMLFormattedName(socket) + ' has changed their name to ';
				socket.nickname = nickname;
				msg +=  getHTMLFormattedName(socket);
				io.sockets.emit('chatMessage', { message: msg});
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

function checkAdminPass(socket, pass) {
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

function verifyAdminPermissions(socket) {
	if (!socket.isAdmin) {
		socket.emit('chatMessage', { message: 'Insufficient permissions.'});
		return false;
	}

	return true;
}

function getCreaturesAtPositionCommand(socket, cmd, level) {
	if (!verifyAdminPermissions(socket)) {
		return;
	}

	var x = parseInt(cmd[1]);
	var y = parseInt(cmd[2]);

	if (cmd.length === 3 && x !== NaN && y !== NaN) {
		var validationResults = level.validatePosition(x, y);

		if (validationResults.outOfBounds) {
			socket.emit('chatMessage', { message: 'Target location is out of the map boundaries.' });
		} else {
			if (!validationResults.isWalkable) {
				socket.emit('chatMessage', { message: 'Target location is not a walkable tile.' });
			} else {
				var creatures = level.getCreaturesAtPosition(x, y);
				socket.emit('chatMessage', { message: JSON.stringify(creatures) });
			}
		}
	} else {
		socket.emit('chatMessage', { message: 'Usage: /findat {x} {y}'});
	}
}

function spawnCreature(socket, cmd, level) {
	if (!verifyAdminPermissions(socket)) {
		return;
	}

	var x = parseInt(cmd[1]);
	var y = parseInt(cmd[2]);

	if (cmd.length === 4 && x !== NaN && y !== NaN) {
		var validationResults = level.validatePosition(x, y);

		if (validationResults.outOfBounds) {
			socket.emit('chatMessage', { message: 'Target location is out of the map boundaries.' });
		} else {
			if (!validationResults.isWalkable) {
				socket.emit('chatMessage', { message: 'Target location is not a walkable tile.' });
			} else {
				var template = mobDefinitions[cmd[3]];

				if (template) {
					var creature = new Creature(template, parseInt(cmd[1]), parseInt(cmd[2]), [255, 255, 255]);
					creature.AITarget = socket.game_player.id;
					level.gameEntities.push(creature);
					io.sockets.emit('entitiesData', [dungeon.getTrimmedGameEntities()]);
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

function positionCommand(socket, cmd, level) {
	if (!verifyAdminPermissions(socket)) {
		return;
	}

	if (cmd.length === 3 && !isNaN(parseInt(cmd[1])) && !isNaN(parseInt(cmd[2]))) {
		var x = parseInt(cmd[1]);
		var y = parseInt(cmd[2]);
		var validationResults = level.validatePosition(x, y);
		if (validationResults.outOfBounds) {
			socket.emit('chatMessage', { message: 'Target location is out of the map boundaries.'});
		} else {
			if (!validationResults.isWalkable) {
				socket.emit('chatMessage', { message: 'Target location is not a walkable tile.'});
			} else {
				socket.game_player.x = x;
				socket.game_player.y = y;
				socket.emit('entitiesData', [level.getTrimmedGameEntities(), {x: socket.game_player.x, y: socket.game_player.y}]);
				socket.broadcast.emit('entitiesData', [level.getTrimmedGameEntities()]);
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
	socket.game_player = new Creature(mobDefinitions['human'], dungeon.playerSpawn.x, dungeon.playerSpawn.y, socket.color, socket.id);
	dungeon.gameEntities.push(socket.game_player);
	socket.emit('statsData', socket.game_player.stats);
	socket.emit('levelData', [dungeon, {x: socket.game_player.x, y: socket.game_player.y}]);
	socket.broadcast.emit('entitiesData', [dungeon.getTrimmedGameEntities()]);
	socket.nickname = 'Player ' + socket.id.substring(0, 5);
	socket.lastMsgTime = Date.now();

	io.sockets.emit('chatMessage', { message: getHTMLFormattedName(socket) + ' has connected.' });

	socket.on('moveCommand', function (data) {
		if (Math.abs(data.x) + Math.abs(data.y) === 1) {
			socket.game_player.storeTurn('move', { x: data.x, y: data.y });
			//socket.emit('entitiesData', [dungeon.gameEntities, {x: socket.game_player.x, y: socket.game_player.y}]);
			//socket.broadcast.emit('entitiesData', [dungeon.gameEntities]);
		}
	});

	socket.on('chatMessage', function (data) {
		data.message = validator.escape(data.message);

		if (data.message.length) {
			if (data.message.substring(0, 1) !== '/') {
				if (Date.now() - socket.lastMsgTime > 500) {
					data.nickname = getHTMLFormattedName(socket);
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
						positionCommand(socket, cmd, dungeon);
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
		socket.broadcast.emit('entitiesData', [dungeon.getTrimmedGameEntities()]);
		io.sockets.emit('chatMessage', { message: getHTMLFormattedName(socket) + ' has disconnected.' });
	});
});

gameLoop();

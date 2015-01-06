var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var _und = require('underscore');

var combat = require('./combat.js');
var simulateCombat = combat.simulateCombat;

var mobDefinitions = JSON.parse(stripJsonComments(fs.readFileSync('./data/mobs.json', 'utf8')));
var mobID = 0; //probably need to move this to the map

function StoredTurn(type, data) {
	this.turnType = type;
	this.turnData = data;
}

module.exports.Mob = function(templateName, x, y, color, mapIndex, socketID) {
	var template = mobDefinitions[templateName];
	if (mobDefinitions[templateName] === undefined) {
		return null;
	}

	this.alive = true;
	this.mapIndex = mapIndex; //the index of the map the mob is currently on
	this.fullName = template.fullName;
	this.symbol = template.symbol;
	this.color =  color || [255, 255, 255];
	this.x = x;
	this.y = y;
	this.id = mobID;
	mobID++;

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

	this.move = function(x, y) {
		var targetX = this.x + x;
		var targetY = this.y + y;
		if (global.activeMaps[this.mapIndex].mapData[targetX][targetY] !== '#') {
			var mobsAtPosition = global.activeMaps[this.mapIndex].getMobsAtPosition(targetX, targetY);
			if (mobsAtPosition.length === 0) {
				this.x += x;
				this.y += y;
			} else {
				var targetSocketID = mobsAtPosition[0].socketID;
				simulateCombat(this, mobsAtPosition[0], global.activeMaps[this.mapIndex], this.socketID, targetSocketID);
			}
		}
	};

	this.storeTurn = function(type, data) {
		_storedTurn = new StoredTurn(type, data);
	};

	this.hasStoredTurn = function() {
		return !_und.isEmpty(_storedTurn);
	};

	this.executeStoredTurn = function() {
		if (_storedTurn.turnType === 'move') {
			this.move(_storedTurn.turnData.x, _storedTurn.turnData.y);

			if (this.socketID) {
				var socket = io.sockets.connected[this.socketID];
				socket.emit('entitiesData', [global.activeMaps[this.mapIndex].getTrimmedGameEntities(), {x: socket.game_player.x, y: socket.game_player.y}]);
				socket.broadcast.emit('entitiesData', [global.activeMaps[this.mapIndex].getTrimmedGameEntities()]);
			}
		}

		_storedTurn = {};
	};
};

module.exports.validateType = function(str) {
	if (mobDefinitions[str] !== undefined) {
		return true;
	} else {
		return false;
	}
}

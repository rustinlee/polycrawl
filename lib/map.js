var _und = require('underscore');
var pf = require('pathfinding');

var activeMaps = [];

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

function generatePathfindingGrid (matrix) {
	var grid = new pf.Grid(matrix.length, matrix[0].length);

	for (var x = 0; x < matrix.length; x++) {
		for (var y = 0; y < matrix[0].length; y++) {
			if (matrix[x][y] === '.') {
				grid.setWalkableAt(x, y, true);
			} else {
				grid.setWalkableAt(x, y, false);
			}
		}
	}

	return grid;
}

function Level(mapData, playerSpawn) {
	this.gameEntities = [];
	this.mapData = mapData;
	this.playerSpawn = playerSpawn;
	this.pfGrid = generatePathfindingGrid(mapData);
	this.finder = new pf.AStarFinder({
		allowDiagonal: false,
		dontCrossCorners: true
	});

	this.getTrimmedGameEntities = function() {
		return _und.map(this.gameEntities, function(currentObj) {
			return _und.pick(currentObj, ['symbol', 'color', 'x', 'y']);
		});
	};

	this.validatePosition = function(x, y) {
		var results = {};

		var outOfBoundsX = x < 0 || x > this.mapData.length;
		var outOfBoundsY = y < 0 || y > this.mapData[0].length;
		results.outOfBounds = outOfBoundsX || outOfBoundsY;

		if (!results.outOfBounds) {
			results.isWalkable = this.mapData[x][y] !== '#' && this.mapData[x][y] !== ' '; //would like to move this to something more configurable later
		} else {
			results.isWalkable = false;
		}

		return results;
	};

	this.getMobsAtPosition = function(x, y) {
		var a = _und.filter(this.gameEntities, function(entity) {
			var matchesX = entity.x === parseInt(x);
			var matchesY = entity.y === parseInt(y);
			return (matchesX && matchesY);
		});

		return a;
	};
}

exports.drunkardsWalk = function (size) {
	var playerSpawn = new Vector2(0, 0);
	var startPoint = new Vector2(0, 0);
	var points = [];
	points.push(startPoint);

	var currentPoint = new Vector2(startPoint.x, startPoint.y);

	var i = 0;
	var j = 0;

	for (i = 0; i < size - 1; i++) {
		var generatingUniquePoint = true;
		while (generatingUniquePoint) {
			currentPoint = vec2RandomAdd(new Vector2(currentPoint.x, currentPoint.y), 1);

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
				}
			}

			if (!duplicate) {
				points.unshift(currentPoint);
			}
		}
	}

	//find range and domain
	var lowestX = 0;
	var lowestY = 0;
	var greatestX = 0;
	var greatestY = 0;
	for (i = 0; i < points.length; i++) {
		lowestX = Math.min(lowestX, points[i].x);
		lowestY = Math.min(lowestY, points[i].y);
		greatestX = Math.max(greatestX, points[i].x);
		greatestY = Math.max(greatestY, points[i].y);
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
	var adjacentDirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]; //new Vector2 for each seems too verbose
	for (var x = 0; x < mapArray.length; x++) {
		for (var y = 0; y < mapArray[x].length; y++) {
			var adj = false;
			_und.each(adjacentDirs, function(coords) {
				var mapX = mapArray[x + coords[0]];
				if(mapX !== undefined)
					if(mapX[y + coords[1]] === '.')
						adj = true;
			});

			if (!adj) {
				var string = mapArray[x];
				mapArray[x] = string.substring(0, y) + ' ' + string.substring(y + 1, string.length);
			}
		}
	}

	activeMaps.push(new Level(mapArray, playerSpawn));
};

exports.getMap = function(index) {
	return activeMaps[index];
};

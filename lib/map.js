var _und = require('underscore');
var pf = require('pathfinding');

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

	return new Level(mapArray, playerSpawn);
}
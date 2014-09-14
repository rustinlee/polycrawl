var initialized = false;
var term;
var renderEng;
var currentLevel;

//graphical settings
var HORIZ_TILES = 30;
var VERT_TILES = 30;

function setElementToViewportSize(element) {
	element.attr('width', $(window).innerWidth());
	element.attr('height', $(window).innerHeight());
}

function drawMap(position){
	renderEng.update(position.x, position.y);
	for (var i = 0; i < currentLevel.gameEntities.length; i++) {
		var entity = currentLevel.gameEntities[i];
		term.put(AT, entity.x - position.x + term.cx, entity.y - position.y + term.cy); //draws every entity as an @ for now
	}
	term.render();
}

var AT = new ut.Tile("@", 255, 255, 255);
var WALL = new ut.Tile('#', 100, 100, 100);
var FLOOR = new ut.Tile('.', 50, 50, 50);

function getDungeonTile(x, y) {
	var symbol;

	try {
		symbol = currentLevel.mapData[x][y].symbol;
	} catch(err) {
		return ut.NULLTILE;
	}

	switch(symbol){
		case '#':
			return WALL;
			break;
		case '.':
			return FLOOR;
			break;
		case '@':
			return AT;
			break;
		default:
			return ut.NULLTILE;
	}
}

function resizeTerminal() {
	var fontSizeW = $(window).innerWidth() / HORIZ_TILES;
	var fontSizeH = $(window).innerHeight() / VERT_TILES;
	$('body').css('font-size', Math.min(fontSizeW, fontSizeH));
	term.setRenderer('auto');
	term.render();
}

function initializeUt(mapData, terminalElement) {
	term = new ut.Viewport(terminalElement, HORIZ_TILES, VERT_TILES, 'auto', true);
	renderEng = new ut.Engine(term, getDungeonTile, mapData[0].length, mapData.length);

	initialized = true;
}

$(document).ready(function() {
	var messages = [];
	var socket = io.connect('http://'+location.host);
	var level;

	var termElement = $('#game')[0];

	function onWindowResize() {
		resizeTerminal(termElement);
	}
	window.addEventListener('resize', onWindowResize, false);

	$(window).keydown(function(data) {
		switch(data.keyCode) {
			case 87:
				socket.emit('moveCommand', {x: 0, y: -1});
				break;
			case 83:
				socket.emit('moveCommand', {x: 0, y: 1});
				break;
			case 65:
				socket.emit('moveCommand', {x: -1, y: 0});
				break;
			case 68:
				socket.emit('moveCommand', {x: 1, y: 0});
				break;
			default:
				break;
		}
	});

	//socket.IO server message handling
	socket.on('message', function (data) {
		alert(data.message);
	});

	socket.on('levelData', function (data) {
		if(initialized === false) {
			initializeUt(data[0].mapData, termElement);
			onWindowResize();
		}

		currentLevel = data[0];
		drawMap(data[1]);
	});
});

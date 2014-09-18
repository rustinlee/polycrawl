var initialized = false;
var term;
var renderEng;
var currentLevel;
var playerPos;

//graphical settings
var HORIZ_TILES = 30;
var VERT_TILES = 30;

function drawMap(position){
	renderEng.update(position.x, position.y);
	for (var i = 0; i < currentLevel.gameEntities.length; i++) {
		var entity = currentLevel.gameEntities[i];
		term.put(AT, entity.x - position.x + term.cx, entity.y - position.y + term.cy); //draws every entity as an @ for now
	}
	term.render();
}

var AT = new ut.Tile("@", 255, 255, 255, 0, 0, 0);
var WALL = new ut.Tile('#', 100, 100, 100, 0, 0, 0);
var FLOOR = new ut.Tile('.', 50, 50, 50, 0, 0, 0);

function getDungeonTile(x, y) {
	var symbol;

	try {
		symbol = currentLevel.mapData[x][y];
	} catch(err) {
		return ut.NULLTILE;
	}

	switch(symbol){
		case '#':
			return WALL;
		case '.':
			return FLOOR;
		case '@':
			return AT;
		default:
			return ut.NULLTILE;
	}
}

function resizeTerminal() {
	var fontSizeW = $(window).innerWidth() / HORIZ_TILES;
	var fontSizeH = $(window).innerHeight() / VERT_TILES;
	var fontSize = Math.min(fontSizeW, fontSizeH);
	$('body').css('font-size', fontSize);

	term.setRenderer('auto');
	term.render();

	$('#main-view').css('width', fontSize * HORIZ_TILES);
	$('#main-view').css('height', fontSize * VERT_TILES);
	var viewWidth = parseInt($('#main-view').css('height'));
	var viewHeight = parseInt($('#main-view').css('width'));
	$('#main-view').css('margin', -viewWidth / 2 + 'px 0 0 ' + -viewHeight / 2 + 'px');
}

function onWindowResize() {
	resizeTerminal();
}

function initializeUt(mapData, terminalElement) {
	term = new ut.Viewport(terminalElement, HORIZ_TILES, VERT_TILES, 'auto', true);
	renderEng = new ut.Engine(term, getDungeonTile, undefined, undefined);

	window.addEventListener('resize', onWindowResize, false);

	initialized = true;
}

$(document).ready(function() {
	var socket = io.connect('http://'+location.host);

	var termElement = $('#game')[0];
	var chatFocused = false;

	$('#chat-input').focusin(function() {
		chatFocused = true;
	});

	$('#chat-input').focusout(function() {
		chatFocused = false;
	});

	$(window).keydown(function(data) {
		if (!chatFocused) {
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
		if(data.length > 1)
			playerPos = data[1];
		drawMap(playerPos);
	});
});

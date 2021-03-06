var initialized = false;
var term;
var renderEng;
var currentLevel;
var playerPos;

//graphical settings
var HORIZ_TILES = 30;
var VERT_TILES = 30;

function drawMap(position) {
	renderEng.update(position.x, position.y);
	for (var i = 0; i < currentLevel.gameEntities.length; i++) {
		var entity = currentLevel.gameEntities[i];
		term.put(entity.tile, entity.x - position.x + term.cx, entity.y - position.y + term.cy);
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
	} catch (err) {
		return ut.NULLTILE;
	}

	switch (symbol) {
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

function resizeTerminal(fontSize) {
	$('body').css('font-size', fontSize);

	term.setRenderer('auto');
	term.render();

	var viewWidth = fontSize * HORIZ_TILES * (4/3);
	var viewHeight = fontSize * VERT_TILES;
	$('#main-view').css('width', viewWidth);
	$('#main-view').css('height', viewHeight);
	$('#main-view').css('margin', -viewHeight / 2 + 'px 0 0 ' + -viewWidth / 2 + 'px');

	$('#stats-pane').css('height', viewHeight);
	$('#stats-pane').css('width', viewWidth / 4);

	$('#game').css('height', viewHeight);

	$('#msg-log').scrollTop($('#msg-log').prop('scrollHeight'));
}

var cachedFontSize;
function computeFontSize() {
	var fontSizeW = $(window).innerWidth() / HORIZ_TILES;
	var fontSizeH = $(window).innerHeight() / VERT_TILES;
	var fontSize = Math.floor(Math.min(fontSizeW, fontSizeH));

	if(fontSize !== cachedFontSize) {
		resizeTerminal(fontSize);
	}

	cachedFontSize = fontSize;
}

function onWindowResize() {
	if (initialized)
		computeFontSize();
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
	var hpBar = $('#hp-bar-inner');
	var apBar = $('#ap-bar-inner');

	var fontLoader = new FontLoader(['DejaVuSansMono'], {
		'fontLoaded': function(fontFamily) {
			if (initialized)
				resizeTerminal();
		}
	}, 5000);
	fontLoader.loadFonts();

	var chatFocused = false;

	$('#chat-input').on('focusout', function() {
		chatFocused = false;
	});

	$('#game').on('click', function() {
		chatFocused = false;
	});

	$('#stats-pane').on('click', function() {
		chatFocused = false;
	});

	$('#msg-log').on('click', function() {
		chatFocused = true;
	});

	$('#chat-input').on('focusin', function() {
		chatFocused = true;
	});

	$(window).keydown(function(data) {
		if (!chatFocused) {
			switch(data.keyCode) {
				case 87: // W
				case 73: // I
				case 38: // ↑
					socket.emit('moveCommand', {x: 0, y: -1});
					break;
				case 83: // S
				case 75: // K
				case 40: // ↓
					socket.emit('moveCommand', {x: 0, y: 1});
					break;
				case 65: // A
				case 74: // J
				case 37: // ←
					socket.emit('moveCommand', {x: -1, y: 0});
					break;
				case 68: // D
				case 76: // L
				case 39: // →
					socket.emit('moveCommand', {x: 1, y: 0});
					break;
				default:
					break;
			}
		} else {
			if (data.keyCode === 13) {
				var msg = $('#chat-input').val();
				if (msg !== '') {
					socket.emit('chatMessage', { message: msg });
					$('#chat-input').val('');
				}
			}
		}
	});

	//socket.IO server message handling
	socket.on('chatMessage', function(data) {
		if (!data.nickname) {
			$('#msg-log').append('<b>' + data.message + '</b>');
		} else {
			$('#msg-log').append('<b>' + data.nickname + '</b>: ' + data.message);
		}

		$('#msg-log').append('<br />');

		$('#msg-log').scrollTop($('#msg-log').prop('scrollHeight'));
	});

	socket.on('levelData', function(data) {
		if(initialized === false) {
			initializeUt(data[0].mapData, termElement);
			onWindowResize();
		}

		currentLevel = data[0];
		if(data.length > 1)
			playerPos = data[1];

		//todo: optimize this
		for (var i = 0; i < currentLevel.gameEntities.length; i++) {
			var entity = currentLevel.gameEntities[i];
			if (entity.tile === undefined) {
				entity.tile = new ut.Tile(entity.symbol, entity.color[0], entity.color[1], entity.color[2]);
			}
		}

		drawMap(playerPos);
	});

	socket.on('entitiesData', function(data) {
		currentLevel.gameEntities = data[0];
		if(data.length > 1)
			playerPos = data[1];

		//todo: optimize this
		for (var i = 0; i < currentLevel.gameEntities.length; i++) {
			var entity = currentLevel.gameEntities[i];
			if (entity.tile === undefined) {
				entity.tile = new ut.Tile(entity.symbol, entity.color[0], entity.color[1], entity.color[2]);
			}
		}

		drawMap(playerPos);
	});

	socket.on('hpBarUpdate', function(data) {
		hpBar.css('width', data + '%');
	});

	socket.on('apBarReset', function(data) {
		apBar.stop();
		apBar.css('width', '0%');
		apBar.animate({
			width: '100%'
		}, (data.reqAP / data.tickrate) * 1000, 'linear');
	});

	socket.on('statsData', function(data) {
		for (var key in data) {
			$('#' + key + '-stat').text(data[key]);
		}
	});

	var moveTooltip = function(event) {
		var tooltipX = event.pageX - 12;
		var tooltipY = event.pageY + 12;
		$('div.tooltip').css({top: tooltipY, left: tooltipX});
	};

	var showTooltip = function(event) {
		$('div.tooltip').remove();
		$('<div class="tooltip">' + event.data.string + '</div>').appendTo('body');
		moveTooltip(event);
	};

	var hideTooltip = function() {
		$('div.tooltip').remove();
	};

	var statTooltips = {
		con: 'Constitution increases your hit points (HP) which represent your ability to withstand damage. (Planned) Lessens the duration and/or seriousness of harmful status effects. Increases range of bows and thrown items.',
		str: 'Strength increases the damage done by melee weapons. (Planned) Decreases the effects of overencumberance from carrying a heavy inventory.',
		dex: 'Dexterity increases the accuracy of melee attacks and their ability to deal critical damage. (Planned) Slightly increases melee damage and greatly increases accuracy of ranged attacks, including some targeted spells.',
		agi: 'Agility increases the chance to dodge enemy attacks and reduces the amount of time required between actions.'
	};

	for (var key in statTooltips) {
		var elem = $('#' + key + '-stat-div');
		elem.on('mousemove', moveTooltip);
		elem.on('mouseenter', {string: statTooltips[key]}, showTooltip);
		elem.on('mouseleave', hideTooltip);
	}
});

//graphical settings
var tileSize = 40; //size of each tile in px (will likely end up scaling with viewport size)

function setElementToViewportSize(element) {
	element.attr('width', $(window).innerWidth());
	element.attr('height', $(window).innerHeight());
}

function drawMap(level, context){
	for(var i = 0; i < level.mapData.length; i++) {
		var column = level.mapData[i];
		for(var j = 0; j < column.length; j++) {
			var x = i * tileSize;
			var y = j * tileSize;

			context.rect(x, y, tileSize, tileSize);
			context.stroke();

			context.fillText(column[j].symbol, x + tileSize * 0.1, y + tileSize * 0.9);
		}
	}

	for (var i = 0; i < level.gameEntities.length; i++) {
		var entity = level.gameEntities[i];
		context.fillText(entity.symbol, entity.x * tileSize + tileSize * 0.1, entity.y  * tileSize + tileSize * 0.9);
	}
}

$(document).ready(function() {
	var messages = [];
	var socket = io.connect('http://'+location.host);
	var mapData;
	var canvas = $('#main-view');
	var ctx2d = canvas[0].getContext('2d');
	ctx2d.translate(0.5, 0.5);

	function onWindowResize() {
		setElementToViewportSize(canvas);
		ctx2d.font = '40px sans-serif';
		if(mapData !== undefined)
			drawMap(mapData, ctx2d);
	}
	window.addEventListener('resize', onWindowResize, false);
	onWindowResize();

	//socket.IO server message handling
	socket.on('message', function (data) {
		alert(data.message);
	});

	socket.on('mapData', function (data) {
		mapData = data;
		drawMap(mapData, ctx2d);
	});
});

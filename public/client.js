function setElementToViewportSize(element) {
	element.width($(window).innerWidth());
	element.height($(window).innerHeight());
}

$(document).ready(function() {
	var messages = [];
	var socket = io.connect('http://'+location.host);
	var canvas = $('#main-view');

	function onWindowResize() {
		setElementToViewportSize(canvas);
	}

	window.addEventListener('resize', onWindowResize, false);

	setElementToViewportSize(canvas);

	//socket.IO server message handling
	socket.on('message', function (data) {
		alert(data.message);
	});
});

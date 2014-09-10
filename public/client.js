$(document).ready(function() {
	var messages = [];
	var socket = io.connect('http://'+location.host);

	socket.on('message', function (data) {
		alert(data.message);
	});
});

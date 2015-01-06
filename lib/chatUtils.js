exports.getHTMLFormattedName = function(socket) {
	return '<span style="color: rgb(' + socket.rgb + ')">' + socket.nickname + '</span>';
};

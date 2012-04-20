/**
	© 2012 nodetag, see LICENSE.txt for license.
**/
var util = require('util'),
http = require('http'),
path = require('path'),
url = require('url'),
fs = require('fs'),
mime = require('mime'),
session = require('sesh').session,
encode = require('./encode.js').encode;
var server = {}, config = {};
// default config
config = {
	server: {
		host: '192.168.0.8',
		port: 8080
	}
}
server.http = {};
server.http.loadFile = function(uri, response){
	var filename = './public/' + uri;
	fs.exists(filename, function(exists) {
		if(!exists) {
			response.writeHeader(404, {'Content-Type': 'text/plain'});
			response.write('404 Not Found\n');
			console.log('[404] ' + uri);
			response.end();
			return;
		}
		fs.readFile(filename, 'binary', function(err, file) {
			if(err) {
				response.writeHead(500, {'Content-Type': 'text/plain'});
				response.end(err + '\n');
 				return;
			}
			response.writeHead(200, {});
			response.end(file, 'binary');
		});
	});
}
server.http.getBootcode = function(response){
	var filename = './firmware/bootcode.bin';
	fs.exists(filename, function(exists) {
		if(!exists) {
			response.writeHeader(404);
			response.write('404 Not Found\n');
			response.end();
			console.log('[404] Could not find bootcode!');
			return;
		}
		fs.readFile(filename, 'binary', function(err, file) {
			if(err) {
				response.writeHead(500, {
					'Content-Type': 'text/plain'
				});
				response.write(err + '\n');
				response.end();
			}
            var type = mime.lookup(filename);
            response.writeHead(200, {
                'Content-Type': type
            });
            response.write(file, 'binary');
            response.end();
		});
	});
}
server.http.handleJSP = function(uri, get, request, response){
	switch(uri){
		case 'bc':
			server.http.getBootcode(response);
		break;
		case 'p4':
			var ambient = [], isAmbient;
			// Not sure if this works
			get && console.log(get);
			// Handle ping
			console.log('[PINGED]');
			var data = [0x7f];
			console.log(request.session);
			// encode ping interval block
			data.push(0x03, 0x00, 0x00, 0x01, 10);
			// build up an ambient block
			if(request.session.action == 'ambient' && request.session.number){
				encode.set_ambient(ambient, 1, request.session.number);
				isAmbient = 1;
			}
			// Dont blink if cleared
			if(request.session.action == 'clear'){
				encode.clear_ambient(ambient, 1);
				isAmbient = 1;
			}
			if(isAmbient){
				data.push(4);
				encode.length(data, ambient.length + 4);
				data.push(0, 0, 0, 0);
				[].forEach.call(ambient, function(e, i){
					data.push(e);
				});
			}
			// encode end of data
			data.push(0xff, 0x0a);
			encoded = encode.array(data);
			response.writeHead(200, {});
			response.write(encoded, 'binary');
			response.end();
		break;
		case 'locate':
			response.writeHead(200, {});
			response.write('ping '+config.server.host+':'+config.server.port+' \r\n');
			response.write('broad '+config.server.host+':'+config.server.port+' \r\n');
			response.end();
		break;
		default:
			return false;
		break;
	}
	return true;
}
server.http.start = function(){
	http.createServer(function(request, response) {
		session(request, response, function(request, response){
			var parsed = url.parse(request.url, true);
			var uri = parsed.pathname;
			var get = parsed.query;
			// Replace the /vl, so people dont need that at end
			uri = uri.replace('/vl/', '/');
			console.log(request.url);
			var isJSP = uri.match('.jsp') ? !!uri.match('.jsp')[0] : false;
			var get;
			// add post data to variable named post if there is any
			if (request.method == 'POST') {
				var body = '';
				request.on('data', function (data) {
					body += data;
				});
				request.on('end', function () {
					post = qs.parse(body);
				});
 	   		}
			switch(uri){
				case '/':
					server.http.loadFile('index.html', response);
				return;
				case '/vl':
					response.writeHead(200, {});
					response.end();
				return;
				case '/ambient':
					console.log(get);
					if(get){
						if(get.number){
							number = get.number;
						}else{
							number = Math.floor((Math.random()*18)+1);
						}
						request.session.number = number;
						request.session.action = 'ambient';
					}
					response.writeHead(200, {});
					response.end('Changed!');
				break;
				default: 
					/* 
						If it ends with .jsp, do more processing. 
						If it doesnt, return 404.
					*/
					// TODO: Use regex
					var realuri = isJSP ? uri.replace('.jsp', '').replace('/', '') : '';
					isJSP && console.log('[JSP] ' + uri);
					if(realuri && server.http.handleJSP(realuri, get, request, response)){
					}else{
						console.log('[404] ' + uri);
						response.writeHead(404, {'Content-Type': 'text/plain'});
						response.end('404 Not Found\n');
					}
				break;
			}
			!isJSP && console.log('[URI] ' + uri);
		});
	}).listen(config.server.port, config.server.host);
}
server.start = function(){
	server.http.start();
}
console.log('nodetag started on ' + config.server.host + ':' + config.server.port);
exports.server = server;
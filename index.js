var fs = require('fs');
var http = require('http');
var https = require('https');
var express = require('express');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var _ = require('underscore');
var request = require('request');
var hbs = require('hbs');

require(process.env.HOME + '/statesecrets/DwollaCredentials.js');

var app = express();

app.configure('development', function() {
	app.use(function(req,res,next) {
		if (!/https/.test(req.protocol)){
			res.redirect("https://" + req.headers.host + req.url);
		} else {
			return next();
		} 
	});

	app.use(express.bodyParser());
	app.use(express.errorHandler());
	app.use(express.compress());
	
	app.locals.pretty = true;
	
	app.set("view engine", 'hbs');
	app.set("view options", { layout: false });
	
	app.engine('tmpl', require('hbs').__express);
	
	app.use(express.static(__dirname + '/public'));
	
	app.use(function(req, res, next) {
		if(req && req.query && req.query.error) {
			errorPage(res, req.query.error, req.query.error_description);
		} else {
			next();
		}
	});
});

var firebase_root_url = 'https://cardwolla.firebaseio.com';
var firebase_root = new Firebase(firebase_root_url);
var tokenGenerator = new FirebaseTokenGenerator('zqObmd1CMMc0AnsR2UbqZSi4fpw5ZZtTcZm2xEHd');

var adminToken = tokenGenerator.createToken({}, {
	admin: true,
	debug: false,
	expires: 1577836800	// A long long time from now.
});

console.log('Firebase admin token:', adminToken);

firebase_root.auth(adminToken);

app.all('/', function(req, res) {
	res.sendfile(__dirname + '/public/index.html');
});

app.all('/account', function(req, res) {
	if(!req.query || !req.query.code) {
		errorPage(res, "Missing Code", "How can you eat your access token if you don't receive your code?!");
		return;
	}

	request.get({
		url: 'https://www.dwolla.com/oauth/v2/token?client_id=' + encodeURIComponent(Dwolla.client_id) + '&client_secret=' + encodeURIComponent(Dwolla.secret) + '&grant_type=authorization_code&redirect_uri=' + encodeURIComponent('https://' + req.host + '/account') + '&code=' + req.query.code,
		json: true
	}, function(error, response, body) {
		if(body && body.error) {
			errorPage(res, body.error, body.error_description);
			return;	
		}
		
		res.json({
			loggedIn: req.query.code,
			client_id: Dwolla.client_id,
			hostname: req.host,
			body: body.access_token
		});
	});
});

http.createServer(app).listen(80);
https.createServer({
	key: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.key'),
	cert: fs.readFileSync(process.env.HOME + '/statesecrets/cardwolla.crt')
}, app).listen(443);

function errorPage(res, title, message) {
	res.render('error.tmpl', {
		title: title,
		message: message
	});
}

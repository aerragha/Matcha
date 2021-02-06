var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
var flash = require('connect-flash');
var session = require("express-session");
var passport = require('passport');
const fileUpload = require('express-fileupload');
var socket = require('socket.io');
const User = require('./models/user');
const moment = require('moment');
const function_user = new User();

var routes = require('./routes/index');
var users = require('./routes/users');


//Init app
var app = express();

app.use(expressLayouts);
app.set('view engine', 'ejs');
//View engine 
// app.set('views', path.join(__dirname, 'views'));
// app.engine('handlebars', exphbs({defaultLayout: 'layout'}));
// app.set('view engine', 'handlebars');

//bodyParser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
	extended: false
}));
app.use(cookieParser());

//set static folder
app.use(express.static(path.join(__dirname, 'public')));

//Express session 
app.use(session({
	secret: 'sectrf$$$@$',
	saveUninitialized: true,
	resave: true
}));


// default options
app.use(fileUpload());



//Passport init
app.use(passport.initialize()); //est un middle-ware qui initialise Passport .
/*
   Les middlewares sont des fonctions qui ont accès à l'objet de requête (req),
   à l'objet de réponse (res) et à la fonction middleware suivante 
   dans le cycle de requête-réponse de l'application.*/
app.use(passport.session());




//Connect flash
app.use(flash());

//Global vars
app.use(function (req, res, next) {
	res.locals.success_msg = req.flash('success_msg');
	res.locals.success_msg_pas = req.flash('success_msg_pas');
	res.locals.error_msg = req.flash('error_msg');
	res.locals.err_msg_pass = req.flash('err_msg_pass');
	res.locals.error = req.flash('error');
	res.locals.users = req.user || null;
	res.locals.latitude = req.flash('latitude');
	res.locals.longitude = req.flash('longitude');
	next();
});

app.use('/', routes);
app.use('/users', users);


app.use(function (req, res, next) {
	var err = new Error('404 Page not found!');
	err.status = 404;
	next(err);
});

// handling errors
app.use(function (err, req, res, next) {
	res.status(err.status || 500);
	res.send('Error with status 500');
});

//Set port
app.set('port', (process.env.PORT || 1337));

var server = app.listen(app.get('port'), function () {
	console.log('Server started on port ' + app.get('port'));
});
var users = {};



var sio = socket(server, {
	pingInterval: 1000000,
	pingTimeout: 4000,
	transports: ['websocket', 'htmlfile', 'xhr-polling', 'jsonp-polling', 'polling']
});
sio.on('connection', function (socket) {
	try{
		socket.on('login', function (user) {
			users[user.id] = socket.id;
			users[socket.id] = user.id;
			id = user.id;
			data = {
				id
			}
			socket.broadcast.emit('user_logged', data);
		});
		
	
		socket.on('borad', function (data) {
			const toSocketId = users[data.toUserId];
			socket.to(toSocketId).emit('new_borad', data);
		});
	
		socket.on('message', function (data) {
			const {firstname, lastname, image,  id_user, toUserId, message } = data;
		
			const toSocketId = users[toUserId];
			function_user.check_block(id_user, toUserId, function(nb){
				if(nb == 0)
				{
					function_user.check_if_match(id_user, toUserId, function(result){
						if(result == 'OK'){
							var date = new Date();
							var moments = moment(date, "YYYYMMDD").fromNow();
							if (message === '') {
								var err = `Message cant be empty`;
								socket.emit(`new_msg-response`, err);
							} else {
							
								function_user.insertMessages(id_user, toUserId, message, date, function (results) {
									if (results) {
										data = {
											firstname,
											lastname,
											image,
											id_user,
											toUserId,
											message,
											moments
										};
										socket.to(toSocketId).emit(`new_msg`, data);
										console.log(toUserId + ':' + toSocketId);
									}
								});
								}
						}
						else
						socket.emit(`new_msg-response`, 'Your are not matched!');
					});
				}
				else
				socket.emit(`new_msg-response`, 'Your are blocked!');
			});
	
		});
	
		socket.on('like', function(data){
			const { id_user_from, id_user_to, message, firstname,lastname,username,  image } = data;
			const toSocketId = users[id_user_to];
			const toSocketfrom = users[id_user_from];
			var date = new Date();
			var moments = moment(date, "YYYYMMDD").fromNow();
			data = {
				id_user_from,
				firstname,
				lastname,
				username,
				image,
				moments,
				message
			}
			socket.to(toSocketId).emit('new_like', data);
			socket.to(toSocketfrom).emit('matche', data);

		});
	
		socket.on('view', function(data){
			const { id_user, id_prof, firstname,lastname,username,  image } = data;
			const toSocketId = users[id_prof];
			var date = new Date();
			var moments = moment(date, "YYYYMMDD").fromNow();
			data = {
				id_user,
				firstname,
				lastname,
				username,
				image,
				moments
			}
			socket.to(toSocketId).emit('new_view', data);
		});
		// Leave the chat
		socket.on('logout', function (data) {
			var id = data.id;
			var soc = users[id];
			const date = new Date();
			var moments = moment(date, "YYYYMMDD").fromNow();
			delete soc
			data = {
				moments,
				id
			};
			socket.broadcast.emit('userList', data);
		});


	}
	catch(err){
		("Sorry, there seems to be an issue with the connection!");
	}
});

sio.set('transports', [ 'websocket', 'flashsocket', 'polling' ] );

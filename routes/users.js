var express = require('express');
var router = express.Router();
var mysql = require('mysql');
const randomstring = require('randomstring');
var bcrypt = require('bcrypt');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var uniqid = require('uniqid');
const ipInfo = require("ipinfo");
const User = require('../models/user');
const user = new User();
const moment = require('moment');

// var User = require('../models/user');
var connection = require('../models/db_connect');


function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
 
        res.redirect('/');
    }
    else {
        return next();
    }
 }
 
 function forwardAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    else {
        res.redirect('/');
    }
 }


 function from(req, res, next)
 {
    const {biography, age, completed } = req.user;
    if (completed == '0')
    {
        user.get_interests(function(interests){
            res.render('infos', {biography, age, interests});
        });
    }
    else
        return next();
 }

 router.get('/chat', forwardAuthenticated, from, function (req, res) {
    var host = req.get('host');
    user.get_chatList(req.user.id_user, function(results){
            var moments = [];
            for (var i = 0; i < results.length; i++){
                    moments.push(moment(results[i].time, "YYYYMMDD").fromNow());
            }
            user.getMessage(req.user.id_user, function(messages){
                res.render('chat', {results, messages, host, moments});
            });

    });
 }); 

router.get('/notification', forwardAuthenticated, from, function (req, res) {
    user.get_notif_like(req.user.id_user, null, function(notifs){
        var moments = [];
        for (var i = 0; i < notifs.length; i++)
            moments.push(moment(notifs[i].date_notif, "YYYYMMDD").fromNow());
        res.render('notification', {moments, notifs});
    });
});

router.get('/registre', ensureAuthenticated, function (req, res) {
    res.render('registre');
});
 
router.get('/login', ensureAuthenticated, function (req, res) {
    res.render('login');
});

 // Page infos
router.get('/infos',forwardAuthenticated, from, function (req, res) {
    res.redirect('/');
});

// Profile handler
router.get('/profile/:username', forwardAuthenticated, from, function(req, res){
    const username = req.params.username;
        user.find(username, username, function(result){
            if (result && result.verified == 1 && result.completed == 1)
            {
                user.check_block(req.user.id_user, result.id_user, function(nb){
                    if (nb == 0)
                    {
                        user.add_views(result.id_user, req.user.id_user, function(lastId){
                            if (lastId)
                            {
                                var page = 'photos';
                                user.select_img(result.id_user, function(images)
                                {
                                    user.check_if_like(req.user.id_user, result.id_user, function(nb){
                                        user.check_if_match(req.user.id_user, result.id_user, function(matche){
                                            var times = moment(result.time, "YYYYMMDD").fromNow();
                                            var moments = [];
                                            for (var i = 0; i < images.length; i++)
                                                moments.push(moment(images[i].date, "YYYYMMDD").fromNow());
                                            res.render('profile', {page, result, times, images, moments, nb, matche});
                                        })
                                    });
                                });
                            }
                        });
                    }
                    else
                        res.redirect('/');
                });
            }
            else
                res.redirect('/');
    });
 });

router.get('/profile/:username/:page', forwardAuthenticated, from, function(req, res){
    const {username, page} = req.params;
        user.find(username, username, function(result){
            if (result && result.verified == 1 && result.completed == 1)
            {
                user.check_block(req.user.id_user, result.id_user, function(nb){
                    if (nb == 0)
                    {
                        var inter = JSON.parse(result.interests);
                        if (page == 'about')
                        {
                            user.add_views(result.id_user, req.user.id_user, function(lastId){
                                user.check_if_like(req.user.id_user, result.id_user, function(nb){
                                    user.check_if_match(req.user.id_user, result.id_user, function(matche){
                                        var times = moment(result.time, "YYYYMMDD").fromNow();
                                        res.render('profile', {page, result, inter, nb, matche, times});
                                    });
                                })
                            });
                        }
                        else if (page == 'freinds' && username == req.user.username)
                        {
                            user.get_users_likeme(req.user.id_user, function(likeme){
                                user.get_users_likeme(req.user.id_user, function(ilikes){
                                    res.render('profile', {page, result, ilikes, likeme});
                                });
                            });
                        }
                        else if (page == 'views' && username == req.user.username)
                        {
                            user.get_views(result.id_user, function(views){
                                var mom_views = [];
                                for (var i = 0; i < views.length; i++)
                                    mom_views.push(moment(views[i].date_view, "YYYYMMDD").fromNow());
                                res.render('profile', {page, result, views, mom_views});
                            });
                        }
                            
                        else if (page == 'photos')
                            res.redirect('/users/profile/' + username);
                        else
                            res.redirect('/users/profile/' + username);
                    }
                    else
                        res.redirect('/');
                });
            }
            else
                res.redirect('/');
        });
});



router.get('/profile', forwardAuthenticated, from,   function (req, res) {
    res.redirect('/users/profile/' + req.user.username);
});


router.get('/edit_profile',forwardAuthenticated, from,   function (req, res) {
    var page = 'pers_infos';
    const pages = ['pers_infos', 'edit_pswd', 'notif_div', 'map_setting'];
    if (pages.indexOf(req.query.page) > -1)
        page = req.query.page;
    const myinter = JSON.parse(req.user.interests);
    user.get_interests(function(interests){
        res.render('edit_profile', {page, myinter, interests});
    });
 });

router.get('/verify', function (req, res) {
    var host = req.get('host');
    if((req.protocol + "://" + host) == ("http://" + host))
    {
        user.check_verification(req.query.id, function(result)
        {
            if(result)
            {
                user.update(result.email, result.id_user, function(done)
                {
                    if(done)
                    {
                        success_msg = 'Thank you! you may login';
                        res.render('login', { success_msg });
                    }
                });
            }
            else
            {
                error_msg = "We can't find your verification code";
                res.render('login', { error_msg });
            }
        });
    }
    else
    {
        error_msg = "Request is from unknown source";
        res.render('login', { error_msg });
    }
});

// Forget Page
router.get('/forget', ensureAuthenticated,  function (req, res) {
    res.render('forget');
});

// Recover Page
router.get('/recover', ensureAuthenticated, function (req, res) {
    token = req.query.code;
    if (token) {
        user.check_forget(token, function (result) {
            if (result == null)
                res.redirect('/users/login');
            else
                res.render('recover');
        });
    }
    else
        res.redirect('/users/login');
});


passport.serializeUser(function (user, done) {
    done(null, user.id_user);
});


// used to deserialize the user
passport.deserializeUser(function (id, done) {
    connection.query("SELECT u.*, uc.latitude, uc.longitude, uc.seated FROM USERS u, USER_COORDS uc WHERE u.id_user = uc.id_user AND u.id_user = ?", id, function (err, rows) {
        user.update_time(id, 1, function(lastId){
            if(lastId){
                done(err, rows[0]);
            }
        })
    });
});

passport.use('local-sign', new LocalStrategy(
    {
        // by default, local strategy uses username and password, we will override with email
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true // allows us to pass back the entire request to the callback
    },
    function (req, username, password, done) {
        connection.query("SELECT * FROM USERS WHERE username = ?", [username], function (err, rows) {
            if (rows.length)
            {
                if (bcrypt.compareSync(password, rows[0].password))
                {
                    if (rows[0].verified == 1)
                      {
                        return done(null, rows[0]);
                      }
                    else 
                        return done(null, false, { message: 'Your username is already in the system but not yet verified' });
                }
                else
                    return done(null, false, { message: 'Username ou/and password is incorrect. Please try again' });
            }
            else
                return done(null, false, { message: 'Username ou/and password is incorrect. Please try again' });
        });
    }));

router.post('/login', passport.authenticate('local-sign', { successRedirect: '/', failureRedirect: '/users/login', failureFlash: true }), function (req, res) {
    res.redirect('/');
});

router.post('/registre', function (req, res) {
    var error_msg = '', success_msg = '';

    const { firstname, lastname, username, email, password, password2 } = req.body;

    const checker = user.check_register_input(firstname, lastname, username, email, password, password2);

    if (checker == 'OK')
    {
        user.check_email(email, 'register', '1', function(result){
            if (result.nb == 0)
            {
                user.check_username(username, 'register', '1', function(result){
                    if (result.nb == 0)
                    {
                        var host = req.get('host');
                        user.create(firstname, lastname, username, email, password, host , function(lastId){
                            if (lastId)
                            {
                                success_msg = 'Please open your email inbox and click the given link so you can login';
                                res.render('registre', { success_msg });
                            }
                        });
                    }
                    else
                    {
                        error_msg = 'Username Already taken!';
                        res.render('registre', { error_msg, firstname, lastname, username, email });
                    }
                });
            }
            else
            {
                error_msg = 'Email Already taken!';
                res.render('registre', { error_msg, firstname, lastname, username, email });
            }
        });
    }
    else
        error_msg = checker;
    
    if (error_msg)
        res.render('registre', { error_msg, firstname, lastname, username, email });
});
// Forget Handler
router.post('/forget', function (req, res) {
    const email = req.body.email;
    
    var error_msg = '', success_msg = '';
    
    if (email) {
        
        const emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        if (emailRegexp.test(email)) {
            user.find(email, email, function (result) {
                if (result != null) {
                    if (result.verified == 1)
                    {
                        var host = req.get('host');
                        const secretToken = randomstring.generate();
                        user.send_mail(email, host, secretToken, 2);
                        success_msg = 'Recover mail was sent with successfully';
                        res.render('forget', { success_msg, email});
                    }
                    else
                    {
                        error_msg = 'Your Account is not active!';
                        res.render('forget', { error_msg, email });
                    }
                }
                else
                {
                  error_msg = 'Your Email not exists!';
                  res.render('forget', { error_msg, email});
                }
            });
        }
        else
            error_msg = 'Email Format not valid!';
    }
    else
        error_msg = 'Please enter your Email!';
    if(error_msg)
        res.render('forget', { error_msg, email});
});


router.post('/recover', function (req, res) {
    const { password, password2 } = req.body;
    const token = req.query.code;
    var error_msg = '', success_msg = '';
    const lowerCaseLetters = /[a-z]/g;
    const upperCaseLetters = /[A-Z]/g;
    const numbers = /[0-9]/g;

    if (password && password2 && token) {
        if (password == password2) {
            if (lowerCaseLetters.test(password) && upperCaseLetters.test(password) && numbers.test(password))
            {
                if (password.length >= 6)
                {
                    user.update_password(password, token, 'forget');
                    success_msg = 'Your password has been changed!';
                    res.render('login', { success_msg });
                }
                else
                    error_msg = 'Password must be at least 6 characters!';
            }
            else
                error_msg = 'Passwords must contain at least one letter and one number!';
        }
        else
            error_msg = 'Passwords do not match!';
    }
    else
        error_msg = 'Please enter all fields!';

    if (error_msg)
        res.render('recover', { error_msg });
});

// infos hundler
router.post('/infos', forwardAuthenticated,  function(req, res){
    var error_msg = '';
    user.get_interests(function(interests){
        var tab = [];
        var tab_inter = [];
        
        for(prop in interests)
        {
            tab.push(interests[prop].interest);
        }

        for(prop in req.body)
        {
            if (tab.indexOf(req.body[prop]) > -1)
                tab_inter.push(req.body[prop]);
        }

      
        const checker = user.check_infos_input(req.body, tab_inter);

        if (checker == 'OK')
        {
            if (req.files)
            {
                let file = req.files.prof_image;
                if (req.files.prof_image.length)
                        file = req.files.prof_image[0];
                if (user.check_image(file.mimetype, file.size) == 'OK')
                {
                    const image = uniqid('user_') + '.jpg';
                    const path = 'public/images/user_img/' + image;
                    const path2 = 'public/images/post_img/' + image;
                    file.mv(path, function(err){
                        if (err) throw err;
                        file.mv(path2, function(err){
                            user.check_valid_image(path, function(str){
                                if (str == 'OK')
                                {
                                    user.update_infos(req.body.gender, req.body.sex_pref, req.body.biography, req.body.age, tab_inter, image, req.user.id_user, function(lastId){
                                        if (lastId)
                                        {
                                            user.add_image(image, req.user.id_user, function(lastId){
                                                if (lastId)
                                                    res.redirect('/');
                                            });
                                        }
                                    });
                                }
                                else
                                {
                                    error_msg = 'Please upload a Valid image!';
                                    res.render('infos', { error_msg, biography:req.body.biography, age:req.body.age, interests });
                                }
                            });
                        });
                    });
                }
                else
                    error_msg = user.check_image(file.mimetype, file.size);
            }
            else 
                error_msg = 'Please upload a profile image!';
        }
        else
            error_msg = checker;

        if (error_msg)
            res.render('infos', { error_msg, biography:req.body.biography, age:req.body.age, interests });
    });
});

// edite_profile hundler : ps add the forwardAuthenticated for post router!!
router.post('/edit_profile', forwardAuthenticated, function(req, res){
    const page = req.query.page;
    var error_msg = '';
    if (page == 'pers_infos')
    {
      
        const { firstname, lastname, username, email } = req.body;
        
        
        user.get_interests(function(interests){
            const checker1 = user.check_register_input(firstname, lastname, username, email, 'Password1337', 'Password1337');
            
            var tab = [];
            var tab_inter = [];
            for(prop in interests)
            {
                tab.push(interests[prop].interest);
            }
            for(prop in req.body)
            {
                if (tab.indexOf(req.body[prop]) > -1)
                    tab_inter.push(req.body[prop]);
            }
            
            const checker2 = user.check_infos_input(req.body, tab_inter);
            if (checker1 == 'OK')
            {
                if (checker2 == 'OK')
                {
                    user.check_email(email, 'edit', req.user.id_user, function(result){
                        if (result.nb == 0)
                        {
                            user.check_username(username, 'edit', req.user.id_user, function(result){
                                if (result.nb == 0)
                                {
                                    if (req.user.email != email)
                                    {
                                        var host = req.get('host');
                                        user.update_edit_profilel(firstname, lastname, username, email, req.body.gender, req.body.sex_pref, req.body.biography, req.body.age, tab_inter, req.user.id_user, 'withToken', host, function(done){
                                            if (done)
                                            {
                                                req.logout();
                                                req.flash('success_msg', 'please viref your new account!');
                                                res.redirect('/users/login');
                                            }
                                        });
                                    }
                                    else
                                    {
                                        user.update_edit_profilel(firstname, lastname, username, email, req.body.gender, req.body.sex_pref, req.body.biography, req.body.age, tab_inter, req.user.id_user, 'noToken', host, function(done){
                                            if (done)
                                            {
                                                console.log('done');
                                                req.flash('success_msg', 'Your profile update was successful');
                                                res.redirect('/users/edit_profile');
                                            }
                                        });
                                    }
                                }
                                else
                                {
                                    req.flash('error_msg', 'Username Already taken!');
                                    res.redirect('/users/edit_profile');
                                }
                            });
                        }
                        else
                        {
                            req.flash('error_msg', 'Email Already taken!');
                            res.redirect('/users/edit_profile');
                        }
                    });
                }
                else
                    error_msg = checker2;
            }
            else
                error_msg = checker1;
            if (error_msg)
            {
                req.flash('error_msg', error_msg);
                res.redirect('/users/edit_profile');
            }
        });
        
        
    }
    else if (page == 'edit_pswd')
    {
        const { cur_password, password, password2 } = req.body;
        const lowerCaseLetters = /[a-z]/g;
        const upperCaseLetters = /[A-Z]/g;
        const numbers = /[0-9]/g;
        if (cur_password.trim() && password.trim() && password2.trim())
        {
            if (bcrypt.compareSync(cur_password, req.user.password))
            {
                if (password == password2)
                {
                    if (lowerCaseLetters.test(password) && upperCaseLetters.test(password) && numbers.test(password))
                    {
                        if (password.length >= 6)
                        {
                            user.update_password(password, req.user.id_user, 'change');
                            req.flash('success_msg_pas', 'Your password update was successful');
                            res.redirect('/users/edit_profile?page=edit_pswd');
                        }
                        else
                            error_msg = 'Password must be at least 6 characters!';
                    }
                    else
                        error_msg = 'Passwords must contain at least one letter and one number!';
                }
                else
                    error_msg = 'Passwords do not match!';
            }
            else
                error_msg = 'Current Password incorrect!!';
        }
        else
            error_msg = 'Please enter all fields!';
        if (error_msg)
        {
            req.flash('err_msg_pass', error_msg);
            res.redirect('/users/edit_profile?page=edit_pswd');
        }
    }
});

router.post('/profile/:username/:page', forwardAuthenticated, function(req, res)
{
    const {username, page} = req.params;
    user.find(username, username, function(result){
        if (result)
        {
            if (page == 'delete')
            {
                user.del_img(req.body.del_img, req.user.id_user, function(lastId)
                {
                    if(lastId)
                        res.redirect('/users/profile');
                });
            }
            else if (page == 'addPost')
            {
                if (req.files)
                {
                    user.select_img(req.user.id_user, function(result)
                    {
                        if(result.length < 5)
                        {
                            let file = req.files.add_image;
                            if (req.files.add_image.length)
                                file = req.files.add_image[0];
                            
                            const image = uniqid('post_') + '.jpg';
                            const path = 'public/images/post_img/' + image;
                            file.mv(path, function(err){
                                if (err) throw err;
                                user.check_valid_image(path, function(dim){
                                    if (dim == 'OK')
                                    {
                                        user.add_image(image, req.user.id_user, function(lastId){
                                            if (lastId)
                                            {
                                                res.redirect('/users/profile');
                                            }
                                        });
                                    }
                                    else
                                        res.redirect('/users/profile');
                                });
                            });
                        }
                        else
                            res.redirect('/users/profile');
                    });
                }
            }
            else if (req.files && page == 'addImg')
            {
                let file = req.files.image;
                if (req.files.image.length)
                    file = req.files.image[0];
                const image = uniqid('user_') + '.jpg';
                const path = 'public/images/user_img/' + image;
                const path2 = 'public/images/post_img/' + image;
                file.mv(path, function(err){
                    if (err) throw err;
                    file.mv(path2, function(err){
                        user.check_valid_image(path, function(dim){
                            if (dim == 'OK')
                            {
                                user.update_image(image, req.user.image, req.user.id_user, function(lastId){
                                    if (lastId)
                                    {
                                        res.redirect('/users/profile');
                                    }
                                });
                            }
                            else
                                res.redirect('/users/profile');
                        });
                    });
                });
            }
            else if (page == 'block')
            {
                user.block_user(req.user.id_user, result.id_user, function(lastId){
                    res.redirect('/');
                });
            }
            else if (page == 'report')
            {
                user.report_user(req.user.id_user, result.id_user, function(lastId){
                    res.redirect('/');
                });
            }
            else
                res.redirect('/');
        }
    });
});

router.post('/send_msg', forwardAuthenticated, function(req, res){
    const {toUserId, message} = req.body;
    user.insertMessages(req.user.id_user, toUserId, message, function(results){
        if(results){
            res.send(results);
        }
    });
});

router.post('/get_msg', forwardAuthenticated, function(req, res){
    const toUserId = req.body.toUserId;
    user.get_msg(req.user.id_user, toUserId, function(results){
        if(results){
            user.get_socket(toUserId, function(socket){
                if(socket){
                    res.send({results, socket});
                }
            });
        }
    });
});

router.post('/get_notif_msg', forwardAuthenticated, function(req, res){
    user.get_notif_msg(req.user.id_user, function(messages){
        var moments = [];
        for (var i = 0; i < messages.length; i++)
            moments.push(moment(messages[i].date, "YYYYMMDD").fromNow());
        res.send({messages, moments});
    });
});

router.post('/get_notif', forwardAuthenticated, function(req, res){
    user.get_notif_like(req.user.id_user, 1, function(notifs){
        var moments = [];
        for (var i = 0; i < notifs.length; i++)
            moments.push(moment(notifs[i].date_notif, "YYYYMMDD").fromNow());
        res.send({moments, notifs});
    });
});

router.post('/clear_notif_msg', forwardAuthenticated, function(req, res){
    user.clear_notif_msg(req.user.id_user, function(lastId){
        res.send('OK');
    });
});

router.post('/clear_notif', forwardAuthenticated, function(req, res){
    user.clear_notif(req.user.id_user, function(lastId){
        res.send('OK');
    });
});

router.post('/like', forwardAuthenticated, function(req, res){
    const id_user = req.body.id_user;
    if (id_user && !isNaN(parseFloat(id_user)) && isFinite(id_user))
    {
        user.add_like(req.user.id_user, id_user, function(lastId){
            res.send(lastId);
        });
    }
    else
        res.send('OK');
});

router.post('/unlike', forwardAuthenticated, function(req, res){
    const id_user = req.body.id_user;
    if (id_user && !isNaN(parseFloat(id_user)) && isFinite(id_user))
    {
        user.delete_like(req.user.id_user, req.body.id_user, function(lastId){
            res.send('OK');
        });
    }
    else
        res.send('OK');
});

router.post('/find_user', forwardAuthenticated, function(req, res){
    const id_user = req.body.id_user;
    if (id_user && !isNaN(parseFloat(id_user)) && isFinite(id_user))
    {
        var date = new Date();
        mom = moment(date, "YYYYMMDD").fromNow();
        user.find_user(id_user, function(result){
            if (result == null)
                res.send('Error');
            else
                res.send({result, mom});
        });
    }
    else
        res.send('Error');
});



router.post('/up_coords', forwardAuthenticated, function(req, res){
    const {latitude, longitude, seated} = req.body;
    if (latitude != 0 && longitude != 0)
    {
        user.update_coords(req.user.id_user, latitude, longitude, seated, function(lastId){
            if (lastId)
            {
                req.flash('latitude', latitude);
                req.flash('longitude', longitude);
                res.send('OK');
            }
        });
    }
    else if (latitude == 0 && longitude == 0)
    {
        ipInfo(function(err, cLoc) {
            if (err) throw err;
            const cords = cLoc.loc.split(',');
            user.update_coords(req.user.id_user, cords[0], cords[1], seated, function(lastId){
                if (lastId)
                {
                    req.flash('latitude', cords[0]);
                    req.flash('longitude', cords[1]);
                    res.send(cords);
                }
            });
        });
    }
});


router.get('/logout', forwardAuthenticated, function (req, res) {
    user.update_time(req.user.id_user, 2, function(lastId){
        if(lastId){
            req.logout();
            req.flash('success_msg', 'You are logged out');
            res.redirect('/users/login');
        }
    });
});


module.exports = router;

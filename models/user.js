const cn = require('../models/db_connect');
const bcrypt = require('bcryptjs');
const randomstring = require('randomstring');
const mailer = require('../mail/mailer');
var sizeOf = require('image-size');
const geolib = require('geolib');


function User() { };

User.prototype = {
    find: function (username, email, callback) {
        cmd = `SELECT u.*, uc.latitude, uc.longitude, uc.seated FROM USERS u, USER_COORDS uc WHERE u.id_user = uc.id_user AND (username = ? or email = ?)`;
        cn.query(cmd, [username, email], function(err, result){
            if (err) throw err;
            if (result.length)
                callback(result[0]);
            else
                callback(null);
        });
    },
    find_user: function (id_user, callback) {
        cmd = `SELECT * FROM USERS WHERE id_user = ?`;
        cn.query(cmd, id_user, function(err, result){
            if (err) throw err;
            if (result.length)
                callback(result[0]);
            else
                callback(null);
        });
    },
    check_email: function(email, etat, id_user, callback) {
        if (etat == 'register')
            cmd = `select count(*) as 'nb' from USERS where email = ?`;
        else if (etat == 'edit')
            cmd = `select count(*) as 'nb' from USERS where email = ? AND id_user != ?`;
        cn.query(cmd, [email, id_user], function(err, result){
            if (err) throw err;
            callback(result[0]);
        });
    }, 
    check_username: function(username, etat, id_user, callback) {
        if (etat == 'register')
            cmd = `select count(*) as 'nb' from USERS where username = ?`;
        else if (etat == 'edit')
            cmd = `select count(*) as 'nb' from USERS where username = ? AND id_user != ?`;
        cn.query(cmd, [username, id_user], function(err, result){
            if (err) throw err;
            callback(result[0]);
        });
    },
    find_by_email: function(email, callback)
    {
        cmd = `SELECT * FROM USERS WHERE email = ?`;
        cn.query(cmd, [email], function(err, result){
            if (err) throw err;
            callback(result[0]);
        });
    },
    create: function (firstname, lastname, username, email, password, host, callback) {
        const secretToken = randomstring.generate();
        var user = new User();
        if (this.send_mail(email, host, secretToken, 1) == 'true')
        {
            let pass = password;
            password = bcrypt.hashSync(pass, 10);
            var users = {
                "firstname": firstname,
                "lastname": lastname,
                "username": username,
                "email": email,
                "password": password,
                "verification_code": secretToken
            }
            let cmd = `INSERT INTO USERS SET ?`
    
            cn.query(cmd, users, function (err, lastId) {
                if (err) throw err;
                if (lastId)
                {
                    user.find_by_email(email, function(result){
                    
                        let cmd2 = `INSERT INTO USER_COORDS(id_user) values(?)`;
                        cn.query(cmd2, result.id_user, function(err, lastId){
                            if (err) throw err;
                            callback(lastId);
                        });
                    });
                }
                else
                    callback(lastId);
            })
        }
    },
    send_mail: function (email, host, secretToken, status) {
        if (status == 1)
        {
            var link = "http://" + host + "/users/verify?id=" + secretToken;
            const html = `Hi there,
                    <br/>
                    Thank you for registering!
                    <br/><br/>
                    Please verify your email by typing the following token:
                    <br/>
                    On the following page:
                    <a href="`+ link + `">Verify</a>
                    <br/><br/>
                    Have a pleasant day!`;
            if (mailer.sendEmail(email, 'Please verify your email', html))
                return('true');
            else
                return('false');
        }
        if (status == 2)
        {
            var msg = 'Hi there you can recover your password from this link : <a href="http://localhost:1337/users/recover?code=' + secretToken + '"> Click Here </a>';
            this.update_forget_token(secretToken, email);
            if (mailer.sendEmail(email, 'Recover Your password!', msg))
                return('true');
            else
                return('false');
            
        }
    },
    check_verification: function(verification_code, callback) {
        cmd = `select * from USERS where verification_code = ?`;
        cn.query(cmd, [verification_code], function(err, result){
            if (err) throw err;
            callback(result[0]);
        });
    },
    update: function(email, id_user, callback) {
        cmd = `UPDATE USERS SET verification_code = ? , verified = 1 WHERE email = ?`;
        cn.query(cmd, [null, email], function(err, done){
            if (err) throw err;
            callback(done);
        });
    },
    update_forget_token: function(token = null, email)
    {
        let cmd = `UPDATE USERS SET forgetPass = ? WHERE email = ?`;
        cn.query(cmd, [token, email], function(err, lastId){
            if (err) throw err;
            console.log('Token updated');
        });
    },
    check_forget: function(token, callback) {
        cmd = `SELECT * FROM USERS WHERE forgetPass = ?`;
        cn.query(cmd, token, function (err, result) {
            if (err) throw err;
            if (result.length)
                callback(result[0]);
            else
                callback(null);
        });
    },
    update_password : function(password, token, etat)
    {
        let cmd;
        if (etat == 'forget')
            cmd = `UPDATE USERS SET password = ? WHERE forgetPass = ?`;
        else if (etat == 'change')
            cmd = `UPDATE USERS SET password = ? WHERE id_user = ?`;
        let pass = password;
        password = bcrypt.hashSync(pass, 10);
        cn.query(cmd, [password, token], function (err, lastId) {
            if (err) throw err;
            console.log('Password updated');
        });

        if (etat == 'forget')
        {
            var user = new User();
            this.check_forget(token, function(result){
                if (result != null)
                {
                    user.update_forget_token(null, result.email);
                }
            });
        }
        
    },

    update_infos : function(gender, sex_pref, biography, age, tab_inter, image, id_user, callback)
    {
        let cmd = `UPDATE USERS 
        SET gender = ?, sex_pref = ?,  biography = ?, age = ?, interests = ?, completed = 1, image = ? 
        WHERE id_user = ?`;
        let interest =  JSON.stringify(tab_inter);
        cn.query(cmd, [gender, sex_pref, biography, age, interest, image, id_user], function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    }, 

    check_register_input : function(firstname, lastname, username, email, password, password2, callback)
    {
        const emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
        const lowerCaseLetters = /[a-z]/g;
        const upperCaseLetters = /[A-Z]/g;
        const numbers = /[0-9]/g;
        const fn_format = /^[a-zA-Z ]{2,20}$/;
        const un_format = /^[a-zA-Z0-9]{2,20}$/;

        if (firstname.trim() && lastname.trim() && username.trim() && email.trim() && password && password2)
        {
            if(fn_format.test(firstname) && fn_format.test(lastname))
            {
                if(un_format.test(username))
                {
                    if (emailRegexp.test(email))
                    {
                        if (password == password2)
                        {
                            if (lowerCaseLetters.test(password) && upperCaseLetters.test(password) && numbers.test(password))
                            {
                                if (password.length >= 6)
                                {
                                    return ('OK');
                                }
                                else
                                    return('Password must be at least 6 characters!');
                            }
                            else
                                return('Passwords must contain at least one letter and one number!');
                        }
                        else
                            return('Passwords do not match!');
                    }
                    else
                        return('Enter a valid email!');
                }
                else
                    return('Username must contain only letters or numbers!');
            }
            else
                return('Firstname/Lastname must contain only letters!');
        }
        else
            return('Please enter all fields!');
    },

    check_infos_input : function(body, tab_inter)
    {
        const gender = ['male', 'female'];
        const sex_pref = ['men', 'women', 'everyone'];
 
        
        const biography = body.biography;
        const age = body.age;

        if (gender.indexOf(body.gender) > -1)
        {
            if (sex_pref.indexOf(body.sex_pref) > -1)
            {
                if (biography.trim() && biography.trim().length <= 150)
                {
                    if (age && !isNaN(parseFloat(age)) && isFinite(age))
                    {
                        if (age >= 12 && age <= 100)
                        {
                            if (tab_inter.length)
                            {
                                return ('OK');
                            }
                            else
                                return ('Please select at least 1 interest!');
                        }
                        else
                            return ('Age must be between 12 and 100!');
                    }
                    else
                        return ('Please add a valid age!');
                }
                else
                    return ('Please Biography must be less than 150 chars!');
            }
            else
                return ('Make sure to use the correct Sexual preferences!');
        }
        else
            return ('Make sure to use the correct gender!');
    },
    check_image : function (type, size)
    {    
        const ext = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (ext.indexOf(type) > -1)
        {
            if (size <= 3000000)
                return ('OK');
            else
                return ('Please upload a image less than 2mb!');
        }
        else
            return ('Please upload a valid image!');   
    },
    check_valid_image : function(path, callback)
    {
        sizeOf(path, function (err, dimensions) {
          if (!err)
            callback('OK');
          else
            callback('ERROR');
        });
    },
    update_edit_profilel : function(firstname, lastname, username, email, gender, sex_pref, biography, age, tab_inter, id_user, etat, host, callback)
    {
        var token = '', ver = 1;
        if (etat == 'withToken')
        {
            ver = 0;
            token = randomstring.generate();
        }
        else if (etat == 'noToken')
            token = null;
            
        let cmd = `UPDATE USERS 
        SET firstname = ?, lastname = ?,  username = ?, email = ?, gender = ?, sex_pref = ?,  biography = ?, age = ?, interests = ?, verification_code = ?, verified = ?
        WHERE id_user = ?`;
        let interest =  JSON.stringify(tab_inter);
        cn.query(cmd, [firstname, lastname, username, email,  gender, sex_pref, biography, age, interest, token, ver, id_user], function(err, lastId){
            if (err) throw err;       
            if (lastId)
            {
                if (token != null)
                {
                    var user = new User();
                    user.send_mail(email, host, token, 1) == 'true'
                }
                callback('done');
            }
        });
    },
    update_image : function(image, old_image, id_user,  callback)
    {
        let cmd = `UPDATE USERS 
        SET image = ? 
        WHERE id_user = ?`;
        cn.query(cmd, [image, id_user], function(err, lastId){
            if (err) throw err;
            let cmd = `UPDATE IMAGES 
            SET image = ?, date = NOW() 
            WHERE image = ?`;
            cn.query(cmd, [image, old_image], function(err){
                if (err) throw err;
                callback(lastId);
            });
        });
    },
    add_image : function(image,  id_user,  callback)
    {
        const date = new Date();
        var images = {
            "id_user": id_user,
            "image": image,
            "date": date

        }
        let cmd = `INSERT INTO IMAGES SET ?`;
        cn.query(cmd, images, function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    },
    select_img: function(id_user, callback)
    {
        let cmd = `SELECT * FROM  IMAGES WHERE id_user = ?`;
        cn.query(cmd, id_user, function(err, result){
            if (err) throw err;
            callback(result);
        });
    },
    del_img: function(id_img, id_user, callback)
    {
        let cmd = `DELETE  FROM  IMAGES WHERE id_img = ? and id_user = ?`;
        cn.query(cmd, [id_img, id_user], function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    },
    update_coords : function(id_user, latitude, longitude, seated, callback)
    {
        let cmd = `UPDATE USER_COORDS 
        SET latitude = ?, longitude = ?, seated = ?
        WHERE id_user = ?`;
        cn.query(cmd, [latitude, longitude, seated, id_user], function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    },

    get_inter_query: function(inter)
    {
        var ch = '';
        if (inter.length)
        {
            ch += `AND (`;
            for (var i = 0; i < inter.length; i++)
            {
                ch += `interests LIKE '%` + inter[i] +`%' OR `;
            }
            ch = ch.slice(0, -4);
            ch += ') ';
        }
        return(ch);
    },
    update_time : function(id_user, status, callback)
    {
        if(status == 1){
            
            let cmd = `UPDATE USERS 
            SET online = ?, time = ?
            WHERE id_user = ?`;
            cn.query(cmd, ['Y', null, id_user], function(err, lastId){
                if (err) throw err;
                callback(lastId);
            });
        }
        if(status == 2){
            var date = new Date();
            let cmd = `UPDATE USERS 
            SET online = ?, time = ?
            WHERE id_user = ?`;
            cn.query(cmd, ['N', date, id_user], function(err, lastId){
                if (err) throw err;
                callback(lastId);
            });
        }
    },
    get_chatList: function(id_user, callback)
    {
        let cmd = `SELECT u.* FROM USERS u
        WHERE id_user != ?
        AND completed = 1 AND verified = 1 
        AND u.id_user NOT IN (SELECT id_user_from from BLOCKES WHERE id_user_to = ?)
        AND u.id_user NOT IN (SELECT id_user_to from BLOCKES WHERE id_user_from = ?)
        AND (SELECT COUNT(*) FROM LIKES WHERE id_user_from = ? AND id_user_to = u.id_user) != 0
        AND (SELECT COUNT(*) FROM LIKES WHERE id_user_from = u.id_user AND id_user_to = ?) != 0`;
        cn.query(cmd, [id_user, id_user, id_user, id_user, id_user], function(err, results){
            if (err) throw err;
            callback(results);
        });
    },
    insertMessages(fromUserId, toUserId, message, date,  callback){
        var params = {
            "from_user_id": fromUserId,
            "to_user_id": toUserId,
            "message": message,
            "date": date
        }
        if (message != null)
        {
            let cmd = "INSERT INTO MESSAGE SET ?";
            cn.query(cmd, params, function(err, results){
                if (err) throw err;
                callback(results);
            });
        }
        
    },
    getMessage: function(id_user, callback)
    {
        let cmd = `SELECT * FROM  MESSAGE WHERE from_user_id = ? or to_user_id = ?`;
        cn.query(cmd, [id_user, id_user], function(err, messages){
            if (err) throw err;
            callback(messages);
        });
    },
    get_msg: function(id_user, toUserId, callback)
    {
        let cmd = `SELECT * FROM  MESSAGE WHERE (from_user_id =  ? and to_user_id =  ? ) or  (from_user_id =  ? and to_user_id =  ? ) `;
        cn.query(cmd, [id_user, toUserId, toUserId, id_user], function(err, messages){
            if (err) throw err;
            callback(messages);
        });
    },
    get_socket: function(toUserId, callback)
    {
        let cmd = `SELECT * FROM  USERS WHERE id_user = ? and online = ? `;
        cn.query(cmd, [toUserId, 'Y'], function(err, socket){
            if (err) throw err;
            callback(socket);
        });
    },
    get_suggestions: function(user, callback)
    {
        var cmd = `SELECT DISTINCT u.*, uc.latitude, uc.longitude FROM USERS u, USER_COORDS uc WHERE u.id_user = uc.id_user AND u.id_user NOT IN (SELECT id_user_to FROM BLOCKES WHERE id_user_from = ?) AND u.id_user NOT IN (SELECT id_user_to FROM BLOCKES WHERE id_user_from = ?) AND u.id_user NOT IN (SELECT id_user_to FROM LIKES WHERE id_user_from = ?) AND u.id_user != ? `;
        const inter = JSON.parse(user.interests);
        if (inter.length)
            cmd += this.get_inter_query(inter);
        if (user.sex_pref == 'men')
            cmd += `AND rating >= ? AND verified = 1 AND completed = 1 AND gender = 'male' ORDER BY age, rating`;
        else if (user.sex_pref == 'women')
            cmd += `AND rating >= ? AND verified = 1 AND completed = 1 AND gender = 'female' ORDER BY age, rating`;
        else
            cmd += `AND verified = 1 AND completed = 1 AND rating >= ? ORDER BY age, rating`;
   
        cn.query(cmd, [user.id_user, user.id_user, user.id_user, user.id_user, user.rating], function(err, results){
            if (err) throw err;
            callback(results);
        });
    },
    check_distance: function(results, distance, latitude, longitude)
    {
        for (var i = 0; i < results.length; i++)
        {
            const lat = results[i].latitude;
            const long = results[i].longitude;
            if (geolib.getDistance({latitude: latitude, longitude: longitude}, {latitude: lat, longitude: long}) >= distance)
            {
                results.splice(i, 1);
                i = -1;
            }
        }
    },
    get_sugg_serch: function(user, age, rating, interests, callback)
    {
        var cmd = `SELECT DISTINCT u.*, uc.latitude, uc.longitude FROM USERS u, USER_COORDS uc WHERE u.id_user = uc.id_user AND u.id_user NOT IN (SELECT id_user_to FROM BLOCKES WHERE id_user_from = ?) AND u.id_user NOT IN (SELECT id_user_to FROM BLOCKES WHERE id_user_from = ?) AND u.id_user NOT IN (SELECT id_user_to FROM LIKES WHERE id_user_from = ?) AND u.id_user != ? `;
        const inter = interests.split(',');
        if (inter.length)
            cmd += this.get_inter_query(inter);
        if (user.sex_pref == 'men')
            cmd += `AND rating >= ? AND age >= ? AND verified = 1 AND completed = 1 AND gender = 'male' ORDER BY age, rating`;
        else if (user.sex_pref == 'women')
            cmd += `AND rating >= ? AND completed = 1 AND age >= ? AND verified = 1 AND gender = 'female' ORDER BY age, rating`;
        else
            cmd += `AND verified = 1 AND completed = 1 AND rating >= ? AND age >= ? ORDER BY age, rating`;
      
        cn.query(cmd, [user.id_user, user.id_user, user.id_user, user.id_user, rating, age], function(err, results){
            if (err) throw err;
            callback(results);
        });
    },
    get_interests: function (callback) {
        cmd = `SELECT interest from INTERESTS ORDER BY interest`;
        cn.query(cmd, function(err, result){
            if (err) throw err;
            if (result.length)
                callback(result);
        });
    },
    check_interst: function(inter)
    {
        cmd = `SELECT count(*) as 'nb' from INTERESTS where interest = ?`;
        cn.query(cmd, inter, function(err, result){
            if (err) throw err;
            return (result[0]);
        });
    },
    update_rating: function(id_user, rating, callback){
        let cmd = `UPDATE USERS SET rating = ? WHERE id_user = ?`;
        cn.query(cmd, [rating, id_user], function(err, lastId){
            if (err) throw err;
            callback(lastId); 
        });
    },
    check_view_exist: function(id_user_p, id_user_v, callback)
    {
        cmd = `SELECT COUNT(*) as 'nb' FROM VIEWS WHERE id_user_p = ? AND id_user_v = ?`;
        cn.query(cmd, [id_user_p, id_user_v], function(err, result){
            if (err) throw err;
            callback(result[0].nb);
        });
    },
    add_views: function(id_user_p, id_user_v, callback)
    {
        const date = new Date();
        var user = new User();
        if (id_user_p != id_user_v)
        {
            this.check_view_exist(id_user_p, id_user_v, function(nb){
                if (nb == 0)
                {
                    var views = {
                        "id_user_p": id_user_p,
                        "id_user_v": id_user_v,
                        "date_view": date
                    }
                    let cmd = `INSERT INTO VIEWS SET ?`;
                    cn.query(cmd, views, function(err, lastId){
                        if (err) throw err;
                        user.get_views(id_user_p, function(resu){
                            var rat = 1;
                            if (resu.length >= 5)
                                rat = 2;
                            if (resu.length >= 10)
                                rat = 3;
                            if (resu.length >= 15)
                                rat = 4;
                            if (resu.length >= 20)
                                rat = 5;
                            user.update_rating(id_user_p, rat, function(lastId){
                                user.add_notif(id_user_v, id_user_p, 'has seen your profile.', date, function(lastId){                
                                    callback(lastId);
                                });
                            });
                        });
                    });
                }
                else
                {
                    let cmd = `UPDATE VIEWS SET date_view = ?, read_view = 'N' WHERE id_user_p = ? AND id_user_v = ?`;
                    cn.query(cmd, [date, id_user_p, id_user_v], function(err, lastId){
                        if (err) throw err;
                        user.add_notif(id_user_v, id_user_p, 'has seen your profile.', date, function(lastId){                
                            callback(lastId);
                        }); 
                    });
                }
            });
        }
        else
            callback('1');
    },
    get_views: function(id_user_p, callback)
    {
        cmd = `SELECT v.date_view, u.* FROM USERS u, VIEWS v WHERE u.id_user = v.id_user_v AND id_user in (SELECT id_user_v FROM VIEWS WHERE id_user_p = ?) AND v.id_user_p = ? ORDER BY v.date_view DESC`;
        cn.query(cmd, [id_user_p, id_user_p], function(err, result){
            if (err) throw err;
            callback(result);
        });
    },
    block_user: function(id_user_from, id_user_to, callback)
    {
        const date = new Date();
        var blocks = {
            "id_user_from": id_user_from,
            "id_user_to": id_user_to,
            "date_block": date
        }
        let cmd = `INSERT INTO BLOCKES SET ?`;
        cn.query(cmd, blocks, function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    }, 
    check_block : function(id_user_from, id_user_to, callback)
    {
        cmd = `SELECT COUNT(*) as 'nb' FROM BLOCKES WHERE (id_user_from = ? AND id_user_to = ?) OR (id_user_from = ? AND id_user_to = ?)`;
        cn.query(cmd, [id_user_from, id_user_to, id_user_to, id_user_from], function(err, result){
            if (err) throw err;
            callback(result[0].nb);
        });
    },
    check_report: function(id_user_from, id_user_to, callback)
    {
        cmd = `SELECT COUNT(*) as 'nb' FROM REPORTS WHERE (id_user_from = ? AND id_user_to = ?)`;
        cn.query(cmd, [id_user_from, id_user_to], function(err, result){
            if (err) throw err;
            callback(result[0].nb);
        });
    },
    check_report_to_block : function(id_user_to, callback)
    {
        cmd = `SELECT COUNT(*) as 'nb' FROM REPORTS WHERE id_user_to = ?`;
        cn.query(cmd, [id_user_to], function(err, result){
            if (err) throw err;
            
            if (result[0].nb >= 5)
            {
                cmd2 = `UPDATE USERS SET verified = 0 WHERE id_user = ?`;
                cn.query(cmd2, [id_user_to], function(err, lastId){
                    if (err) throw err;
                    callback(lastId);
                });
            }
            else
                callback(result[0].nb);
        });
    },
    report_user : function(id_user_from, id_user_to, callback)
    {
        const date = new Date();
        this.check_report(id_user_from, id_user_to, function(nb){
            if (nb == 0)
            {
                var reports = {
                    "id_user_from": id_user_from,
                    "id_user_to": id_user_to,
                    "date_report": date
                }
                let cmd = `INSERT INTO REPORTS SET ?`;
                cn.query(cmd, reports, function(err, lastId){
                    if (err) throw err;
                    if (lastId)
                    {
                        var user = new User();
                        user.check_report_to_block(id_user_to, function(resu){
                            callback(resu);
                        });
                    }
                    else
                        callback(lastId);
                });
            }
            else
            {
                let cmd = `UPDATE REPORTS SET date_report = ? WHERE id_user_from = ? AND id_user_to = ?`;
                cn.query(cmd, [date, id_user_from, id_user_to], function(err, lastId){
                    if (err) throw err;
                    callback(lastId);
                });
            }
        });   
    },
    get_notif_msg: function(id_user, callback)
    {
        let cmd = `SELECT * FROM  MESSAGE m, USERS u WHERE u.id_user = m.from_user_id AND to_user_id = ? AND read_msg = 'N' ORDER BY m.date DESC`;
        cn.query(cmd, id_user, function(err, messages){
            if (err) throw err;
            callback(messages);
        });
    },
    get_notif_view: function(id_user, nb, callback)
    {
        let cmd = `SELECT * FROM  VIEWS v, USERS u WHERE u.id_user = v.id_user_v AND id_user_p = ? `;
        if (nb != null)
            cmd += `AND read_view = 'N' ORDER BY v.date_view DESC`;
        else
            cmd += `ORDER BY v.date_view DESC`;
        cn.query(cmd, id_user, function(err, views){
            if (err) throw err;
            callback(views);
        });
    },
    clear_notif_msg: function(id_user, callback)
    {
        let cmd = `UPDATE MESSAGE SET read_msg = 'R' WHERE to_user_id = ?`;
        cn.query(cmd, id_user, function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    },
    clear_notif: function(id_user, callback)
    {
        let cmd = `UPDATE NOTIFICATION SET read_notif = 'R' WHERE id_user_to = ?`;
        cn.query(cmd, id_user, function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    },
    check_if_like: function(id_user_from, id_user_to, callback)
    {
        let cmd = `SELECT COUNT(*) as 'nb' FROM LIKES WHERE id_user_from = ? AND id_user_to = ?`;
        cn.query(cmd, [id_user_from, id_user_to], function(err, result){
            if (err) throw err;
            callback(result[0].nb);
        });
    },
    add_notif: function(id_user_from, id_user_to, message, date, callback)
    {
        var notifs = {
            "id_user_from": id_user_from,
            "id_user_to": id_user_to,
            "message": message, 
            "date_notif": date
        }
        let cmd = `INSERT INTO NOTIFICATION SET ?`;
        cn.query(cmd, notifs, function(err, lastId){
            if (err) throw err;
            callback(lastId);
        });
    },
    check_if_match: function(id_user_from, id_user_to, callback)
    {
        var user = new User();
        user.check_if_like(id_user_from, id_user_to, function(nb1){
            user.check_if_like(id_user_to, id_user_from, function(nb2){
                if (nb1 == 1 && nb2 == 1)
                {
                    callback('OK');
                }
                else
                    callback('NO');
            });
        });
    },
    add_like: function(id_user_from, id_user_to, callback)
    {
        const date = new Date();
            this.check_if_like(id_user_from, id_user_to, function(nb){
                if (nb == 0)
                {
                    var likes = {
                        "id_user_from": id_user_from,
                        "id_user_to": id_user_to,
                        "date_like": date
                    }
                    let cmd = `INSERT INTO LIKES SET ?`;
                    cn.query(cmd, likes, function(err, lastId){
                        if (err) throw err;
                        var user = new User();
                        user.check_if_match(id_user_from, id_user_to, function(ret){
                            if (ret == 'OK')
                            {
                                user.add_notif(id_user_from, id_user_to, 'Matched with you.', date, function(lastId){
                                    user.add_notif(id_user_to, id_user_from, 'Matched with you.', date, function(lastId){
                                        callback('match');
                                    });
                                });
                            }
                            else
                            {
                                user.add_notif(id_user_from, id_user_to, 'Liked your profile.', date, function(lastId){                
                                    callback('like');
                                }); 
                            }
                        });
                    });
                }
            });
    },
    delete_like: function(id_user_from, id_user_to, callback)
    {
        const date = new Date();
        let cmd = `DELETE FROM LIKES WHERE id_user_from = ? AND id_user_to = ?`;
        var user = new User();
        cn.query(cmd, [id_user_from, id_user_to], function(err, lastId){
            if (err) throw err;
            user.add_notif(id_user_from, id_user_to, 'Unliked your profile.', date, function(lastId){                
                callback(lastId);
            });
        });
        
    },
    get_notif_like: function(id_user_to, nb, callback)
    {
        let cmd = `SELECT * FROM USERS u, NOTIFICATION n WHERE u.id_user = n.id_user_from AND n.id_user_to = ? `;
        if (nb != null)
            cmd += `AND read_notif = 'N' ORDER BY n.date_notif DESC`;
        else
            cmd += `ORDER BY n.date_notif DESC`;
        cn.query(cmd, id_user_to, function(err, resu){
            if (err) throw err;
            callback(resu);
        });
    },
    get_users_likeme: function(id_user_to, callback)
    {
        let cmd = `SELECT u.* FROM USERS u, LIKES L WHERE u.id_user = L.id_user_from AND u.id_user NOT IN (SELECT id_user_from from BLOCKES WHERE id_user_to = ?) AND u.id_user NOT IN (SELECT id_user_to from BLOCKES WHERE id_user_from = ?) AND L.id_user_to = ? AND verified = 1 AND completed = 1`;
        cn.query(cmd, [id_user_to, id_user_to, id_user_to], function(err, likeme){
            if (err) throw err;
            callback(likeme);
        });
    },
}

module.exports = User;
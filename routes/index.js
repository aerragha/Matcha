var express = require('express');
var router = express.Router();
const User = require('../models/user');
const user = new User();
const geolib = require('geolib');
//Get home page

router.get('/', ensureAuthenticated, from, function(req, res)
{
    user.get_suggestions(req.user, function(results){
        user.check_distance(results, 500, req.user.latitude, req.user.longitude);
        const myinter = JSON.parse(req.user.interests);
        user.get_interests(function(interests){
            res.render('index', { results, myinter, interests });
        });
    });
});

router.post('/', forwardAuthenticated, function(req, res){

    const {age, rating, distance, inter} = req.body;
    var tab = [];
    if (inter != '')
    {
        if (distance >= 0 && distance <= 1000)
        {
            if (age >= 12 && age <= 100)
            {
                if (rating >= 1 && rating <= 5)
                {
                    user.get_sugg_serch(req.user, age, rating,  inter, function(results){
                        user.check_distance(results, distance, req.user.latitude, req.user.longitude);
                        res.send(results);
                    });
                }
                else
                    res.send(tab);
            }
            else
                res.send(tab);
        }
        else
            res.send(tab);
    }
    else
        res.send(tab);
});

function ensureAuthenticated(req, res, next)
{
    if(req.isAuthenticated())
    {
        return next();
    }
    else
    {
        // req.flash('error_msg', 'You are not logged in');
        res.redirect('/users/login');
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
module.exports = router;
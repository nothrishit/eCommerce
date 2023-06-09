const User = require('../models/userModel');
const bcryptjs = require('bcryptjs');
const config = require('../config/config');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');

const sendResetPasswordMail = async (name,email,token) => {
try {
    const transporter = nodemailer.createTransport({
        host : 'smtp.gmail.com',
        port : 587,
        secure : false,
        requireTLS : true,
        auth : {
            user : config.emailUser,
            pass : config.emailPassword
        }
    });

    const mailOptions = {
        from : config.emailUser,
        to : email,
        subject: 'For reset password',
        html : '<p>Hi '+name+' please reset your password by clicking <a href="http://localhost:3000/api/reset-password?token='+token+'">here</a></p>'
    }

    transporter.sendMail(mailOptions,function(error,info){
        if(error){
            console.log(error);
        }else{
            console.log('mail has been sent : -',info.response);
        }
    })
} catch (error) {
    // res.status(400).send({success : false,msg : error.message })
    console.log(error)
}
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcryptjs.hash(password, 10);
        return passwordHash;
    } catch (error) {
        res.status(400).send(error.message)
    }
}


const genToken = async (id) => {
    try {
        const token = await jwt.sign({ _id: id }, config.secret_jwt);
        return token;

    } catch (error) {
        res.status(400).send(error.message);
    }
}
const register_user = async (req, res) => {
    try {
        const spassword = await securePassword(req.body.password);
        const user = new User({
            name: req.body.name,
            email: req.body.email,
            password: spassword,
            mobile: req.body.mobile,
            image: req.file.filename,
            type: req.body.type
        });

        const userData = await User.findOne({ email: req.body.email });

        if (userData) {
            res.status(200).send({
                success: false,
                msg: 'this email already exists'
            });
        } else {
            const user_data = await user.save();
            res.status(200).send({
                success: true,
                data: user_data
            });
        }

    } catch (error) {
        res.status(400).send(error.message)
    }
}


//login

const user_login = async (req, res) => {
    try {

        const email = req.body.email;
        const password = req.body.password;


        const userData = await User.findOne({ email: email });
        if (userData) {
            const passwordMatch = await bcryptjs.compare(password, userData.password);
            if (passwordMatch) {
                const tokenData = await genToken(userData._id);
                const userResult = {
                    _id: userData._id,
                    name: userData.name,
                    email: userData.email,
                    password: userData.password,
                    image: userData.image,
                    mobile: userData.mobile,
                    type: userData.type,
                    token: tokenData
                }

                const response = {
                    success: true,
                    msg: "User details",
                    data: userResult
                }
                res.status(200).send(response);
            } else {
                res.status(200).send({ success: false, msg: "login details are incorrect" });
            }
        } else {
            res.status(200).send("login details are incorrect");
        }
    } catch (error) {
        res.status(400).send(error.message);
    }
}
const update_password = async(req,res) => {
    try {

        const user_id = req.body.user_id;
        if(user_id == ""){
            return res.status(200).send({success: false,msg : "no user id"})
        }
        const password = req.body.password;

        const data = await User.findOne({_id : user_id});

        if(data){
             const newPassword = await securePassword(password);

            const user_data = await User.findByIdAndUpdate({_id : user_id},{$set : {password : newPassword}});

            res.status(200).send({success : true,msg : "Your password has been updated"})
        }else{
            res.status(200).send({success : false,msg : "User id not found"})
        }
        
    } catch (error) {
        res.status(400).send(error.message);
    }
}

const forget_password = async (req,res) => {
try {
    const email = req.body.email;
    const userData  = await User.findOne({email : email});
    if(userData){
        const randomString = randomstring.generate();

        const data = await User.updateOne({email : email},{$set : {token : randomString}});
        sendResetPasswordMail(userData.name,userData.email,randomString);
        res.status(200).send({success : true , msg : "please check your email and reset your password"});
    }else{
        res.status(200).send({success : true , msg : "this email does not exist"});
    }
    
} catch (error) {
    res.status(400).send({success : false , msg : error.message});
}
}
const reset_password = async (req,res) => {
try {
    const token = req.query.token;
    const tokenData = await User.findOne({token : token});
    if(tokenData){
        const password = req.body.password;
        const newPassword = await securePassword(password);

        const userData = await User.findByIdAndUpdate({_id : tokenData._id},{$set : {password : newPassword,token : ''}},{new : true});
        res.status(200).send({success : true , msg : 'User password has been reset',data : userData});
    }else{
        res.status(200).send({success : true , msg : 'this link has been expired'});
    }
} catch (error) {
    res.status(400).send({success : false , msg : error.message})
}
}
const renewToken = async(id)=>{
    try {
        const secret_jwt = config.secret_jwt;
        const newSecret = randomstring.generate();
        fs.readFile('config/config.js',"utf-8",function(err,data){
            if(err) throw err;
            const newValue = data.replace(new RegExp(secret_jwt,'g'),newSecret);
            fs.writeFile('config/config.js',newValue,'utf-8',function(err,data){
                if(err) throw err;
                console.log('done');
            })
        })
        const token = await jwt.sign({ _id : id},newSecret);
        return token
    } catch (error) {
        res.status(400).send({success : false , msg : error.message})

    }
}
const refreshToken = async(req,res)=>{
    try {
        const user_id = req.body.id;
        const userData = User.findById({_id : user_id});
        if(userData){
            const tokenData = await renewToken(user_id);
            const response = {
                user_id : user_id,
                token : tokenData
            }
            res.status(200).send({success : true,msg : "refresh token details",data : response})
        }else{
        res.status(200).send({success : false , msg : "User not found"})
        }
    } catch (error) {
        res.status(400).send({success : false , msg : error.message})
    }
}
module.exports = {
    register_user,
    user_login,
    update_password,
    forget_password,
    reset_password,
    refreshToken
}
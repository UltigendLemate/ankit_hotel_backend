const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const User = require('./models/user.js');
const jwt = require('jsonwebtoken');
const https = require('https');
const http = require('http');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const booking = require('./models/booking.js');
const fs = require('fs');
const Place = require('./models/place.js');
require('dotenv').config()
const app= express();

const bcryptSalt= bcrypt.genSaltSync(10);
const jwtSecret= 'sldkasdjfasdnkasjdfaskdljsdf';
app.set('port', (process.env.PORT || 8081));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static( __dirname + '/uploads'));
app.use(cors
    ({
        origin: "*"
    }));


// app.get("/", (req, res) => res.send("Express on Vercel"));

function getUserDataFromReq(req){
    return new Promise((resolve,reject)=>{
        jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
            if (err) reject(err);
            resolve(userData);
        });
    }); 
}

mongoose.connect(process.env.MONGO_URL);
console.log("script running");


app.get('/api/test', (req,res) => {
    console.log('test ok');
    res.json('test ok');
  });


app.get('/api/profile', (req,res)=>{
    const {token} = req.cookies;

    if(token){
        jwt.verify(token, jwtSecret, {}, async (err, userData)=>{
            if(err) throw err;
            const {name, email, id}= await User.findById(userData.id);
            res.json({name, email, id}); 
        })
    }
    else{
        res.json(null)
    }
})


app.post('/api/register', async (req, res) => {
    const {name, email, password} = req.body;
    try{
        const userDoc= await User.create({
            name, 
            email, 
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        // console.log(userDoc);
        res.json(userDoc);
    }
    catch(e){
        res.status(422).json(e);
    }
});

app.post('/api/login', async (req, res) => {
    const {email, password}= req.body;
    const userDoc= await User.findOne({email});

    if(userDoc){
        const isPasswordValid= bcrypt.compareSync(password, userDoc.password);

        if(isPasswordValid){
            jwt.sign({
                email:userDoc.email, 
                id:userDoc._id},
                jwtSecret, {}, (err, token) => {
                if(err) throw err;
                res.cookie('token', token).json(userDoc);
            });
            
        }
        else{
            res.status(422).json('pass not ok');
        }
    }
    else{
        res.json('User not found');
    }
});


app.post('/api/logout', (req,res)=>{
    res.clearCookie('token','').json(true);
})

// console.log({__dirname});
app.post('/api/upload-by-link' , async (req,res)=>{
    const {link}= req.body;
    const newName= 'photo' + Date.now() + '.jpg';
    // await imageDownloader.image({
    //     url: link,
    //     dest: __dirname + '/uploads/' +newName,
    // });
    res.json(newName);
})


// const photosMiddleware= multer({dest:'uploads/'});
// app.post('/upload',photosMiddleware.array('photos', 100) ,(req,res)=>{
//     const uploadedFiles= [];
//     for(let i=0; i<req.files.length; i++){
//         const {path,originalname}= req.files[i];
//         const parts= originalname.split('.');
//         const ext= parts[parts.length-1];
//         const newPath= path  + '.' + ext;
//         // const actual= newPath.replace('uploads\\', 'uploads/');
//         // fs.renameSync(path, newPath);
//         // console.log(path, typeof path);
//         // console.log(newPath, typeof newPath);
//         const repl= newPath.replace('uploads\\','');
//         // console.log(repl);
//         uploadedFiles.push(repl);
        
//     }
    
//     res.json(uploadedFiles);
// })

app.post('/api/places', async (req,res)=>{
    const {token} = req.cookies;
    const {
        title,address,addedPhotos,description,price,
        perks,extraInfo,checkIn,checkOut,maxGuests,
    } = req.body;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await Place.create({
            owner:userData.id,price,
            title,address,photos:addedPhotos,description,
            perks,extraInfo,checkIn,checkOut,maxGuests,
        });
        res.json(placeDoc);
    });
});
app.get('/api/user-places', async (req,res)=>{
    const {token} = req.cookies;
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if (err) throw err;
        const places = await Place.find({owner:userData.id});
        res.json(places);
    });
});


app.get('/api/places/:id', async (req,res)=>{  
    const {id}= req.params;
    const place= await Place.findById(id);
    res.json(place);
});

app.put('/api/places', async (req,res)=>{
    const {token} = req.cookies;
    const {
        id,
        title,address,addedPhotos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price,
    } = req.body;

    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
        if(err) throw err;
        const placeDoc= await Place.findById(id);
        if(userData.id=== placeDoc.owner.toString()){
            placeDoc.set({
                    title,address,photos:addedPhotos,description,
                    perks,extraInfo,checkIn,checkOut,maxGuests,price,
            });
            await placeDoc.save();
            res.json('ok');
        }
    });
});

app.get('/api/places', async (req,res)=>{
    const places= await Place.find();
    res.json(places);
});

app.post('/api/bookings',  async (req,res)=>{
    const userData= await getUserDataFromReq(req); 
    const {place,checkIn,checkOut,numberOfGuests,name,phone,price}= req.body;
     booking.create({
        place,checkIn,checkOut,numberOfGuests,name,phone,price,
        user:userData.id,
    }).then((doc)=>{
        // if(err) throw err;
        res.json(doc);
    }).catch((err)=>{
        throw err;
    })
});



app.get('/api/bookings', async (req,res)=>{
    const userData= await getUserDataFromReq(req);
    res.json( await booking.find({user:userData.id}).populate('place') );
});
app.listen(app.get('port'), function() {
    console.log('Express app vercel-express-react-demo is running on port', app.get('port'));
  });

module.exports = app;
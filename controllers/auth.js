const bcrypt = require('bcrypt');

const {nanoid} = require('nanoid');

const gravatar = require('gravatar');

const jwt = require('jsonwebtoken');

const Jimp = require('jimp');

const fs = require('fs/promises');

const path = require('path');

const { User } = require('../models/user');

const { HttpError, ctrlWrapper, sendEmail } = require('../helpers');

const { SECRET_KEY, PROJECT_URL } = process.env;

const avatarPath = path.resolve('public', 'avatars');

const register = async(req, res) => {
    
    const { email, password } = req.body;
    const avatarUrl = gravatar.url(email);
    const user = await User.findOne({email});

    if (user) {
        throw HttpError(409, 'Email in use')
    };

    const hashPassword = await bcrypt.hash(password, 10);
    const verificationToken = nanoid();

    const newUser = await User.create({...req.body, password: hashPassword, avatarUrl, verificationToken});

    const verifyEmail = {
        to: email,
        subject: "verify email",
        html: `<a target="_blank" href="${PROJECT_URL}/users/verify/${verificationToken}">Click to verify email</a>`
    };
    await sendEmail(verifyEmail);

    res.status(201).json({
        "user": {
            email: newUser.email,
            subscription: 'starter'
        }
    })
};

const verify = async(req, res) => {
    const {verificationToken} = req.params;
    console.log(verificationToken)
    const user = await User.findOne({verificationToken});
    
    if (!user){
        throw HttpError(404, 'User not found');
    }
    await User.findByIdAndUpdate(user._id, {verify: true, verificationToken: ""})

    res.status(200).json({
        message: 'Verification successful'
    })
};

const resendVerifyEmail = async (req, res) => {
    const {email} = req.body;
    const user = await User.findOne({email});
    if (!user) {
        throw HttpError(404)
    };
    if (user.verify){
        throw HttpError(400, "Verification has already been passed")
    };
    const verifyEmail = {
        to: email,
        subject: "verify email",
        html: `<a target="_blank" href="${PROJECT_URL}/api/users/verify/${user.verificationToken}">Click to verify email</a>`
    };
    await sendEmail(verifyEmail);

    res.json({
        message: "Verification email sent"
    })
}

const login = async(req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({email});
    if (!user || !user.verify) {
        throw HttpError(401, 'Email or password is wrong')
    };
    const passwordCompare = await bcrypt.compare(password, user.password);
    if (!passwordCompare) {
        throw HttpError(401, 'Email or password is wrong')
    };

    const payload = {
        id: user._id
    }
    const token = jwt.sign(payload, SECRET_KEY, {expiresIn: '23h'});
    await User.findByIdAndUpdate(user._id, {token});
    
    res.json({
        token,
        user: {
            email: user.email,
            subscription: 'starter'
        } 
    });
};

const getCurrent = async (req, res) => {
    const { email, subscription } = req.user;

    res.json({
        email,
        subscription
    })
};

const logout = async (req, res) => {
    const {_id} = req.user;
    await User.findByIdAndUpdate( _id, {token: ""});

    res.status(204).send("No content")
};

const updateSubscriptionUser = async (req, res) => {
    const {id} = req.user;
    console.log(id)
    console.log(req.body)
    const result = await User.findByIdAndUpdate(id, req.body, {new: true});
    res.json(result);
};

const updateAvatar = async(req, res) => {
        
    const {_id} = req.user;
    const { path: oldPath, originalname } = req.file;
    console.log(req.file)
    const filename = `${_id}_${originalname}`

    async function resizeFile() {
        const image = await Jimp.read(oldPath);
        await image.contain(250, 250);
           
        await image.writeAsync(oldPath);
           console.log(oldPath)
           return oldPath
       }
       await resizeFile()
    const newPath = path.join(avatarPath, filename);
    
    await fs.rename(oldPath, newPath);
    const avatarUrl = path.join('avatars', filename);
    if (!_id) {
        throw HttpError(401, 'Not authorized')
    };
    await User.findByIdAndUpdate(_id, {avatarUrl});

    res.json({
        avatarUrl,
    })
}

module.exports = {
    register: ctrlWrapper(register),
    login: ctrlWrapper(login),
    getCurrent: ctrlWrapper(getCurrent),
    logout: ctrlWrapper(logout),
    updateSubscriptionUser: ctrlWrapper(updateSubscriptionUser),
    updateAvatar: ctrlWrapper(updateAvatar),
    verify: ctrlWrapper(verify),
    resendVerifyEmail: ctrlWrapper(resendVerifyEmail)
}

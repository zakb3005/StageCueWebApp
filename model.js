const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

mongoose.connect('mongodb+srv://se4200:LmOXNTLWonHaNawN@mongodbassignment.l3n1u.mongodb.net/?retryWrites=true&w=majority&appName=MongoDBAssignment', {
    dbName: 'stagecue'
});

const Story = mongoose.model('Story', {
    title: {
        type: String,
        required: true,
        minlength: 1,
        maxlength: 24
    },
    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    creatorUser: {
        type: String,
        required: true
    },
    description: {
        type: String,
        maxlength: 2000,
        default: ""
    },
    ratings: [{
        userId: mongoose.Schema.Types.ObjectId,
        score: Number
    }],
    averageRating: {
        type: Number,
        default: 0
    },
    viewCount: {
        type: Number,
        default: 0
    },
    thumbnailUrl: {
        type: String
    },
    pages: [{
        imageUrl: String
    }]
});

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required."],
        unique: true,
        validate: {
            validator: function (value) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            },
            message: "Invalid email format. Use a valid email address."
        }
    },
    encryptedPassword: {
        type: String,
        required: [true, "Password is required."]
    },
    username: {
        type: String,
        required: [true, "Username is required."],
        unique: true,
        minlength: [3, "Username must be at least 3 characters long."],
        maxlength: [20, "Username cannot exceed 20 characters."]
    },
    profilePicUrl: {
        type: String
    },
    bio: {
        type: String,
        maxlength: 300
    }
});

userSchema.methods.setEncryptedPassword = function(plaintextPass) {
    let promise = new Promise((resolve, reject) => {
        
        bcrypt.hash(plaintextPass, 12).then((hash) => {
            console.log("Hashed password:",hash);
            this.encryptedPassword = hash;
            resolve();
        });
    });
    
    return promise;
}

userSchema.methods.verifyEncryptedPassword = function(plaintextPass) {
    let promise = new Promise((resolve, reject) => {
        bcrypt.compare(plaintextPass, this.encryptedPassword).then(result => {
            resolve(result);
        });
    });

    return promise;
}

const User = mongoose.model('User', userSchema);

module.exports = {
    Story,
    User
};